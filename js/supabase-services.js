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
    const functions = initializeFunctions(supabase);
    
    // Make all functions globally available
    Object.assign(window, functions);

    console.log('✅ All functions are now globally available');
    console.log('Available functions:', Object.keys(functions));
}

function createFallbackClient() {
    return {
        auth: { 
            signInWithPassword: () => Promise.resolve({ error: new Error('Supabase not available') }),
            signUp: () => Promise.resolve({ error: new Error('Supabase not available') }),
            signOut: () => Promise.resolve({ error: new Error('Supabase not available') }),
            admin: {
                deleteUser: () => Promise.resolve({ error: new Error('Supabase not available') })
            }
        },
        from: () => ({ 
            select: () => ({ 
                single: () => Promise.resolve({ error: new Error('Supabase not available') }) 
            }),
            insert: () => Promise.resolve({ error: new Error('Supabase not available') }),
            delete: () => Promise.resolve({ error: new Error('Supabase not available') })
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
            if (modal) {
                modal.style.display = 'none';
            }
        });
        
        // Always ensure login form is visible
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.style.display = 'block';
        }
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
            
            // Auto-hide error after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
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

    // Enhanced Login function with detailed debugging
    async function login(email, password, role) {
        const errorElementId = 'login-error-message';
        
        console.log('🔐 LOGIN ATTEMPT STARTED ==========');
        console.log('📧 Email:', email);
        console.log('🔑 Password length:', password ? password.length : 0);
        console.log('👤 Requested role:', role);
        console.log('⏰ Time:', new Date().toLocaleString());

        try {
            // Step 1: Supabase Authentication
            console.log('🔄 Step 1: Authenticating with Supabase Auth...');
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
                email: email, 
                password: password 
            });

            if (authError) {
                console.error('❌ Auth failed:', authError);
                console.log('🔍 Auth error details:', {
                    message: authError.message,
                    status: authError.status,
                    name: authError.name
                });
                showError(errorElementId, authError.message || 'Authentication failed');
                return null;
            }

            console.log('✅ Auth successful!');
            console.log('👤 User ID:', authData.user.id);
            console.log('📧 User email:', authData.user.email);

            // Step 2: Verify user exists in users table
            console.log('🔄 Step 2: Checking user role in database...');
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, email, role, association_approved, status, name, created_at')
                .eq('email', email)
                .single();

            if (userError) {
                console.error('❌ Database query failed:', userError);
                console.log('🔍 User error details:', userError);
                
                // Check if user doesn't exist in users table
                if (userError.code === 'PGRST116') { // No rows returned
                    console.log('⚠️ User exists in auth but not in users table!');
                    showError(errorElementId, 'User account not properly set up. Please contact support.');
                } else {
                    showError(errorElementId, 'Database error: ' + userError.message);
                }
                
                // Sign out since we can't verify the role
                await supabase.auth.signOut();
                return null;
            }

            console.log('✅ User found in database:', userData);

            // Step 3: Verify role matches
            console.log('🔄 Step 3: Verifying role...');
            console.log('📋 User role in DB:', userData.role);
            console.log('🎯 Expected role:', role);

            if (userData.role !== role) {
                console.error('❌ Role mismatch!');
                showError(errorElementId, `Invalid role. Your account is registered as ${userData.role}, but you're trying to login as ${role}`);
                await supabase.auth.signOut();
                return null;
            }
            console.log('✅ Role verified successfully!');

            // Step 4: Additional checks for associations
            if (role === 'association') {
                console.log('🔄 Step 4: Additional association checks...');
                console.log('✅ Association approved:', userData.association_approved);
                console.log('✅ Account status:', userData.status);

                if (!userData.association_approved) {
                    showError(errorElementId, 'Association account is pending approval. Please contact administrator.');
                    await supabase.auth.signOut();
                    return null;
                }

                if (userData.status !== 'active') {
                    showError(errorElementId, `Association account is ${userData.status}. Please contact administrator.`);
                    await supabase.auth.signOut();
                    return null;
                }
                console.log('✅ Association checks passed!');
            }

            // Step 5: Login successful
            console.log('🎉 LOGIN SUCCESSFUL!');
            console.log('👤 Logged in as:', userData.name || userData.email);
            console.log('🔑 Role:', userData.role);
            console.log('🆔 User ID:', userData.id);
            console.log('================================');

            return authData.user;

        } catch (err) {
            console.error('💥 UNEXPECTED LOGIN ERROR:', err);
            console.error('🔍 Error details:', {
                name: err.name,
                message: err.message,
                stack: err.stack
            });
            showError(errorElementId, 'An unexpected error occurred: ' + err.message);
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

        console.log('🔍 Starting association registration...');
        console.log('Form data received:', {
            name, email, phone, registrationNumber, address, description,
            logoFile: logoFile ? `File: ${logoFile.name} (${logoFile.size} bytes)` : 'No file',
            adminEmail, adminPassword: '***', adminName, adminPhone, adminIdNumber
        });

        try {
            // Validate password length
            if (adminPassword.length < 8) {
                showError(errorElementId, 'Administrator password must be at least 8 characters long');
                return null;
            }

            console.log('📝 Step 1: Creating admin auth account...');

            // Sign up admin
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: adminEmail,
                password: adminPassword
            });

            if (authError) {
                console.error('❌ Auth signup error:', authError);
                showError(errorElementId, authError.message || 'Admin registration failed');
                return null;
            }

            console.log('✅ Admin auth account created:', authData.user.id);

            const adminId = authData.user.id;

            // Insert admin as user
            console.log('📝 Step 2: Creating admin user record...');
            const { error: userError } = await supabase.from('users').insert({
                id: adminId,
                email: adminEmail,
                name: adminName,
                phone: adminPhone,
                role: 'association',
                association_approved: true, // Auto-approve association admin
                status: 'active',
                created_at: new Date().toISOString()
            });

            if (userError) {
                console.error('❌ User record creation error:', userError);
                showError(errorElementId, userError.message || 'Failed to save admin user data');
                
                // Clean up: delete the auth account if user record fails
                await supabase.auth.admin.deleteUser(adminId);
                return null;
            }

            console.log('✅ Admin user record created');

            // Upload logo if provided
            let logoUrl = null;
            if (logoFile) {
                console.log('📝 Step 3: Uploading logo...');
                try {
                    const fileName = `${adminId}/${Date.now()}_${logoFile.name}`;
                    const { data: storageData, error: storageError } = await supabase.storage
                        .from('logos')
                        .upload(fileName, logoFile, { 
                            cacheControl: '3600', 
                            upsert: false 
                        });

                    if (storageError) {
                        console.error('❌ Logo upload error:', storageError);
                        // Continue without logo - don't fail the entire registration
                    } else {
                        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
                        logoUrl = publicUrlData.publicUrl;
                        console.log('✅ Logo uploaded:', logoUrl);
                    }
                } catch (uploadError) {
                    console.error('❌ Logo upload failed:', uploadError);
                    // Continue without logo
                }
            }

            // Insert association data
            console.log('📝 Step 4: Creating association record...');
            const associationData = {
                name: name,
                email: email,
                phone: phone,
                address: address,
                admin_id: adminId,
                admin_name: adminName,
                admin_phone: adminPhone,
                admin_id_number: adminIdNumber,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Add optional fields if they have values
            if (registrationNumber) associationData.registration_number = registrationNumber;
            if (description) associationData.description = description;
            if (logoUrl) associationData.logo_url = logoUrl;

            console.log('Association data to insert:', associationData);

            const { data: associationResult, error: assocError } = await supabase
                .from('associations')
                .insert([associationData])
                .select();

            if (assocError) {
                console.error('❌ Association creation error:', assocError);
                showError(errorElementId, assocError.message || 'Failed to save association data');
                
                // Clean up: delete user record and auth account
                await supabase.from('users').delete().eq('id', adminId);
                await supabase.auth.admin.deleteUser(adminId);
                return null;
            }

            console.log('✅ Association created successfully:', associationResult);

            showSuccess('Association created successfully', `Login with: ${adminEmail}`);
            console.log('🎉 Association registration completed successfully!');
            return authData.user;

        } catch (err) {
            console.error('❌ Unexpected error in signupAssociation:', err);
            showError(errorElementId, err.message || 'An unexpected error occurred during association registration');
            return null;
        }
    }

    // Set up event listeners
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
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Close button clicked:', button.id || button.className);
                
                let modalId;
                if (button.classList.contains('modal-close-btn')) {
                    modalId = button.getAttribute('data-modal');
                } else if (button.id === 'signup-role-cancel') {
                    modalId = 'signup-role-modal';
                } else if (button.id === 'modal-close-btn') {
                    modalId = 'signup-modal';
                }
                
                console.log('Closing modal:', modalId);
                
                if (modalId) {
                    const modal = document.getElementById(modalId);
                    if (modal) {
                        modal.style.display = 'none';
                        console.log('Modal closed successfully');
                    }
                }
                
                if (loginForm) {
                    loginForm.style.display = 'block';
                }
                
                closeAllModals();
            });
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                console.log('Clicked outside modal, closing:', e.target.id);
                e.target.style.display = 'none';
                if (loginForm) loginForm.style.display = 'block';
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                console.log('ESC key pressed, closing all modals');
                closeAllModals();
                if (loginForm) loginForm.style.display = 'block';
            }
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
                    const user = await login(email, password, role);
                    if (user) {
                        window.location.href = '/dashboard.html';
                    }
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

    // Initialize event listeners
    setupEventListeners();

    // Return all functions to be made globally available
    return {
        login,
        signupSimple,
        signupAssociation,
        showError,
        showSuccess,
        closeAllModals,
        showModal
    };
}

function debugModals() {
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
        console.log(`${id}:`, modal ? getComputedStyle(modal).display : 'NOT FOUND');
    });
    
    const loginForm = document.getElementById('login-form');
    console.log('Login form:', loginForm ? getComputedStyle(loginForm).display : 'NOT FOUND');
}

// Make it globally available for debugging
window.debugModals = debugModals;
