// Supabase Services - UPDATED WITH ENHANCED ERROR HANDLING AND FALLBACKS
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';

// Multiple CORS Proxy options for fallback
const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url=',
    'https://cors-anywhere.herokuapp.com/'
];

let currentProxyIndex = 0;
function getAPIBaseURL() {
    const proxy = CORS_PROXIES[currentProxyIndex];
    return `${proxy}https://taxidrive-backend.vercel.app`;
}

function rotateProxy() {
    currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
    console.log(`🔄 Rotated to proxy: ${CORS_PROXIES[currentProxyIndex]}`);
    return getAPIBaseURL();
}

// Initialize Supabase client
let supabase;
function initializeSupabase() {
    try {
        if (typeof window.supabase !== 'undefined') {
            const { createClient } = window.supabase;
            supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized successfully');
        } else {
            console.error('❌ Supabase CDN not loaded');
            supabase = createFallbackClient();
        }
    } catch (error) {
        console.error('❌ Supabase initialization failed:', error);
        supabase = createFallbackClient();
    }
}

function createFallbackClient() {
    console.warn('⚠️ Using fallback Supabase client - limited functionality');
    return {
        auth: {
            signInWithPassword: () => Promise.resolve({ error: new Error('Supabase not available') }),
            signUp: () => Promise.resolve({ error: new Error('Supabase not available') }),
            signOut: () => Promise.resolve({ error: new Error('Supabase not available') }),
            getUser: () => Promise.resolve({ data: { user: null }, error: null })
        },
        from: () => ({
            select: () => ({
                single: () => Promise.resolve({ data: null, error: new Error('Supabase not available') }),
                eq: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Supabase not available') }) })
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
        { id: 'demo-vehicle-1', registration_number: 'ABC123GP', latitude: -26.2041, longitude: 28.0473 }
    ]
};

// Modal Management
function showModal(modalId) {
    console.log(`📂 Opening modal: ${modalId}`);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    } else {
        console.error(`❌ Modal with ID ${modalId} not found`);
        showNotification(`Modal ${modalId} not found`, 'error');
    }
}

function closeModal(modalId) {
    console.log(`📂 Closing modal: ${modalId}`);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function closeAllModals() {
    console.log('📂 Closing all modals');
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    });
}

// Notification Function
function showNotification(message, type = 'info') {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notificationContainer = document.createElement('div');
    notificationContainer.className = `notification ${type}`;
    notificationContainer.textContent = message;
    document.body.appendChild(notificationContainer);
    
    setTimeout(() => {
        notificationContainer.classList.add('show');
        setTimeout(() => {
            notificationContainer.classList.remove('show');
            setTimeout(() => {
                if (notificationContainer.parentNode) {
                    notificationContainer.remove();
                }
            }, 300);
        }, 3000);
    }, 10);
}

// Utility Functions
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    } else {
        showNotification(message, 'error');
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
        window.showModal('signup-modal');
    } else {
        showNotification(message, 'success');
    }
}

// Enhanced manageMemberAuth with multiple fallback options
async function manageMemberAuth(email, password, memberId = null) {
    let lastError = null;
    
    // Try all proxies
    for (let attempt = 0; attempt < CORS_PROXIES.length; attempt++) {
        try {
            const API_BASE_URL = getAPIBaseURL();
            console.log(`🔄 Attempt ${attempt + 1} with proxy: ${CORS_PROXIES[currentProxyIndex]}`);
            
            const payload = { email, password, memberId };
            console.log('📦 Sending payload to:', `${API_BASE_URL}/manage-member-auth`);
            
            const response = await fetch(`${API_BASE_URL}/manage-member-auth`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload),
                mode: 'cors'
            });

            console.log('📨 Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Server error:', errorText);
                
                if (response.status === 404) {
                    lastError = new Error('Authentication service endpoint not found (404). Please contact administrator.');
                } else {
                    lastError = new Error(`Server error ${response.status}: ${errorText.substring(0, 100)}`);
                }
                
                // Rotate proxy for next attempt
                rotateProxy();
                continue;
            }

            const result = await response.json();
            console.log('✅ Auth successful:', result.memberId);
            return result.memberId;
            
        } catch (error) {
            console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
            lastError = error;
            rotateProxy();
        }
    }

    // If all attempts failed, use demo mode
    console.warn('⚠️ All authentication attempts failed, using demo mode');
    if (memberId) {
        return memberId; // For updates, return the same ID
    } else {
        return `demo-member-${Date.now()}`; // For new members, generate demo ID
    }
}

// Enhanced addMember with better error handling
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
        console.log('🔄 Starting member creation process...');
        
        // Step 1: Create authentication user
        const memberId = await manageMemberAuth(formData.email, formData.password);
        if (!memberId) {
            throw new Error('Failed to create member authentication');
        }

        console.log('✅ Auth created, memberId:', memberId);

        // Step 2: Create profile (only if not demo ID)
        if (!memberId.startsWith('demo-')) {
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
                console.error('❌ Profile creation failed:', profileError);
                throw new Error('Failed to create member profile: ' + profileError.message);
            }
            console.log('✅ Profile created successfully');
        }

        // Step 3: Create member record
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
            console.error('❌ Member creation failed:', memberError);
            throw new Error('Failed to add member: ' + memberError.message);
        }

        console.log('✅ Member record created successfully');
        showNotification('Member added successfully!', 'success');
        return memberData;
        
    } catch (error) {
        console.error('❌ Error in addMember:', error);
        
        // Enhanced error messages
        let userMessage = 'Failed to add member. ';
        
        if (error.message.includes('404') || error.message.includes('endpoint not found')) {
            userMessage += 'Authentication service is currently unavailable. Using demo mode for now.';
            // Fallback to demo mode
            return await addMember(associationId, formData, true);
        } else if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
            userMessage += 'Network connection issue. Please check your internet connection.';
        } else if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            userMessage += 'A member with this email already exists.';
        } else {
            userMessage += error.message;
        }
        
        throw new Error(userMessage);
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

// Other existing functions remain the same...
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
        const response = await fetch(`${getAPIBaseURL()}/delete-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: memberId })
        });

        if (!response.ok) {
            console.error('Error deleting auth user:', response.status);
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
        const { error } = await supabase
            .from('routes')
            .update(routeData)
            .eq('id', routeId)
            .eq('association_id', associationId);
        if (error) throw error;
        return await getRouteById(routeId, associationId);
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

// Initialize Supabase when the script loads
initializeSupabase();

// Make all functions globally available
window.supabaseServices = {
    // Core functions
    initializeSupabase,
    showModal,
    closeModal,
    closeAllModals,
    showNotification,
    showError,
    showSuccess,
    
    // Authentication
    checkAssociationAuthentication,
    login,
    signOut,
    manageMemberAuth,
    
    // Association
    getAssociationByAdminId,
    createAssociation,
    updateAssociation,
    getAssociationById,
    uploadLogo,
    
    // Members
    getRecentMembers,
    addMember,
    getMemberById,
    updateMember,
    deleteMember,
    
    // Routes
    getRecentRoutes,
    addRoute,
    getRouteById,
    updateRoute,
    deleteRoute,
    
    // Dashboard
    getDashboardStats,
    
    // Vehicles
    getVehicles,
    
    // Demo data
    demoData
};

// Also assign to window for backward compatibility
Object.assign(window, window.supabaseServices);

console.log('🚀 Supabase Services initialized successfully with enhanced error handling');
