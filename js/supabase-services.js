// Wait for Supabase to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeSupabase();
});

function initializeSupabase() {
    // Check if supabase is available
    if (typeof supabase === 'undefined') {
        console.error('Supabase not loaded yet. Retrying in 500ms...');
        setTimeout(initializeSupabase, 500);
        return;
    }

    const { createClient } = supabase;
    
    let supabaseClient;
    try {
        const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
        
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
        
        // Make supabaseClient globally available
        window.supabaseClient = supabaseClient;
        
        // Initialize your functions
        initializeFunctions(supabaseClient);
        
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        // Create fallback
        window.supabaseClient = createFallbackClient();
        initializeFunctions(window.supabaseClient);
    }
}

function initializeFunctions(supabaseClient) {
    // Helper: Show error message
    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    // Helper: Show success modal
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

    // Authentication: Login
    async function login(email, password, role) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                showError('login-error-message', error.message || 'Login failed');
                return null;
            }

            // Verify role
            const { data: userData, error: userError } = await supabaseClient
                .from('users')
                .select('role')
                .eq('email', email)
                .single();

            if (userError || userData?.role !== role) {
                showError('login-error-message', userError?.message || 'Invalid role or user not found');
                await supabaseClient.auth.signOut();
                return null;
            }

            console.log('Logged in as:', role);
            return data.user;
        } catch (err) {
            showError('login-error-message', err.message || 'An unexpected error occurred during login');
            console.error('Login error:', err);
            return null;
        }
    }

    // Signup: Generic for simple roles (passenger, driver, owner)
    async function signupSimple(role, formData) {
        const { email, password, license_number, company_name } = formData;
        const errorElementId = `signup-${role}-error-message`;

        try {
            // Validate password length
            if (password.length < 8) {
                showError(errorElementId, 'Password must be at least 8 characters long');
                return null;
            }

            // Sign up user
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email, password });
            if (authError) {
                showError(errorElementId, authError.message || 'Registration failed');
                return null;
            }

            // Insert user data
            const userData = {
                id: authData.user.id,
                email,
                role
            };
            if (license_number) userData.license_number = license_number;
            if (company_name) userData.company_name = company_name;

            const { error: dbError } = await supabaseClient.from('users').insert(userData);
            if (dbError) {
                showError(errorElementId, dbError.message || 'Failed to save user data');
                return null;
            }

            showSuccess(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`, `Login with: ${email}`);
            console.log(`${role} registered successfully`);
            return authData.user;
        } catch (err) {
            showError(errorElementId, err.message || 'An unexpected error occurred during registration');
            console.error(`${role} signup error:`, err);
            return null;
        }
    }

    // Signup: For Association (complex, with logo upload)
    async function signupAssociation(formData) {
        const {
            name, email, phone, registrationNumber, address, description,
            logo: logoFile, adminEmail, adminPassword, adminName, adminPhone, adminIdNumber
        } = formData;
        const errorElementId = 'signup-association-error-message';

        try {
            // Validate password length
            if (adminPassword.length < 8) {
                showError(errorElementId, 'Administrator password must be at least 8 characters long');
                return null;
            }

            // Sign up admin
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: adminEmail,
                password: adminPassword
            });
            if (authError) {
                showError(errorElementId, authError.message || 'Admin registration failed');
                return null;
            }

            const adminId = authData.user.id;

            // Insert admin as user
            const { error: userError } = await supabaseClient.from('users').insert({
                id: adminId,
                email: adminEmail,
                role: 'association'
            });
            if (userError) {
                showError(errorElementId, userError.message || 'Failed to save admin user data');
                return null;
            }

            // Upload logo if provided
            let logoUrl = null;
            if (logoFile) {
                const fileName = `${adminId}/${Date.now()}_${logoFile.name}`;
                const { data: storageData, error: storageError } = await supabaseClient.storage
                    .from('logos')
                    .upload(fileName, logoFile, { cacheControl: '3600', upsert: false });
                if (storageError) {
                    showError(errorElementId, storageError.message || 'Failed to upload logo');
                    return null;
                }
                const { data: publicUrlData } = supabaseClient.storage.from('logos').getPublicUrl(fileName);
                logoUrl = publicUrlData.publicUrl;
            }

            // Insert association data
            const associationData = {
                name,
                email,
                phone,
                address,
                admin_id: adminId,
                admin_name: adminName,
                admin_phone: adminPhone,
                admin_id_number: adminIdNumber
            };
            if (registrationNumber) associationData.registration_number = registrationNumber;
            if (description) associationData.description = description;
            if (logoUrl) associationData.logo_url = logoUrl;

            const { error: assocError } = await supabaseClient.from('associations').insert(associationData);
            if (assocError) {
                showError(errorElementId, assocError.message || 'Failed to save association data');
                return null;
            }

            showSuccess('Association created successfully', `Admin Email: ${adminEmail}`);
            console.log('Association registered successfully');
            return authData.user;
        } catch (err) {
            showError(errorElementId, err.message || 'An unexpected error occurred during association registration');
            console.error('Association signup error:', err);
            return null;
        }
    }

    function createFallbackClient() {
        return {
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

    // Make functions globally available
    window.login = login;
    window.signupSimple = signupSimple;
    window.signupAssociation = signupAssociation;
    window.showError = showError;
    window.showSuccess = showSuccess;
}
