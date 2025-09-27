// Use global supabase from CDN
const { createClient } = supabase;

// Enhanced Supabase client initialization
let supabase;

try {
    const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase configuration missing');
    }
    
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully');
} catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    // Fallback mock client
    supabase = {
        auth: { 
            signInWithPassword: () => Promise.resolve({ error: new Error('Supabase not initialized') }),
            signUp: () => Promise.resolve({ error: new Error('Supabase not initialized') }),
            signOut: () => Promise.resolve({ error: new Error('Supabase not initialized') })
        },
        from: () => ({ 
            select: () => ({ 
                single: () => Promise.resolve({ error: new Error('Supabase not initialized') }) 
            }),
            insert: () => Promise.resolve({ error: new Error('Supabase not initialized') })
        }),
        storage: {
            from: () => ({
                upload: () => Promise.resolve({ error: new Error('Supabase not initialized') }),
                getPublicUrl: () => ({ publicUrl: '' })
            })
        }
    };
}

// Helper functions
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function showSuccess(message, loginDetails = '') {
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalLoginDetails = document.getElementById('modal-login-details');
    const signupModal = document.getElementById('signup-modal');
    
    if (modalTitle && modalMessage && modalLoginDetails && signupModal) {
        modalTitle.textContent = 'Success!';
        modalMessage.textContent = message;
        modalLoginDetails.textContent = loginDetails;
        signupModal.style.display = 'flex';
    }
}

// Authentication functions
async function login(email, password, role) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('email', email)
            .single();

        if (userError || userData?.role !== role) {
            await supabase.auth.signOut();
            throw new Error('Invalid role or user not found');
        }

        console.log('Logged in as:', role);
        return data.user;
    } catch (err) {
        showError('login-error-message', err.message || 'Login failed');
        return null;
    }
}

async function signupSimple(role, formData) {
    const { email, password, license_number, company_name } = formData;
    const errorElementId = `signup-${role}-error-message`;

    try {
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        const userData = { id: authData.user.id, email, role };
        if (license_number) userData.license_number = license_number;
        if (company_name) userData.company_name = company_name;

        const { error: dbError } = await supabase.from('users').insert(userData);
        if (dbError) throw dbError;

        showSuccess(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`, `Login with: ${email}`);
        return authData.user;
    } catch (err) {
        showError(errorElementId, err.message || 'Registration failed');
        return null;
    }
}

async function signupAssociation(formData) {
    const errorElementId = 'signup-association-error-message';

    try {
        const { adminPassword, adminEmail, logo: logoFile, ...associationData } = formData;
        
        if (adminPassword.length < 8) {
            throw new Error('Administrator password must be at least 8 characters long');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: adminEmail,
            password: adminPassword
        });
        if (authError) throw authError;

        const adminId = authData.user.id;

        // Insert admin user
        const { error: userError } = await supabase.from('users').insert({
            id: adminId,
            email: adminEmail,
            role: 'association'
        });
        if (userError) throw userError;

        // Upload logo if provided
        let logoUrl = null;
        if (logoFile) {
            const fileName = `${adminId}/${Date.now()}_${logoFile.name}`;
            const { error: storageError } = await supabase.storage
                .from('logos')
                .upload(fileName, logoFile);
            if (storageError) throw storageError;
            
            const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
            logoUrl = publicUrlData.publicUrl;
        }

        // Insert association
        const { error: assocError } = await supabase.from('associations').insert({
            ...associationData,
            admin_id: adminId,
            logo_url: logoUrl
        });
        if (assocError) throw assocError;

        showSuccess('Association created successfully', `Admin Email: ${adminEmail}`);
        return authData.user;
    } catch (err) {
        showError(errorElementId, err.message || 'Registration failed');
        return null;
    }
}

// Make functions globally available
window.login = login;
window.signupSimple = signupSimple;
window.signupAssociation = signupAssociation;
window.showError = showError;
window.showSuccess = showSuccess;