// Supabase Services - Centralized Supabase operations for Association Dashboard
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
const API_BASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co'; // Replace with your server endpoint base URL

// Initialize Supabase client
let supabase;
function initializeSupabase() {
    try {
        if (typeof window.supabase !== 'undefined') {
            const { createClient } = window.supabase;
            supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase client initialized successfully');
        } else {
            console.error('Supabase CDN not loaded');
            supabase = createFallbackClient();
        }
    } catch (error) {
        console.error('Supabase initialization failed:', error);
        supabase = createFallbackClient();
    }
}

function createFallbackClient() {
    return {
        auth: {
            signInWithPassword: () => Promise.resolve({ error: new Error('Supabase not available') }),
            signUp: () => Promise.resolve({ error: new Error('Supabase not available') }),
            signOut: () => Promise.resolve({ error: new Error('Supabase not available') }),
            getUser: () => Promise.resolve({ error: new Error('Supabase not available') })
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

// Demo data for fallback
const demoData = {
    members: [
        {
            id: 'demo-member-1',
            name: 'John Driver',
            email: 'john@taxi.com',
            phone: '+27 82 111 2222',
            role: 'driver',
            verified: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-member-2',
            name: 'Sarah Owner',
            email: 'sarah@taxi.com',
            phone: '+27 82 333 4444',
            role: 'owner',
            verified: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-member-3',
            name: 'Mike Member',
            email: 'mike@taxi.com',
            phone: '+27 82 555 6666',
            role: 'member',
            verified: false,
            created_at: new Date().toISOString()
        }
    ],
    routes: [
        {
            id: 'demo-route-1',
            route_name: 'City Center Route',
            origin: 'Downtown',
            destination: 'City Center',
            schedule: 'Daily 6AM-10PM',
            status: 'active',
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-route-2',
            route_name: 'Airport Express',
            origin: 'Central Station',
            destination: 'International Airport',
            schedule: 'Every 30 mins',
            status: 'active',
            created_at: new Date().toISOString()
        }
    ],
    association: {
        id: 'demo-mode',
        association_name: 'My Taxi Association',
        email: 'demo@taxi.com',
        phone: '+27 12 345 6789',
        address: '123 Main Street, Johannesburg',
        admin_id: 'demo-admin',
        admin_name: 'Demo Admin',
        admin_phone: '+27 82 123 4567',
        description: 'Your taxi association management dashboard',
        logo_url: null,
        wallet_balance: 12500.50,
        is_demo: true
    },
    vehicles: [
        { id: 'demo-vehicle-1', registration_number: 'ABC123GP', latitude: -26.2041, longitude: 28.0473 },
        { id: 'demo-vehicle-2', registration_number: 'XYZ789GP', latitude: -26.2000, longitude: 28.0500 }
    ]
};

// Utility Functions
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

// Authentication Services
async function checkAssociationAuthentication() {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.log('No authenticated user:', authError?.message || 'No user found');
            throw new Error('No authenticated user');
        }

        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError || profileData?.role !== 'association') {
            console.log(`Profile error or role mismatch: ${profileError?.message || 'Role not association'}`);
            throw new Error('Invalid user role or profile');
        }

        return { ...user, ...profileData };
    } catch (error) {
        console.error('Authentication check error:', error);
        throw error;
    }
}

