// Wait for the page to load completely
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Supabase client...');
    initializeApp();
});

function initializeApp() {
    // Initialize Supabase
    const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
    
    let supabase;
    
    try {
        // Check if Supabase is available globally (from CDN)
        if (typeof window.supabase !== 'undefined') {
            const { createClient } = window.supabase;
            supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error('Supabase CDN not loaded');
            // Fallback: try to load createClient from global scope
            supabase = window.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        console.log('Supabase client initialized successfully');
    } catch (error) {
        console.error('Supabase initialization failed:', error);
        // Create a fallback client to prevent errors
        supabase = createFallbackClient();
    }

    // Initialize all application functionality
    initializeFunctions(supabase);
}

function createFallbackClient() {
    return {
        auth: { 
            signInWithPassword: () => Promise.resolve({ error: new Error('Supabase not available') }),
            signUp: () => Promise.resolve({ error: new Error('Supabase not available') }),
            signOut: () => Promise.resolve({ error: new Error('Supabase not available') })
        },
        from: () => ({ 
            select: () => ({ 
                single: () => Promise.resolve({ error: new Error('Supabase not available') }) 
            }),
            insert: () => Promise.resolve({ error: new Error('Supabase not available') })
        }),
        storage: {
            from: () => ({
                upload: () => Promise.resolve({ error: new Error('Supabase not available') }),
                getPublicUrl: () => ({ publicUrl: '' })
            })
        }
    };
}

function initializeFunctions(supabase) {
    // Utility to close all modals
    function closeAllModals() {
        const modals = [
            'signup-role-modal',
            'signup-passenger-modal',
            'signup-driver-modal',
            'signup-owner-modal',
            'signup-association-modal',
            'signup-modal'
        ];
        modals.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.style.display = 'none';
        });
    }

    // Utility to show a modal
    function showModal(modalId) {
        closeAllModals();
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'flex';
    }

    // Utility to show error message
    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    // Utility to show success message
    function showSuccess(message, loginDetails = '') {
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

    // Authentication: Login
    async function login(email, password, role) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                showError('login-error-message', error.message || 'Login failed');
                return null;
            }

            // Verify role
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('role')
                .eq('email', email)
                .single();

            if (userError || userData?.role !== role) {
                showError('login-error-message', userError?.message || 'Invalid role or user not found');
                await supabase.auth.signOut();
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
            const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
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

            const { error: dbError } = await supabase.from('users').insert(userData);
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
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: adminEmail,
                password: adminPassword
            });
            if (authError) {
                showError(errorElementId, authError.message || 'Admin registration failed');
                return null;
            }

            const adminId = authData.user.id;

            // Insert admin as user
            const { error: userError } = await supabase.from('users').insert({
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
                const { data: storageData, error: storageError } = await supabase.storage
                    .from('logos')
                    .upload(fileName, logoFile, { cacheControl: '3600', upsert: false });
                if (storageError) {
                    showError(errorElementId, storageError.message || 'Failed to upload logo');
                    return null;
                }
                const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
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

            const { error: assocError } = await supabase.from('associations').insert(associationData);
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

    // Set up event listeners
    setupEventListeners();

    function setupEventListeners() {
        // Toggle buttons
        const loginTab = document.getElementById('login-tab');
        const signupTab = document.getElementById('signup-tab');
        const loginForm = document.getElementById('login-form');

        if (signupTab) {
            signupTab.addEventListener('click', () => {
                if (loginForm) loginForm.style.display = 'none';
                showModal('signup-role-modal');
            });
        }

        if (loginTab) {
            loginTab.addEventListener('click', () => {
                if (loginForm) loginForm.style.display = 'block';
                closeAllModals();
            });
        }

        // Role selection buttons
        const roleButtons = document.querySelectorAll('.signup-role-btn');
        roleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const role = button.getAttribute('data-role');
                const modalMap = {
                    'passenger': 'signup-passenger-modal',
                    'driver': 'signup-driver-modal',
                    'owner': 'signup-owner-modal',
                    'association': 'signup-association-modal'
                };
                if (modalMap[role]) {
                    showModal(modalMap[role]);
                }
            });
        });

        // Close buttons
        const closeButtons = document.querySelectorAll('.modal-close-btn, #signup-role-cancel, #modal-close-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.getAttribute('data-modal') || button.id === 'signup-role-cancel' ? 'signup-role-modal' : 'signup-modal';
                const modal = document.getElementById(modalId);
                if (modal) modal.style.display = 'none';
                if (loginForm) loginForm.style.display = 'block';
            });
        });

        // Login form submission
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email')?.value;
                const password = document.getElementById('login-password')?.value;
                const role = document.getElementById('login-role')?.value;

                if (!email || !password || !role) {
                    showError('login-error-message', 'Please fill in all fields');
                    return;
                }

                try {
                    await login(email, password, role);
                    window.location.href = '/dashboard.html';
                } catch (error) {
                    showError('login-error-message', error.message || 'Login failed');
                }
            });
        }

        // Passenger signup
        const passengerForm = document.getElementById('signup-passenger');
        if (passengerForm) {
            passengerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('passenger-email')?.value;
                const password = document.getElementById('passenger-password')?.value;

                try {
                    await signupSimple('passenger', { email, password });
                    showSuccess('Passenger account created successfully');
                    passengerForm.reset();
                } catch (error) {
                    showError('signup-passenger-error-message', error.message || 'Registration failed');
                }
            });
        }

        // Driver signup
        const driverForm = document.getElementById('signup-driver');
        if (driverForm) {
            driverForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('driver-email')?.value;
                const password = document.getElementById('driver-password')?.value;
                const licenseNumber = document.getElementById('driver-license-number')?.value;

                try {
                    await signupSimple('driver', { email, password, license_number: licenseNumber });
                    showSuccess('Driver account created successfully');
                    driverForm.reset();
                } catch (error) {
                    showError('signup-driver-error-message', error.message || 'Registration failed');
                }
            });
        }

        // Owner signup
        const ownerForm = document.getElementById('signup-owner');
        if (ownerForm) {
            ownerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('owner-email')?.value;
                const password = document.getElementById('owner-password')?.value;
                const companyName = document.getElementById('owner-company-name')?.value;

                try {
                    await signupSimple('owner', { email, password, company_name: companyName });
                    showSuccess('Owner account created successfully');
                    ownerForm.reset();
                } catch (error) {
                    showError('signup-owner-error-message', error.message || 'Registration failed');
                }
            });
        }

        // Association signup
        const associationForm = document.getElementById('signup-association');
        if (associationForm) {
            associationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = {
                    name: document.getElementById('association-name')?.value,
                    email: document.getElementById('association-email')?.value,
                    phone: document.getElementById('association-phone')?.value,
                    registrationNumber: document.getElementById('association-registration-number')?.value,
                    address: document.getElementById('association-address')?.value,
                    description: document.getElementById('association-description')?.value,
                    logo: document.getElementById('association-logo')?.files[0],
                    adminEmail: document.getElementById('admin-email')?.value,
                    adminPassword: document.getElementById('admin-password')?.value,
                    adminName: document.getElementById('admin-name')?.value,
                    adminPhone: document.getElementById('admin-phone')?.value,
                    adminIdNumber: document.getElementById('admin-id-number')?.value,
                    termsAccepted: document.getElementById('terms-accepted')?.checked
                };

                if (!formData.termsAccepted) {
                    showError('signup-association-error-message', 'You must accept the terms and conditions');
                    return;
                }

                const progressBar = document.getElementById('signup-progress-bar');
                const progressText = document.getElementById('signup-progress-text');
                const progressDiv = document.getElementById('signup-progress');

                if (progressBar && progressText && progressDiv) {
                    progressDiv.style.display = 'block';
                    progressText.textContent = 'Registering association...';
                    progressBar.style.width = '10%';
                }

                try {
                    await signupAssociation(formData);
                    if (progressBar && progressText) {
                        progressBar.style.width = '100%';
                        progressText.textContent = 'Registration complete!';
                    }
                    showSuccess('Association created successfully', `Login with: ${formData.adminEmail}`);
                    associationForm.reset();
                } catch (error) {
                    showError('signup-association-error-message', error.message || 'Registration failed');
                    if (progressDiv) progressDiv.style.display = 'none';
                }
            });
        }

        // Logo preview for association form
        const logoInput = document.getElementById('association-logo');
        const logoPreviewContainer = document.getElementById('logo-preview-container');
        const logoPreviewImg = document.getElementById('logo-preview-img');
        const removeLogoBtn = document.getElementById('remove-logo-btn');

        if (logoInput && logoPreviewContainer && logoPreviewImg && removeLogoBtn) {
            logoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        logoPreviewImg.src = e.target.result;
                        logoPreviewContainer.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
            });

            removeLogoBtn.addEventListener('click', () => {
                logoInput.value = '';
                logoPreviewContainer.style.display = 'none';
                logoPreviewImg.src = '';
            });
        }
    }
}
