// supabase-services.js - FIXED VERSION
console.log('🔧 Loading Supabase services...');

// Wait for both DOM and Supabase to be ready
function initializeWhenReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // DOM already loaded, wait a bit for Supabase
        setTimeout(initializeApp, 100);
    }
}

// Check if Supabase is loaded
function isSupabaseLoaded() {
    return typeof window.supabase !== 'undefined' && 
           typeof window.supabase.createClient === 'function';
}

// Initialize the application
function initializeApp() {
    console.log('🚀 Initializing Supabase client...');
    
    const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
    
    let supabase;
    
    // Try to initialize Supabase client
    if (isSupabaseLoaded()) {
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true
                }
            });
            console.log('✅ Supabase client initialized successfully');
        } catch (error) {
            console.error('❌ Supabase initialization failed:', error);
            supabase = createFallbackClient();
        }
    } else {
        console.error('❌ Supabase CDN not loaded yet');
        supabase = createFallbackClient();
    }

    // Initialize functions
    const functions = initializeFunctions(supabase);
    if (functions) {
        // Make functions globally available
        window.login = functions.login;
        window.signupSimple = functions.signupSimple;
        window.signupAssociation = functions.signupAssociation;
        window.showError = functions.showError;
        window.showSuccess = functions.showSuccess;
        
        console.log('✅ All functions are now globally available');
        console.log('Available functions:', Object.keys(functions));
        
        // Initialize event listeners
        functions.setupEventListeners();
    } else {
        console.error('❌ Failed to initialize functions');
    }
}

function createFallbackClient() {
    console.warn('⚠️ Using fallback Supabase client');
    return {
        auth: { 
            signInWithPassword: () => Promise.resolve({ 
                data: null, 
                error: new Error('Supabase not available') 
            }),
            signUp: () => Promise.resolve({ 
                data: null, 
                error: new Error('Supabase not available') 
            }),
            signOut: () => Promise.resolve({ error: new Error('Supabase not available') }),
            onAuthStateChange: () => ({ data: null, error: null })
        },
        from: () => ({ 
            select: () => ({ 
                single: () => Promise.resolve({ 
                    data: null, 
                    error: new Error('Supabase not available') 
                }),
                eq: function() { return this; }
            }),
            insert: () => Promise.resolve({ 
                data: null, 
                error: new Error('Supabase not available') 
            }),
            update: () => Promise.resolve({ 
                data: null, 
                error: new Error('Supabase not available') 
            }),
            delete: () => Promise.resolve({ 
                data: null, 
                error: new Error('Supabase not available') 
            })
        }),
        storage: {
            from: () => ({
                upload: () => Promise.resolve({ 
                    data: null, 
                    error: new Error('Supabase not available') 
                }),
                getPublicUrl: () => ({ data: { publicUrl: '' } })
            })
        }
    };
}