async function login(email, password, selectedRole) {
    console.log('🔐 LOGIN ATTEMPT STARTED ==========');
    try {
        console.log('🔄 Step 1: Authenticating with Supabase Auth...');
        const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError || !user) {
            console.error('❌ Auth error:', authError?.message);
            throw new Error(authError?.message || 'Authentication failed');
        }

        console.log('✅ Auth successful! User ID:', user.id);

        console.log('🔄 Step 2: Verifying profile role...');
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError || !profileData) {
            console.error('❌ Profile error:', profileError?.message);
            throw new Error('Profile not found');
        }

        console.log('✅ Profile verified:', profileData);

        if (!['association', 'owner', 'driver', 'passenger'].includes(profileData.role)) {
            console.error('❌ Invalid role:', profileData.role);
            throw new Error('Invalid user role');
        }

        if (selectedRole && profileData.role !== selectedRole) {
            console.error('❌ Role mismatch:', { selected: selectedRole, actual: profileData.role });
            throw new Error(`Please select the correct role: ${profileData.role}`);
        }

        console.log('✅ Role verified successfully!');

        if (profileData.role === 'association') {
            console.log('🔄 Step 3: Fetching association data...');
            const association = await getAssociationByAdminId(user.id);
            if (!association) {
                console.error('❌ No association found for user');
                throw new Error('No association found');
            }
            console.log('✅ Association found:', association);
            return { redirect: 'association-dashboard.html', user: { ...user, ...profileData, association } };
        } else if (profileData.role === 'owner') {
            console.log('✅ Owner user, redirecting to owner dashboard');
            return { redirect: 'owner-dashboard.html', user: { ...user, ...profileData } };
        } else if (profileData.role === 'driver') {
            console.log('✅ Driver user, redirecting to driver dashboard');
            return { redirect: 'driver-dashboard.html', user: { ...user, ...profileData } };
        } else {
            console.log('✅ Passenger user, redirecting to passenger dashboard');
            return { redirect: 'passenger-dashboard.html', user: { ...user, ...profileData } };
        }
    } catch (error) {
        console.error('💥 UNEXPECTED LOGIN ERROR:', error);
        throw error;
    }
}
async function getOrCreateUserProfile(user, email, role) {
    try {
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();

        if (profileError) {
            if (profileError.code === 'PGRST116') {
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

async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        console.log('User signed out successfully');
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
}

async function manageMemberAuth(email, password, memberId = null) {
    try {
        const response = await fetch(`${API_BASE_URL}/manage-member-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, memberId })
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('Error in manageMemberAuth:', result.error);
            throw new Error(result.error || 'Failed to manage member authentication');
        }
        console.log(memberId ? 'Auth user updated:' : 'Auth user created:', result.memberId);
        return result.memberId;
    } catch (error) {
        console.error('Error in manageMemberAuth:', error);
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

        if (license_number) profileData.license_number = license_number;
        if (company_name) profileData.company_name = company_name;

        const { error: profileError } = await supabase.from('profiles').insert(profileData);
        if (profileError) {
            console.error('❌ Profile creation error:', profileError);
            if (profileError.code === '23505') {
                console.log('🔄 Profile already exists, updating role...');
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role: role })
                    .eq('id', authData.user.id);

                if (updateError) {
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
                    await fetch(`${API_BASE_URL}/delete-user`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: adminId })
                    });
                    return null;
                }
                console.log('✅ Profile updated successfully');
            } else {
                showError(errorElementId, `Failed to save admin profile: ${profileError.message}`);
                await fetch(`${API_BASE_URL}/delete-user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: adminId })
                });
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
            return null;
        }

        console.log('✅ Association created successfully:', associationResult);
        showSuccess(
            'Association registration completed successfully!',
            `Login with:\nEmail: ${adminEmail}\nPassword: [Your Password]`
        );

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

// Association Services
async function getAssociationByAdminId(adminId, isDemo = false) {
    if (isDemo) {
        return demoData.association;
    }

    try {
        const { data, error } = await supabase
            .from('associations')
            .select('*')
            .eq('admin_id', adminId)
            .single();

        if (error) {
            console.error('Error fetching association:', error);
            throw error;
        }
        return data;
    } catch (error) {
        console.error('Error in getAssociationByAdminId:', error);
        throw error;
    }
}

async function createAssociation(adminId, adminEmail, adminName) {
    try {
        const newAssociation = {
            association_name: 'My Taxi Association',
            email: adminEmail,
            phone: '',
            address: '',
            admin_id: adminId,
            admin_name: adminName || adminEmail.split('@')[0],
            admin_phone: '',
            description: '',
            logo_url: null,
            wallet_balance: 0
        };

        const { data, error } = await supabase
            .from('associations')
            .insert([newAssociation])
            .select()
            .single();

        if (error) {
            console.error('Failed to create association:', error);
            throw error;
        }
        return data;
    } catch (error) {
        console.error('Error in createAssociation:', error);
        throw error;
    }
}

async function updateAssociation(associationId, updateData, isDemo = false) {
    if (isDemo) {
        Object.assign(demoData.association, updateData);
        return demoData.association;
    }

    try {
        const { error } = await supabase
            .from('associations')
            .update(updateData)
            .eq('id', associationId);
        if (error) throw error;
        return await getAssociationById(associationId);
    } catch (error) {
        console.error('Error in updateAssociation:', error);
        throw error;
    }
}

async function getAssociationById(associationId) {
    try {
        const { data, error } = await supabase
            .from('associations')
            .select('*')
            .eq('id', associationId)
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in getAssociationById:', error);
        throw error;
    }
}

async function uploadLogo(associationId, logoFile, isDemo = false) {
    if (isDemo) {
        return demoData.association.logo_url;
    }

    try {
        if (logoFile.size > 2 * 1024 * 1024) {
            throw new Error('Logo file size exceeds 2MB limit');
        }

        const fileName = `${associationId}/${Date.now()}_${logoFile.name}`;
        const { error: storageError } = await supabase.storage
            .from('logos')
            .upload(fileName, logoFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (storageError) {
            console.error('Logo upload error:', storageError);
            throw storageError;
        }

        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('Error in uploadLogo:', error);
        throw error;
    }
}

// Member Services
async function getRecentMembers(associationId, isDemo = false) {
    if (isDemo) {
        return demoData.members.slice(0, 3);
    }

    try {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('association_id', associationId)
            .order('created_at', { ascending: false })
            .limit(3);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error in getRecentMembers:', error);
        throw error;
    }
}

async function addMember(associationId, formData, isDemo = false) {
    if (isDemo) {
        const newMember = {
            id: `demo-member-${Date.now()}`,
            ...formData,
            created_at: new Date().toISOString()
        };
        demoData.members.unshift(newMember);
        return newMember;
    }

    try {
        const memberId = await manageMemberAuth(formData.email, formData.password);
        if (!memberId) {
            throw new Error('Failed to create member authentication');
        }

        const profileData = {
            id: memberId,
            email: formData.email,
            role: formData.role || 'owner',
            profile_complete: true
        };

        const { error: profileError } = await supabase
            .from('profiles')
            .insert([profileData]);

        if (profileError) {
            console.error('Profile creation failed:', profileError);
            await fetch(`${API_BASE_URL}/delete-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: memberId })
            });
            throw new Error('Failed to create member profile: ' + profileError.message);
        }

        const memberData = {
            association_id: associationId,
            id: memberId,
            email: formData.email,
            name: formData.name,
            phone: formData.phone || '',
            role: formData.role || 'owner',
            verified: formData.verified || false
        };

        const { error: memberError } = await supabase
            .from('members')
            .insert([memberData]);

        if (memberError) {
            console.error('Member creation failed:', memberError);
            await fetch(`${API_BASE_URL}/delete-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: memberId })
            });
            await supabase.from('profiles').delete().eq('id', memberId);
            throw new Error('Failed to add member: ' + memberError.message);
        }

        return memberData;
    } catch (error) {
        console.error('Error in addMember:', error);
        throw error;
    }
}

