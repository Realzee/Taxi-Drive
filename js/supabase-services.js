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

    // Initialize and assign functions to global scope
    const functions = initializeFunctions(supabase);
    if (functions) {
        Object.assign(window, functions);
        console.log('✅ All functions are now globally available');
        console.log('Available functions:', Object.keys(functions));
    } else {
        console.error('❌ Failed to initialize functions');
    }
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
            update: () => Promise.resolve({ error: new Error('Supabase not available') }),
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
    try {
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
                if (window.showModal) {
                    window.showModal('signup-modal');
                }
            }
        }

        async function createUserProfile(userId, email, role, additionalData = {}) {
            try {
                console.log('🔄 Creating user profile...');
                const profileData = {
                    id: userId,
                    email: email,
                    role: role,
                    profile_complete: false,
                    ...additionalData
                };

                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([profileData]);

                if (profileError) {
                    console.error('❌ Profile creation failed:', profileError);
                    return false;
                }

                console.log('✅ User profile created successfully');
                return true;
            } catch (error) {
                console.error('❌ Error creating profile:', error);
                return false;
            }
        }

        // In supabase-services.js - update the login function
async function login(email, password, role) {
    const errorElementId = 'login-error-message';
    
    console.log('🔐 LOGIN ATTEMPT STARTED ==========');

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

        console.log('✅ Auth successful! User ID:', authData.user.id);

        // Try to get or create profile with better error handling
        let profileData = await getOrCreateUserProfile(authData.user, email, role);
        if (!profileData) {
            showError(errorElementId, 'Unable to access user profile. Please contact administrator.');
            await supabase.auth.signOut();
            return null;
        }

        console.log('✅ Profile verified:', profileData);

        // Verify role
        if (profileData.role !== role) {
            console.error('❌ Role mismatch!');
            showError(errorElementId, `Invalid role. Your account is registered as ${profileData.role}, but you're trying to login as ${role}`);
            await supabase.auth.signOut();
            return null;
        }

        console.log('✅ Role verified successfully!');

        // Get association data if applicable
        let associationData = null;
        if (role === 'association') {
            associationData = await getAssociationData(profileData.id);
        }

        console.log('🎉 LOGIN SUCCESSFUL!');
        return {
            user: authData.user,
            role: profileData.role,
            association: associationData
        };

    } catch (err) {
        console.error('💥 UNEXPECTED LOGIN ERROR:', err);
        showError(errorElementId, 'An unexpected error occurred: ' + err.message);
        return null;
    }
}

async function getOrCreateUserProfile(user, email, role) {
    try {
        // Try to get existing profile
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (profileError) {
            if (profileError.code === 'PGRST116') {
                // Profile doesn't exist, try to create it
                console.log('🔄 Profile not found, creating one...');
                return await createUserProfileWithRLS(user.id, email, role);
            } else {
                console.error('❌ Profile query failed:', profileError);
                return null;
            }
        }

        return profileData;
    } catch (error) {
        console.error('❌ Error in getOrCreateUserProfile:', error);
        return null;
    }
}

