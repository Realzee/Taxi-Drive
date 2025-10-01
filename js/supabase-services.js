document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Supabase client...');
    initializeApp();
});

function initializeApp() {
    const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
    
    let supabase;
    
    try {
        if (typeof window.supabase !== 'undefined') {
            const { createClient } = window.supabase;
            supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error('Supabase CDN not loaded');
            supabase = createFallbackClient();
        }
        console.log('Supabase client initialized successfully');
    } catch (error) {
        console.error('Supabase initialization failed:', error);
        supabase = createFallbackClient();
    }

    const functions = initializeFunctions(supabase);
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
                getPublicUrl: () => ({ data: { publicUrl: '' } })
            })
        }
    };
}

function initializeFunctions(supabase) {
    function showError(elementId, message) {
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
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const modalLoginDetails = document.getElementById('modal-login-details');
        if (modalTitle && modalMessage && modalLoginDetails) {
            modalTitle.textContent = 'Success!';
            modalMessage.textContent = message;
            modalLoginDetails.textContent = loginDetails;
            window.showModal('signup-modal'); // Use showModal from script.js
        }
    }

    async function login(email, password, role) {
        const errorElementId = 'login-error-message';
        
        console.log('🔐 LOGIN ATTEMPT STARTED ==========');
        console.log('📧 Email:', email);
        console.log('🔑 Password length:', password ? password.length : 0);
        console.log('👤 Requested role:', role);
        console.log('⏰ Time:', new Date().toLocaleString());

        try {
            console.log('🔄 Step 1: Authenticating with Supabase Auth...');
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
                email, 
                password 
            });

            if (authError) {
                console.error('❌ Auth failed:', authError);
                showError(errorElementId, authError.message || 'Authentication failed');
                return null;
            }

            console.log('✅ Auth successful!');
            console.log('👤 User ID:', authData.user.id);

            console.log('🔄 Step 2: Checking user role in database...');
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, email, role, association_approved, status, name, created_at')
                .eq('email', email)
                .single();

            if (userError) {
                console.error('❌ Database query failed:', userError);
                if (userError.code === 'PGRST116') {
                    showError(errorElementId, 'User account not properly set up. Please contact support.');
                } else {
                    showError(errorElementId, 'Database error: ' + userError.message);
                }
                await supabase.auth.signOut();
                return null;
            }

            console.log('✅ User found in database:', userData);

            console.log('🔄 Step 3: Verifying role...');
            if (userData.role !== role) {
                console.error('❌ Role mismatch!');
                showError(errorElementId, `Invalid role. Your account is registered as ${userData.role}, but you're trying to login as ${role}`);
                await supabase.auth.signOut();
                return null;
            }
            console.log('✅ Role verified successfully!');

            let associationData = null;
            if (role === 'association') {
                console.log('🔄 Step 4: Additional association checks...');
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

                console.log('🔄 Fetching association data...');
                const { data: assocData, error: assocError } = await supabase
                    .from('associations')
                    .select('name, logo_url')
                    .eq('admin_id', userData.id)
                    .single();

                if (assocError) {
                    console.error('❌ Failed to fetch association data:', assocError);
                    showError(errorElementId, 'Failed to load association data.');
                    await supabase.auth.signOut();
                    return null;
                }

                associationData = assocData;
                console.log('✅ Association data fetched:', associationData);
            }

            console.log('🎉 LOGIN SUCCESSFUL!');
            return {
                user: authData.user,
                role: userData.role,
                association: associationData
            };

        } catch (err) {
            console.error('💥 UNEXPECTED LOGIN ERROR:', err);
            showError(errorElementId, 'An unexpected error occurred: ' + err.message);
            return null;
        }
    }

    async function signupSimple(role, formData) {
        const { email, password, license_number, company_name } = formData;
        const errorElementId = `signup-${role}-error-message`;

        try {
            if (password.length < 8) {
                showError(errorElementId, 'Password must be at least 8 characters long');
                return null;
            }

            const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
            if (authError) {
                showError(errorElementId, authError.message || 'Registration failed');
                return null;
            }

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
                await supabase.auth.admin.deleteUser(authData.user.id);
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

    async function signupAssociation(formData) {
        const {
            name, email, phone, registrationNumber, address, description,
            logo, adminEmail, adminPassword, adminName, adminPhone, adminIdNumber,
            termsAccepted
        } = formData;
        const errorElementId = 'signup-association-error-message';

        console.log('🔍 Starting association registration...');
        console.log('Form data received:', {
            name, email, phone, registrationNumber, address, description,
            logo: logo ? `File: ${logo.name}` : 'No file',
            adminEmail, adminPassword: '***', 
            adminName, adminPhone, adminIdNumber,
            termsAccepted
        });

        try {
            if (!termsAccepted) {
                showError(errorElementId, 'You must accept the terms and conditions');
                return null;
            }

            if (!adminPassword || adminPassword.length < 8) {
                showError(errorElementId, 'Administrator password must be at least 8 characters long');
                return null;
            }

            const requiredFields = [
                { field: adminEmail, name: 'Admin Email' },
                { field: adminPassword, name: 'Admin Password' },
                { field: adminName, name: 'Admin Name' },
                { field: name, name: 'Association Name' },
                { field: email, name: 'Association Email' }
            ];

            const missingFields = requiredFields.filter(item => !item.field || item.field.trim() === '');
            if (missingFields.length > 0) {
                showError(errorElementId, `Missing required fields: ${missingFields.map(f => f.name).join(', ')}`);
                return null;
            }

            if (logo && logo.size > 2 * 1024 * 1024) {
                showError(errorElementId, 'Logo file size exceeds 2MB limit');
                return null;
            }

            console.log('📝 Step 1: Creating admin auth account...');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: adminEmail.trim().toLowerCase(),
                password: adminPassword,
                options: {
                    data: {
                        name: adminName,
                        role: 'association'
                    }
                }
            });

            if (authError || !authData.user) {
                console.error('❌ Auth signup error:', authError);
                showError(errorElementId, `Admin registration failed: ${authError?.message || 'No user data returned'}`);
                return null;
            }

            const adminId = authData.user.id;
            console.log('✅ Admin auth account created:', adminId);

            console.log('📝 Step 2: Creating admin user record...');
            const userRecord = {
                id: adminId,
                email: adminEmail.trim().toLowerCase(),
                name: adminName,
                phone: adminPhone,
                role: 'association',
                association_approved: true,
                status: 'active',
                created_at: new Date().toISOString()
            };

            const { data: userResult, error: userError } = await supabase
                .from('users')
                .insert([userRecord])
                .select();

            if (userError) {
                console.error('❌ User record creation error:', userError);
                showError(errorElementId, `Failed to save admin user data: ${userError.message}`);
                await supabase.auth.admin.deleteUser(adminId);
                return null;
            }

            console.log('✅ Admin user record created:', userResult);

            let logoUrl = null;
            if (logo) {
                console.log('📝 Step 3: Uploading logo...');
                const fileName = `associations/${name}-${Date.now()}.${logo.name.split('.').pop()}`;
                const { data: storageData, error: storageError } = await supabase.storage
                    .from('logos')
                    .upload(fileName, logo, { 
                        cacheControl: '3600', 
                        upsert: false 
                    });

                if (storageError) {
                    console.error('❌ Logo upload error:', storageError);
                    console.log('⚠️ Continuing without logo');
                } else {
                    const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
                    logoUrl = publicUrlData.publicUrl;
                    console.log('✅ Logo uploaded:', logoUrl);
                }
            }

            console.log('📝 Step 4: Creating association record...');
            const associationData = {
                name,
                email,
                phone,
                address,
                admin_id: adminId,
                admin_name: adminName,
                admin_phone: adminPhone,
                admin_id_number: adminIdNumber,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                logo_url: logoUrl
            };

            if (registrationNumber) associationData.registration_number = registrationNumber;
            if (description) associationData.description = description;

            const { data: associationResult, error: assocError } = await supabase
                .from('associations')
                .insert([associationData])
                .select()
                .single();

            if (assocError) {
                console.error('❌ Association creation error:', assocError);
                showError(errorElementId, `Failed to save association data: ${assocError.message}`);
                await supabase.from('users').delete().eq('id', adminId);
                await supabase.auth.admin.deleteUser(adminId);
                return null;
            }

            console.log('✅ Association created successfully:', associationResult);

            window.showModal('signup-association-modal'); // Show the association modal
            showSuccess(
                'Association registration completed successfully!', 
                `Login with:\nEmail: ${adminEmail}\nPassword: [Your Password]`
            );

            document.getElementById('signup-association').reset();
            const progressDiv = document.getElementById('signup-progress');
            if (progressDiv) progressDiv.style.display = 'none';

            return {
                user: authData.user,
                association: associationResult
            };

        } catch (err) {
            console.error('❌ UNEXPECTED ERROR in signupAssociation:', err);
            showError(errorElementId, `An unexpected error occurred: ${err.message}`);
            return null;
        }
    }

    function setupEventListeners() {
        const loginTab = document.getElementById('login-tab');
        const signupTab = document.getElementById('signup-tab');
        const loginForm = document.getElementById('login-form');

        if (signupTab) {
            signupTab.addEventListener('click', () => {
                if (loginForm) loginForm.style.display = 'none';
                window.showModal('signup-role-modal');
            });
        }

        if (loginTab) {
            loginTab.addEventListener('click', () => {
                if (loginForm) loginForm.style.display = 'block';
                window.closeAllModals();
            });
        }

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
                    window.showModal(modalMap[role]);
                }
            });
        });

        const closeButtons = document.querySelectorAll('.modal-close-btn, #signup-role-cancel, #modal-close-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                let modalId = button.getAttribute('data-modal') || 
                             (button.id === 'signup-role-cancel' ? 'signup-role-modal' : 
                             button.id === 'modal-close-btn' ? 'signup-modal' : null);
                if (modalId) {
                    const modal = document.getElementById(modalId);
                    if (modal) modal.style.display = 'none';
                    if (loginForm) loginForm.style.display = 'block';
                    document.body.style.overflow = 'auto';
                }
            });
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.style.display = 'none';
                if (loginForm) loginForm.style.display = 'block';
                document.body.style.overflow = 'auto';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.closeAllModals();
                if (loginForm) loginForm.style.display = 'block';
            }
        });

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
                    const result = await login(email, password, role);
                    if (result) {
                        window.updateWelcomeSection(result); // Call updateWelcomeSection from script.js
                        if (role === 'association') {
                            window.location.href = './association-dashboard.html';
                        }
                    }
                } catch (error) {
                    showError('login-error-message', error.message || 'Login failed');
                }
            });
        }

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

                const progressBar = document.getElementById('signup-progress-bar');
                const progressText = document.getElementById('signup-progress-text');
                const progressDiv = document.getElementById('signup-progress');

                if (progressBar && progressText && progressDiv) {
                    progressDiv.style.display = 'block';
                    progressText.textContent = 'Starting registration...';
                    progressBar.style.width = '10%';
                }

                try {
                    if (progressBar && progressText) {
                        progressText.textContent = 'Creating admin account...';
                        progressBar.style.width = '25%';
                    }

                    const result = await signupAssociation(formData);

                    if (result) {
                        if (progressBar && progressText) {
                            progressBar.style.width = '100%';
                            progressText.textContent = 'Registration complete!';
                            setTimeout(() => {
                                progressDiv.style.display = 'none';
                            }, 2000);
                        }
                    } else {
                        if (progressDiv) progressDiv.style.display = 'none';
                    }
                } catch (error) {
                    showError('signup-association-error-message', error.message || 'Registration failed');
                    if (progressDiv) progressDiv.style.display = 'none';
                }
            });
        }

        const logoInput = document.getElementById('association-logo');
        const logoPreviewContainer = document.getElementById('logo-preview-container');
        const logoPreviewImg = document.getElementById('logo-preview-img');
        const removeLogoBtn = document.getElementById('remove-logo-btn');
        const logoInfo = document.getElementById('logo-info');

        if (logoInput && logoPreviewContainer && logoPreviewImg && removeLogoBtn && logoInfo) {
            logoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        showError('signup-association-error-message', 'Logo file size exceeds 2MB limit');
                        logoInput.value = '';
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        logoPreviewImg.src = e.target.result;
                        logoPreviewContainer.style.display = 'block';
                        logoInfo.textContent = `File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
                    };
                    reader.readAsDataURL(file);
                }
            });

            removeLogoBtn.addEventListener('click', () => {
                logoInput.value = '';
                logoPreviewContainer.style.display = 'none';
                logoPreviewImg.src = '';
                logoInfo.textContent = '';
            });
        }
    }

    setupEventListeners();

    return {
        login,
        signupSimple,
        signupAssociation,
        showError,
        showSuccess
    };
}