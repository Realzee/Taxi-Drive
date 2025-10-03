const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';

function initializeFunctions() {
    // Initialize Supabase client
    let supabase;
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        throw error;
    }

    // Login function
    async function login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Login error:', error);
                throw error;
            }

            console.log('Login successful:', data.user);
            return data;
        } catch (error) {
            console.error('Unexpected login error:', error);
            throw error;
        }
    }

    // Simple signup function (for non-association users)
    async function signupSimple(email, password, role = 'user') {
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password
            });

            if (authError) {
                console.error('Signup error:', authError);
                throw authError;
            }

            const profileData = {
                id: authData.user.id,
                email,
                role,
                profile_complete: false
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .insert([profileData]);

            if (profileError) {
                console.error('Profile creation error:', profileError);
                throw profileError;
            }

            console.log('Signup successful:', authData.user);
            return authData;
        } catch (error) {
            console.error('Unexpected signup error:', error);
            throw error;
        }
    }

    // Association signup function
    async function signupAssociation(email, password, associationData) {
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password
            });

            if (authError) {
                console.error('Association signup error:', authError);
                throw authError;
            }

            const profileData = {
                id: authData.user.id,
                email,
                role: 'association',
                profile_complete: false
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .insert([profileData]);

            if (profileError) {
                console.error('Profile creation error:', profileError);
                throw profileError;
            }

            const assocData = {
                admin_id: authData.user.id,
                association_name: associationData.association_name,
                email,
                phone: associationData.phone || '',
                address: associationData.address || '',
                admin_name: associationData.admin_name || email.split('@')[0],
                admin_phone: associationData.admin_phone || '',
                description: associationData.description || '',
                logo_url: null,
                wallet_balance: 0
            };

            const { error: assocError } = await supabase
                .from('associations')
                .insert([assocData]);

            if (assocError) {
                console.error('Association creation error:', assocError);
                throw assocError;
            }

            console.log('Association signup successful:', authData.user);
            return authData;
        } catch (error) {
            console.error('Unexpected association signup error:', error);
            throw error;
        }
    }

    // Create owner user in Supabase Auth
    async function createOwnerUser(email, password) {
        try {
            const { data, error } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

            if (error) {
                console.error('Error creating owner user:', error);
                throw new Error('Failed to create owner: ' + error.message);
            }

            console.log('Owner user created successfully:', data.user.id);
            return data.user;
        } catch (error) {
            console.error('Unexpected error creating owner user:', error);
            throw error;
        }
    }

    // Update owner user in Supabase Auth
    async function updateOwnerUser(userId, email, password) {
        try {
            const updates = { email };
            if (password) {
                updates.password = password;
            }

            const { error } = await supabase.auth.admin.updateUserById(userId, updates);

            if (error) {
                console.error('Error updating owner user:', error);
                throw new Error('Failed to update owner: ' + error.message);
            }

            console.log('Owner user updated successfully:', userId);
        } catch (error) {
            console.error('Unexpected error updating owner user:', error);
            throw error;
        }
    }

    // Show error notification
    function showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-error';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;
        document.body.appendChild(notification);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Show success notification
    function showSuccess(message) {
        const notification = document.createElement('div');
        notification.className = 'notification notification-success';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;
        document.body.appendChild(notification);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Return public functions
    return {
        login,
        signupSimple,
        signupAssociation,
        createOwnerUser,
        updateOwnerUser,
        showError,
        showSuccess
    };
}

// Initialize and expose functions globally
try {
    window.supabaseServices = initializeFunctions();
} catch (error) {
    console.error('Failed to initialize Supabase services:', error);
}