async function createUserProfileWithRLS(userId, email, role) {
    try {
        // Try direct insertion first
        const { data, error } = await supabase
            .from('profiles')
            .insert([{
                id: userId,
                email: email,
                role: role,
                profile_complete: true
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ Profile creation failed (RLS likely blocking):', error);
            
            // If RLS is blocking, we can't proceed
            if (error.code === '42501') {
                throw new Error('Database permissions issue. Please contact administrator to set up proper RLS policies.');
            }
            throw error;
        }

        return data;
    } catch (error) {
        console.error('❌ Failed to create profile:', error);
        throw error;
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

                console.log('📝 Step 1: Creating auth account...');
                const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
                if (authError) {
                    showError(errorElementId, authError.message || 'Registration failed');
                    return null;
                }

                console.log('✅ Auth account created:', authData.user?.id);

                if (!authData.user) {
                    showError(errorElementId, 'User creation failed - no user data returned');
                    return null;
                }

                console.log('📝 Step 2: Creating profile record...');
                const profileData = {
                    id: authData.user.id,
                    email,
                    role,
                    profile_complete: true
                };
                
                // Add optional fields based on role
                if (license_number) profileData.license_number = license_number;
                if (company_name) profileData.company_name = company_name;

                const { error: profileError } = await supabase.from('profiles').insert(profileData);
                if (profileError) {
                    console.error('❌ Profile creation error:', profileError);
                    
                    // If profile already exists, try to update it
                    if (profileError.code === '23505') { // Unique violation
                        console.log('🔄 Profile already exists, updating role...');
                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update({ role: role })
                            .eq('id', authData.user.id);
                        
                        if (updateError) {
                            console.error('❌ Profile update failed:', updateError);
                            showError(errorElementId, 'Account exists but role update failed: ' + updateError.message);
                            return null;
                        }
                        console.log('✅ Profile updated successfully');
                    } else {
                        showError(errorElementId, profileError.message || 'Failed to save user profile');
                        return null;
                    }
                } else {
                    console.log('✅ Profile created successfully');
                }

                showSuccess(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`, `Login with: ${email}`);
                console.log(`${role} registered successfully`);
                return authData.user;
            } catch (err) {
                console.error(`${role} signup error:`, err);
                showError(errorElementId, err.message || 'An unexpected error occurred during registration');
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

                console.log('📝 Step 2: Creating admin profile record...');
                const profileRecord = {
                    id: adminId,
                    email: adminEmail.trim().toLowerCase(),
                    name: adminName,
                    phone: adminPhone,
                    role: 'association',
                    profile_complete: true
                };

                const { data: profileResult, error: profileError } = await supabase
                    .from('profiles')
                    .insert([profileRecord])
                    .select();

                if (profileError) {
                    console.error('❌ Profile record creation error:', profileError);
                    
                    // If profile already exists, try to update it
                    if (profileError.code === '23505') {
                        console.log('🔄 Profile already exists, updating...');
                        const { error: updateError } = await supabase
                            .from('profiles')
                            .update({
                                name: adminName,
                                phone: adminPhone,
                                role: 'association',
                                profile_complete: true
                            })
                            .eq('id', adminId);
                        
                        if (updateError) {
                            showError(errorElementId, `Failed to update existing profile: ${updateError.message}`);
                            await supabase.auth.admin.deleteUser(adminId);
                            return null;
                        }
                        console.log('✅ Profile updated successfully');
                    } else {
                        showError(errorElementId, `Failed to save admin profile: ${profileError.message}`);
                        await supabase.auth.admin.deleteUser(adminId);
                        return null;
                    }
                } else {
                    console.log('✅ Admin profile record created:', profileResult);
                }

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
                    association_name: name,
                    email,
                    phone,
                    address,
                    admin_id: adminId,
                    admin_name: adminName,
                    admin_phone: adminPhone,
                    description: description,
                    logo_url: logoUrl
                };

                if (registrationNumber) associationData.registration_number = registrationNumber;

                const { data: associationResult, error: assocError } = await supabase
                    .from('associations')
                    .insert([associationData])
                    .select()
                    .single();

                if (assocError) {
                    console.error('❌ Association creation error:', assocError);
                    showError(errorElementId, `Failed to save association data: ${assocError.message}`);
                    // Don't delete the user profile as it might be used for other purposes
                    return null;
                }

                console.log('✅ Association created successfully:', associationResult);

                if (window.showModal) {
                    window.showModal('signup-modal');
                }
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

        // Setup event listeners for the login page
        function setupEventListeners() {
            const loginTab = document.getElementById('login-tab');
            const signupTab = document.getElementById('signup-tab');
            const loginForm = document.getElementById('login-form');

            if (signupTab) {
                signupTab.addEventListener('click', () => {
                    if (loginForm) loginForm.style.display = 'none';
                    if (window.showModal) {
                        window.showModal('signup-role-modal');
                    }
                });
            }

            if (loginTab) {
                loginTab.addEventListener('click', () => {
                    if (loginForm) loginForm.style.display = 'block';
                    if (window.closeAllModals) {
                        window.closeAllModals();
                    }
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
                    if (modalMap[role] && window.showModal) {
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
                    if (window.closeAllModals) {
                        window.closeAllModals();
                    }
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

        // Return the functions to be made globally available
        return {
            login,
            signupSimple,
            signupAssociation,
            showError,
            showSuccess
        };

    } catch (error) {
        console.error('❌ Error initializing functions:', error);
        return null;
    }
}