async function getMemberById(memberId, associationId, isDemo = false) {
    if (isDemo) {
        return demoData.members.find(m => m.id === memberId) || null;
    }

    try {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('id', memberId)
            .eq('association_id', associationId);
        
        if (error) {
            console.error('Error fetching member:', error);
            throw error;
        }
        
        return data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Error in getMemberById:', error);
        throw error;
    }
}

async function updateMember(memberId, associationId, formData, isDemo = false) {
    if (isDemo) {
        const memberIndex = demoData.members.findIndex(m => m.id === memberId);
        if (memberIndex !== -1) {
            demoData.members[memberIndex] = { ...demoData.members[memberIndex], ...formData };
            return demoData.members[memberIndex];
        }
        throw new Error('Member not found');
    }

    try {
        if (formData.password) {
            await manageMemberAuth(formData.email, formData.password, memberId);
        }

        const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: formData.role || 'owner', email: formData.email })
            .eq('id', memberId);

        if (profileError) {
            console.error('Profile update failed:', profileError);
            throw new Error('Failed to update member profile: ' + profileError.message);
        }

        const memberData = {
            email: formData.email,
            name: formData.name,
            phone: formData.phone || '',
            role: formData.role || 'owner',
            verified: formData.verified || false
        };

        const { error: memberError } = await supabase
            .from('members')
            .update(memberData)
            .eq('id', memberId)
            .eq('association_id', associationId);

        if (memberError) {
            console.error('Member update failed:', memberError);
            throw new Error('Failed to update member: ' + memberError.message);
        }

        return memberData;
    } catch (error) {
        console.error('Error in updateMember:', error);
        throw error;
    }
}