function initializeFunctions(supabase) {
    try {
        // Utility functions
        function showError(elementId, message) {
            console.error(`Error [${elementId}]:`, message);
            const errorElement = document.getElementById(elementId);
            if (errorElement) {
                errorElement.textContent = message;
                errorElement.style.display = 'block';
                setTimeout(() => {
                    errorElement.style.display = 'none';
                }, 5000);
            }
        }

        function showSuccess(message, loginDetails = '') {
            console.log('Success:', message);
            const modalTitle = document.getElementById('modal-title');
            const modalMessage = document.getElementById('modal-message');
            const modalLoginDetails = document.getElementById('modal-login-details');
            
            if (modalTitle && modalMessage && modalLoginDetails) {
                modalTitle.textContent = 'Success!';
                modalMessage.textContent = message;
                modalLoginDetails.textContent = loginDetails;
                showModal('signup-modal');
            }
        }

        function showModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                console.log('Showing modal:', modalId);
            }
        }

        function closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
                console.log('Closed modal:', modalId);
            }
        }

        function closeAllModals() {
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
            document.body.style.overflow = 'auto';
        }

        // Make modal functions globally available
        window.showModal = showModal;
        window.closeModal = closeModal;
        window.closeAllModals = closeAllModals;

        // Login function
        async function login(email, password, role) {
            const errorElementId = 'login-error-message';
            
            console.log('🔐 LOGIN ATTEMPT STARTED ==========');
            console.log('Email:', email, 'Role:', role);

            try {
                // Basic validation
                if (!email || !password || !role) {
                    showError(errorElementId, 'Please fill in all fields');
                    return null;
                }

                console.log('🔄 Step 1: Authenticating with Supabase Auth...');
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
                    email: email.trim().toLowerCase(), 
                    password: password
                });

                if (authError) {
                    console.error('❌ Auth failed:', authError);
                    showError(errorElementId, authError.message || 'Authentication failed');
                    return null;
                }

                if (!authData.user) {
                    console.error('❌ No user data returned');
                    showError(errorElementId, 'Authentication failed - no user data');
                    return null;
                }

                console.log('✅ Auth successful! User ID:', authData.user.id);

                // Get user profile
                console.log('🔄 Step 2: Fetching user profile...');
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', authData.user.id)
                    .single();

                if (profileError) {
                    console.error('❌ Profile fetch failed:', profileError);
                    showError(errorElementId, 'Unable to access user profile');
                    await supabase.auth.signOut();
                    return null;
                }

                console.log('✅ Profile found:', profileData);

                // Verify role
                if (profileData.role !== role) {
                    console.error('❌ Role mismatch! Profile role:', profileData.role, 'Requested role:', role);
                    showError(errorElementId, `Invalid role. Your account is registered as ${profileData.role}`);
                    await supabase.auth.signOut();
                    return null;
                }

                console.log('✅ Role verified successfully!');

                console.log('🎉 LOGIN SUCCESSFUL!');
                return {
                    user: authData.user,
                    profile: profileData,
                    session: authData.session
                };

            } catch (err) {
                console.error('💥 UNEXPECTED LOGIN ERROR:', err);
                showError(errorElementId, 'An unexpected error occurred: ' + (err.message || 'Unknown error'));
                return null;
            }
        }

        // Simple signup function
        async function signupSimple(role, formData) {
            const { email, password, license_number, company_name } = formData;
            const errorElementId = `signup-${role}-error-message`;

            try {
                // Basic validation
                if (!email || !password) {
                    showError(errorElementId, 'Email and password are required');
                    return null;
                }

                if (password.length < 8) {
                    showError(errorElementId, 'Password must be at least 8 characters long');
                    return null;
                }

                console.log('📝 Step 1: Creating auth account...');
                const { data: authData, error: authError } = await supabase.auth.signUp({ 
                    email: email.trim().toLowerCase(), 
                    password: password 
                });

                if (authError) {
                    console.error('❌ Auth signup error:', authError);
                    showError(errorElementId, authError.message || 'Registration failed');
                    return null;
                }

                if (!authData.user) {
                    showError(errorElementId, 'User creation failed - no user data returned');
                    return null;
                }

                console.log('✅ Auth account created:', authData.user.id);

                // Create profile
                console.log('📝 Step 2: Creating profile record...');
                const profileData = {
                    id: authData.user.id,
                    email: email.trim().toLowerCase(),
                    role: role,
                    profile_complete: true
                };

                // Add role-specific fields
                if (license_number) profileData.license_number = license_number;
                if (company_name) profileData.company_name = company_name;

                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([profileData]);

                if (profileError) {
                    console.error('❌ Profile creation error:', profileError);
                    
                    // Try to update if profile already exists
                    if (profileError.code === '23505') {
                        console.log('🔄 Profile already exists, updating...');
                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update({ 
                                role: role,
                                profile_complete: true 
                            })
                            .eq('id', authData.user.id);
                        
                        if (updateError) {
                            console.error('❌ Profile update failed:', updateError);
                            showError(errorElementId, 'Account exists but role update failed');
                            return null;
                        }
                    } else {
                        showError(errorElementId, 'Failed to save user profile: ' + profileError.message);
                        return null;
                    }
                }

                console.log('✅ Profile created/updated successfully');
                showSuccess(
                    `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
                    `Login with: ${email}`
                );

                return authData.user;

            } catch (err) {
                console.error(`❌ ${role} signup error:`, err);
                showError(errorElementId, err.message || 'An unexpected error occurred');
                return null;
            }
        }

        // Association signup function (keep your existing implementation)
        async function signupAssociation(formData) {
            // Keep your existing signupAssociation implementation
            // ... (your existing code)
        }

        // Event listeners setup
        function setupEventListeners() {
            console.log('🔧 Setting up event listeners...');
            
            // Prevent default form submissions
            document.querySelectorAll('form').forEach(form => {
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    console.log('Form submission prevented for:', this.id);
                });
            });

            // Login form handler
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    const email = document.getElementById('login-email')?.value;
                    const password = document.getElementById('login-password')?.value;
                    const role = document.getElementById('login-role')?.value;

                    if (!email || !password || !role) {
                        showError('login-error-message', 'Please fill in all fields');
                        return;
                    }

                    const result = await login(email, password, role);
                    if (result) {
                        console.log('Login successful, redirecting...');
                        // Redirect based on role
                        const redirects = {
                            passenger: './passenger-dashboard.html',
                            driver: './driver-dashboard.html',
                            owner: './owner-dashboard.html',
                            association: './association-dashboard.html'
                        };
                        window.location.href = redirects[role] || './dashboard.html';
                    }
                });
            }

            // Add other form handlers as needed...
            // (Keep your existing setupEventListeners implementation)

            console.log('✅ Event listeners setup complete');
        }

        // Return all functions
        return {
            login,
            signupSimple,
            signupAssociation,
            showError,
            showSuccess,
            setupEventListeners
        };

    } catch (error) {
        console.error('❌ Error initializing functions:', error);
        return null;
    }
}

// Start the initialization process
initializeWhenReady();