async function deleteMember(memberId, associationId, isDemo = false) {
    if (isDemo) {
        demoData.members = demoData.members.filter(m => m.id !== memberId);
        return;
    }

    try {
        // Check if member exists
        const member = await getMemberById(memberId, associationId);
        if (!member) {
            throw new Error('Member not found');
        }

        // Delete member record
        const { error: memberError } = await supabase
            .from('members')
            .delete()
            .eq('id', memberId)
            .eq('association_id', associationId);

        if (memberError) {
            console.error('Error deleting member:', memberError);
            throw new Error('Failed to delete member: ' + memberError.message);
        }

        // Delete profile
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', memberId);

        if (profileError) {
            console.error('Error deleting profile:', profileError);
            throw new Error('Failed to delete member profile: ' + profileError.message);
        }

        // Delete auth user via server endpoint
        const response = await fetch(`${API_BASE_URL}/delete-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: memberId })
        });

        const result = await response.json();
        if (!response.ok) {
            console.error('Error deleting auth user:', result.error);
            throw new Error('Failed to delete auth user: ' + (result.error || 'Server error'));
        }

        console.log('Member deleted successfully:', memberId);
    } catch (error) {
        console.error('Error in deleteMember:', error);
        throw error;
    }
}

// Route Services
async function getRecentRoutes(associationId, isDemo = false) {
    if (isDemo) {
        return demoData.routes.slice(0, 3);
    }

    try {
        const { data, error } = await supabase
            .from('routes')
            .select('*')
            .eq('association_id', associationId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(3);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error in getRecentRoutes:', error);
        throw error;
    }
}

async function addRoute(associationId, routeData, isDemo = false) {
    if (isDemo) {
        const newRoute = {
            id: `route-${Date.now()}`,
            ...routeData,
            status: 'active',
            created_at: new Date().toISOString()
        };
        demoData.routes.unshift(newRoute);
        return newRoute;
    }

    try {
        const routeWithAssociation = {
            ...routeData,
            association_id: associationId,
            status: 'active'
        };

        const { data, error } = await supabase
            .from('routes')
            .insert([routeWithAssociation])
            .select()
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in addRoute:', error);
        throw error;
    }
}

async function getRouteById(routeId, associationId, isDemo = false) {
    if (isDemo) {
        return demoData.routes.find(r => r.id === routeId) || null;
    }

    try {
        const { data, error } = await supabase
            .from('routes')
            .select('*')
            .eq('id', routeId)
            .eq('association_id', associationId)
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in getRouteById:', error);
        throw error;
    }
}

async function updateRoute(routeId, associationId, routeData, isDemo = false) {
    if (isDemo) {
        const routeIndex = demoData.routes.findIndex(r => r.id === routeId);
        if (routeIndex !== -1) {
            demoData.routes[routeIndex] = { ...demoData.routes[routeIndex], ...routeData };
            return demoData.routes[routeIndex];
        }
        throw new Error('Route not found');
    }

    try {
        const { data, error } = await supabase
            .from('routes')
            .update(routeData)
            .eq('id', routeId)
            .eq('association_id', associationId)
            .select()
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in updateRoute:', error);
        throw error;
    }
}

async function deleteRoute(routeId, associationId, isDemo = false) {
    if (isDemo) {
        demoData.routes = demoData.routes.filter(r => r.id !== routeId);
        return;
    }

    try {
        const { error } = await supabase
            .from('routes')
            .delete()
            .eq('id', routeId)
            .eq('association_id', associationId);
        if (error) throw error;
    } catch (error) {
        console.error('Error in deleteRoute:', error);
        throw error;
    }
}

// Dashboard Stats
async function getDashboardStats(associationId, isDemo = false) {
    if (isDemo) {
        return {
            registeredVehicles: 12,
            registeredMembers: demoData.members.length || 8,
            activeRoutes: demoData.routes.length || 5,
            passengerAlarms: 2
        };
    }

    try {
        const [vehicles, members, routes, alerts] = await Promise.all([
            supabase.from('vehicles').select('id').eq('association_id', associationId),
            supabase.from('members').select('id').eq('association_id', associationId),
            supabase.from('routes').select('id').eq('association_id', associationId).eq('status', 'active'),
            supabase.from('panic_alerts').select('id').eq('association_id', associationId).eq('status', 'active')
        ]);

        return {
            registeredVehicles: vehicles.data?.length || 0,
            registeredMembers: members.data?.length || 0,
            activeRoutes: routes.data?.length || 0,
            passengerAlarms: alerts.data?.length || 0
        };
    } catch (error) {
        console.error('Error in getDashboardStats:', error);
        throw error;
    }
}

// Vehicle Services
async function getVehicles(associationId, isDemo = false) {
    if (isDemo) {
        return demoData.vehicles;
    }

    try {
        const { data, error } = await supabase
            .from('vehicles')
            .select('id, registration_number, latitude, longitude')
            .eq('association_id', associationId);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error in getVehicles:', error);
        throw error;
    }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Supabase client...');
    initializeSupabase();

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
                        associationForm.reset();
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

    // Assign functions to global scope for compatibility with association-dashboard.js
    const functions = {
        login,
        signupSimple,
        signupAssociation,
        showError,
        showSuccess,
        checkAssociationAuthentication,
        signOut,
        manageMemberAuth,
        getAssociationByAdminId,
        createAssociation,
        updateAssociation,
        getAssociationById,
        uploadLogo,
        getRecentMembers,
        addMember,
        getMemberById,
        updateMember,
        deleteMember,
        getRecentRoutes,
        addRoute,
        getRouteById,
        updateRoute,
        deleteRoute,
        getDashboardStats,
        getVehicles
    };

    Object.assign(window, functions);
    console.log('✅ All functions are now globally available');
    console.log('Available functions:', Object.keys(functions));
});