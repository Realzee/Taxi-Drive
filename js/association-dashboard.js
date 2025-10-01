// Association Dashboard - UPDATED FOR NEW SCHEMA
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';

// Initialize Supabase
let supabase;
try {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully');
} catch (error) {
    console.error('Failed to initialize Supabase client:', error);
}

// Global variables
let currentUser = null;
let currentAssociation = null;
let currentAssociationId = null;
let realtimeSubscription = null;

// Demo data storage for fallback
let demoData = {
    members: [],
    routes: []
};

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// Authentication check
async function checkAssociationAuthentication() {
    try {
        console.log('Starting authentication check...');
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.log('No authenticated user, redirecting to login. Error:', authError?.message || 'No user found');
            window.location.href = 'index.html';
            return null;
        }

        console.log('User found:', user.id, user.email);
        
        // Get user profile from profiles table
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Profile query failed:', profileError.message, profileError.details);
            window.location.href = 'index.html';
            return null;
        }

        if (profileData?.role !== 'association') {
            console.log(`Role mismatch. Expected: association, Got: ${profileData.role}`);
            window.location.href = 'dashboard.html';
            return null;
        }

        console.log('Authentication successful:', profileData);
        return { ...user, ...profileData };
    } catch (error) {
        console.error('Authentication check error:', error.message, error.stack);
        window.location.href = 'index.html';
        return null;
    }
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        const user = await checkAssociationAuthentication();
        if (!user) return;

        currentUser = user;
        console.log('Association user authenticated:', user.email);

        await loadUserData();
        await loadAssociationData();

        setupEventListeners();
        await loadDashboardData();

        showNotification('Dashboard loaded successfully!', 'success');

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Failed to initialize dashboard. Please try refreshing.', 'error');
    }
}

async function loadUserData() {
    try {
        updateUserHeader(currentUser);
    } catch (error) {
        console.error('Error loading user data:', error);
        updateUserHeader({
            name: currentUser.name || currentUser.email.split('@')[0],
            email: currentUser.email
        });
    }
}

function updateUserHeader(userData) {
    const userNameElement = document.getElementById('user-name');
    let userInfoElement = document.getElementById('user-info');
    
    if (userNameElement) {
        userNameElement.textContent = userData.name || userData.email.split('@')[0];
    }
    
    if (!userInfoElement) {
        const headerActions = document.querySelector('.header-actions');
        userInfoElement = document.createElement('div');
        userInfoElement.className = 'user-info';
        userInfoElement.id = 'user-info';
        headerActions.insertBefore(userInfoElement, headerActions.querySelector('.logout-btn'));
    }
    
    userInfoElement.innerHTML = `<small>${userData.name || userData.email}</small>`;
}

async function loadAssociationData() {
    try {
        console.log('Loading association data for admin:', currentUser.id);
        
        let associationData = null;

        // First, check if associations table exists and is accessible
        const tableCheck = await checkTableAccessibility();
        if (!tableCheck.accessible) {
            console.log('Associations table not accessible, using demo mode');
            currentAssociation = createDemoAssociation();
            currentAssociationId = 'demo-mode';
            updateAssociationProfile(currentAssociation);
            return;
        }

        // Try to get association by admin_id
        const { data, error } = await supabase
            .from('associations')
            .select('*')
            .eq('admin_id', currentUser.id)
            .single();

        if (error) {
            console.log('No association found, creating new one');
            associationData = await createNewAssociation();
        } else {
            associationData = data;
            console.log('Found existing association:', data);
        }

        currentAssociation = associationData;
        currentAssociationId = associationData.id;
        updateAssociationProfile(currentAssociation);
        
    } catch (error) {
        console.error('Error loading association data:', error);
        showNotification('Using demo mode. Database setup may be incomplete.', 'warning');
        currentAssociation = createDemoAssociation();
        currentAssociationId = 'demo-mode';
        updateAssociationProfile(currentAssociation);
    }
}

// Check if we can access the associations table
async function checkTableAccessibility() {
    try {
        const { data, error } = await supabase
            .from('associations')
            .select('id')
            .limit(1);

        return {
            accessible: true,
            exists: !error || error.code !== 'PGRST204'
        };
    } catch (error) {
        return {
            accessible: false,
            exists: false
        };
    }
}

async function createNewAssociation() {
    try {
        const newAssociation = {
            association_name: 'My Taxi Association',
            email: currentUser.email,
            phone: '',
            address: '',
            admin_id: currentUser.id,
            admin_name: currentUser.name || currentUser.email.split('@')[0],
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
            return createDemoAssociation();
        }

        showNotification('New association created successfully!', 'success');
        return data;
        
    } catch (error) {
        console.error('Error creating association:', error);
        return createDemoAssociation();
    }
}

function createDemoAssociation() {
    return {
        id: 'demo-mode',
        association_name: 'My Taxi Association',
        email: currentUser.email,
        phone: '+27 12 345 6789',
        address: '123 Main Street, Johannesburg',
        admin_id: currentUser.id,
        admin_name: currentUser.name || currentUser.email.split('@')[0],
        admin_phone: '+27 82 123 4567',
        description: 'Your taxi association management dashboard',
        logo_url: null,
        wallet_balance: 12500.50,
        is_demo: true
    };
}

function updateAssociationProfile(associationData) {
    const associationNameElement = document.getElementById('association-name');
    if (associationNameElement) {
        associationNameElement.textContent = associationData.association_name || 'Taxi Association';
    }

    updateAssociationLogo(associationData.logo_url);
    updateAssociationProfileModal(associationData);
}

function updateAssociationLogo(logoUrl) {
    const associationLogoElement = document.getElementById('association-logo');
    const mainLogoElement = document.getElementById('main-logo');

    if (logoUrl) {
        if (associationLogoElement) {
            associationLogoElement.src = logoUrl;
            associationLogoElement.style.display = 'block';
        }
        if (mainLogoElement) {
            mainLogoElement.style.display = 'none';
        }
    } else {
        if (associationLogoElement) {
            associationLogoElement.style.display = 'none';
        }
        if (mainLogoElement) {
            mainLogoElement.style.display = 'block';
        }
    }
}

function updateAssociationProfileModal(associationData) {
    const elements = {
        'profile-association-name': associationData.association_name || '',
        'profile-association-email': associationData.email || '',
        'profile-association-phone': associationData.phone || '',
        'profile-association-address': associationData.address || '',
        'profile-association-description': associationData.description || '',
        'profile-admin-name': associationData.admin_name || '',
        'profile-admin-phone': associationData.admin_phone || '',
        'wallet-balance': `R ${(associationData.wallet_balance || 0).toFixed(2)}`
    };

    Object.keys(elements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'text' || element.type === 'email' || element.type === 'tel' || element.tagName === 'TEXTAREA') {
                element.value = elements[id];
            } else {
                element.textContent = elements[id];
            }
        }
    });

    // Handle logo preview in profile modal
    const editLogoPreviewImg = document.getElementById('edit-logo-preview-img');
    const editLogoPreviewContainer = document.getElementById('edit-logo-preview-container');
    if (editLogoPreviewImg && editLogoPreviewContainer && associationData.logo_url) {
        editLogoPreviewImg.src = associationData.logo_url;
        editLogoPreviewContainer.style.display = 'block';
    } else if (editLogoPreviewImg && editLogoPreviewContainer) {
        editLogoPreviewContainer.style.display = 'none';
    }
}

// Dashboard Data Loading
async function loadDashboardData() {
    try {
        await Promise.all([
            loadDashboardStats(),
            loadRecentMembers(),
            loadRecentRoutes()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadDashboardStats() {
    try {
        if (currentAssociation.is_demo) {
            updateDashboardStats({
                registeredVehicles: 12,
                registeredMembers: demoData.members.length || 8,
                activeRoutes: demoData.routes.length || 5,
                passengerAlarms: 2
            });
            return;
        }

        const [vehicles, members, routes, alerts] = await Promise.all([
            supabase.from('vehicles').select('id').eq('association_id', currentAssociation.id),
            supabase.from('members').select('id').eq('association_id', currentAssociation.id),
            supabase.from('routes').select('id').eq('association_id', currentAssociation.id).eq('status', 'active'),
            supabase.from('panic_alerts').select('id').eq('association_id', currentAssociation.id).eq('status', 'active')
        ]);

        updateDashboardStats({
            registeredVehicles: vehicles.data?.length || 0,
            registeredMembers: members.data?.length || 0,
            activeRoutes: routes.data?.length || 0,
            passengerAlarms: alerts.data?.length || 0
        });
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        updateDashboardStats({
            registeredVehicles: 12,
            registeredMembers: 8,
            activeRoutes: 5,
            passengerAlarms: 2
        });
    }
}

function updateDashboardStats(stats) {
    const statElements = {
        'stat-vehicles': stats.registeredVehicles,
        'stat-members': stats.registeredMembers,
        'stat-routes': stats.activeRoutes,
        'stat-alarms': stats.passengerAlarms
    };

    Object.keys(statElements).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = statElements[id];
        }
    });
}

// MEMBER MANAGEMENT
async function loadRecentMembers() {
    try {
        if (currentAssociation.is_demo) {
            if (demoData.members.length === 0) {
                demoData.members = getInitialDemoMembers();
            }
            renderRecentMembers(demoData.members.slice(0, 3));
            return;
        }

        const { data: members, error } = await supabase
            .from('members')
            .select('*')
            .eq('association_id', currentAssociation.id)
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) throw error;
        renderRecentMembers(members || []);
        
    } catch (error) {
        console.error('Error loading recent members:', error);
        renderRecentMembers(getInitialDemoMembers().slice(0, 3));
    }
}

function getInitialDemoMembers() {
    return [
        {
            id: 'demo-member-1',
            member_name: 'John Driver',
            member_email: 'john@taxi.com',
            phone: '+27 82 111 2222',
            role: 'driver',
            is_verified: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-member-2', 
            member_name: 'Sarah Owner',
            member_email: 'sarah@taxi.com',
            phone: '+27 82 333 4444',
            role: 'owner',
            is_verified: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-member-3',
            member_name: 'Mike Member',
            member_email: 'mike@taxi.com', 
            phone: '+27 82 555 6666',
            role: 'member',
            is_verified: false,
            created_at: new Date().toISOString()
        }
    ];
}

function renderRecentMembers(members) {
    const recentMembersContent = document.getElementById('recent-members-content');
    if (!recentMembersContent) return;
    
    if (!members || members.length === 0) {
        recentMembersContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Members Yet</h3>
                <p>Start by adding members to your association.</p>
            </div>
        `;
        return;
    }

    let membersHtml = '';
    members.forEach(member => {
        const statusClass = member.is_verified ? 'status-active' : 'status-pending';
        const statusText = member.is_verified ? 'Verified' : 'Pending';
        
        membersHtml += `
            <div class="list-item">
                <div class="item-icon">
                    <i class="fas fa-user"></i>
                </div>
                <div class="item-details">
                    <h4>${member.member_name || 'Unnamed Member'}</h4>
                    <p>${member.member_email || 'N/A'}</p>
                    <p class="member-role">${member.role} • <span class="status-indicator ${statusClass}">${statusText}</span></p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editMember('${member.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMember('${member.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    recentMembersContent.innerHTML = membersHtml;
}

async function addMember(memberData) {
    try {
        if (currentAssociation.is_demo) {
            const newMember = {
                id: 'member-' + Date.now(),
                ...memberData,
                created_at: new Date().toISOString()
            };
            demoData.members.unshift(newMember);
        } else {
            const memberWithAssociation = {
                ...memberData,
                association_id: currentAssociation.id
            };

            const { error } = await supabase
                .from('members')
                .insert([memberWithAssociation]);

            if (error) throw error;
        }

        showNotification('Member added successfully!', 'success');
        closeModal('add-member-modal');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error adding member:', error);
        showNotification('Failed to add member.', 'error');
    }
}

async function editMember(memberId) {
    try {
        let member;
        
        if (currentAssociation.is_demo) {
            member = demoData.members.find(m => m.id === memberId);
        } else {
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .eq('id', memberId)
                .single();
            if (error) throw error;
            member = data;
        }

        if (!member) {
            showNotification('Member not found.', 'error');
            return;
        }

        document.getElementById('member-email').value = member.member_email || '';
        document.getElementById('member-name').value = member.member_name || '';
        document.getElementById('member-phone').value = member.phone || '';
        document.getElementById('member-role').value = member.role || 'member';
        document.getElementById('member-verified').checked = member.is_verified || false;

        const form = document.getElementById('add-member-form');
        form.setAttribute('data-edit-mode', 'true');
        form.setAttribute('data-member-id', memberId);

        document.querySelector('#add-member-modal .modal-header h3').textContent = 'Edit Member';
        openAddMemberModal();
        
    } catch (error) {
        console.error('Error loading member for edit:', error);
        showNotification('Failed to load member data.', 'error');
    }
}

async function updateMember(memberId, memberData) {
    try {
        if (currentAssociation.is_demo) {
            const memberIndex = demoData.members.findIndex(m => m.id === memberId);
            if (memberIndex !== -1) {
                demoData.members[memberIndex] = { ...demoData.members[memberIndex], ...memberData };
            }
        } else {
            const { error } = await supabase
                .from('members')
                .update(memberData)
                .eq('id', memberId);
            if (error) throw error;
        }

        showNotification('Member updated successfully!', 'success');
        closeModal('add-member-modal');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error updating member:', error);
        showNotification('Failed to update member.', 'error');
    }
}

async function deleteMember(memberId) {
    if (!confirm('Are you sure you want to delete this member?')) return;

    try {
        if (currentAssociation.is_demo) {
            demoData.members = demoData.members.filter(m => m.id !== memberId);
        } else {
            const { error } = await supabase
                .from('members')
                .delete()
                .eq('id', memberId);
            if (error) throw error;
        }

        showNotification('Member deleted successfully!', 'success');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error deleting member:', error);
        showNotification('Failed to delete member.', 'error');
    }
}

// ROUTE MANAGEMENT
async function loadRecentRoutes() {
    try {
        if (currentAssociation.is_demo) {
            if (demoData.routes.length === 0) {
                demoData.routes = getInitialDemoRoutes();
            }
            renderRecentRoutes(demoData.routes.slice(0, 3));
            return;
        }

        const { data: routes, error } = await supabase
            .from('routes')
            .select('*')
            .eq('association_id', currentAssociation.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) throw error;
        renderRecentRoutes(routes || []);
        
    } catch (error) {
        console.error('Error loading recent routes:', error);
        renderRecentRoutes(getInitialDemoRoutes().slice(0, 3));
    }
}

function getInitialDemoRoutes() {
    return [
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
    ];
}

function renderRecentRoutes(routes) {
    const recentRoutesContent = document.getElementById('recent-routes-content');
    if (!recentRoutesContent) return;
    
    if (!routes || routes.length === 0) {
        recentRoutesContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-route"></i>
                <h3>No Routes Yet</h3>
                <p>Create your first route to get started.</p>
            </div>
        `;
        return;
    }

    let routesHtml = '';
    routes.forEach(route => {
        routesHtml += `
            <div class="list-item">
                <div class="item-icon">
                    <i class="fas fa-route"></i>
                </div>
                <div class="item-details">
                    <h4>${route.route_name}</h4>
                    <p>${route.origin} → ${route.destination}</p>
                    <p class="route-schedule">${route.schedule}</p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editRoute('${route.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRoute('${route.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    recentRoutesContent.innerHTML = routesHtml;
}

async function addRoute(routeData) {
    try {
        if (currentAssociation.is_demo) {
            const newRoute = {
                id: 'route-' + Date.now(),
                ...routeData,
                status: 'active',
                created_at: new Date().toISOString()
            };
            demoData.routes.unshift(newRoute);
        } else {
            const routeWithAssociation = {
                ...routeData,
                association_id: currentAssociation.id,
                status: 'active'
            };

            const { error } = await supabase
                .from('routes')
                .insert([routeWithAssociation]);
            if (error) throw error;
        }

        showNotification('Route added successfully!', 'success');
        closeModal('add-route-modal');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error adding route:', error);
        showNotification('Failed to add route.', 'error');
    }
}

async function editRoute(routeId) {
    try {
        let route;
        
        if (currentAssociation.is_demo) {
            route = demoData.routes.find(r => r.id === routeId);
        } else {
            const { data, error } = await supabase
                .from('routes')
                .select('*')
                .eq('id', routeId)
                .single();
            if (error) throw error;
            route = data;
        }

        if (!route) {
            showNotification('Route not found.', 'error');
            return;
        }

        document.getElementById('route-name').value = route.route_name || '';
        document.getElementById('route-origin').value = route.origin || '';
        document.getElementById('route-destination').value = route.destination || '';
        document.getElementById('route-schedule').value = route.schedule || '';
        document.getElementById('route-waypoints').value = route.waypoints || '';

        const form = document.getElementById('add-route-form');
        form.setAttribute('data-edit-mode', 'true');
        form.setAttribute('data-route-id', routeId);

        document.querySelector('#add-route-modal .modal-header h3').textContent = 'Edit Route';
        openAddRouteModal();
        
    } catch (error) {
        console.error('Error loading route for edit:', error);
        showNotification('Failed to load route data.', 'error');
    }
}

async function updateRoute(routeId, routeData) {
    try {
        if (currentAssociation.is_demo) {
            const routeIndex = demoData.routes.findIndex(r => r.id === routeId);
            if (routeIndex !== -1) {
                demoData.routes[routeIndex] = { ...demoData.routes[routeIndex], ...routeData };
            }
        } else {
            const { error } = await supabase
                .from('routes')
                .update(routeData)
                .eq('id', routeId);
            if (error) throw error;
        }

        showNotification('Route updated successfully!', 'success');
        closeModal('add-route-modal');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error updating route:', error);
        showNotification('Failed to update route.', 'error');
    }
}

async function deleteRoute(routeId) {
    if (!confirm('Are you sure you want to delete this route?')) return;

    try {
        if (currentAssociation.is_demo) {
            demoData.routes = demoData.routes.filter(r => r.id !== routeId);
        } else {
            const { error } = await supabase
                .from('routes')
                .delete()
                .eq('id', routeId);
            if (error) throw error;
        }

        showNotification('Route deleted successfully!', 'success');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error deleting route:', error);
        showNotification('Failed to delete route.', 'error');
    }
}

// ASSOCIATION PROFILE MANAGEMENT
async function saveAssociationProfile() {
    try {
        const logoInput = document.getElementById('edit-association-logo');
        const logoFile = logoInput?.files[0];

        // Validate logo file size
        if (logoFile && logoFile.size > 2 * 1024 * 1024) {
            showNotification('Logo file size exceeds 2MB limit.', 'error');
            return;
        }

        const formData = {
            association_name: document.getElementById('profile-association-name')?.value || '',
            email: document.getElementById('profile-association-email')?.value || '',
            phone: document.getElementById('profile-association-phone')?.value || '',
            address: document.getElementById('profile-association-address')?.value || '',
            description: document.getElementById('profile-association-description')?.value || '',
            admin_name: document.getElementById('profile-admin-name')?.value || '',
            admin_phone: document.getElementById('profile-admin-phone')?.value || '',
            updated_at: new Date().toISOString()
        };

        let logoUrl = currentAssociation.logo_url; // Keep existing logo unless new one is uploaded

        if (!currentAssociation.is_demo && logoFile) {
            // Upload new logo
            const fileName = `${currentAssociationId}/${Date.now()}_${logoFile.name}`;
            const { data: storageData, error: storageError } = await supabase.storage
                .from('logos')
                .upload(fileName, logoFile, { 
                    cacheControl: '3600', 
                    upsert: false 
                });

            if (storageError) {
                console.error('Logo upload error:', storageError);
                showNotification('Failed to upload logo. Profile saved without logo.', 'warning');
            } else {
                const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
                logoUrl = publicUrlData.publicUrl;
                console.log('New logo uploaded:', logoUrl);
            }
        }

        if (!currentAssociation.is_demo) {
            const updateData = {
                ...formData,
                logo_url: logoUrl
            };

            const { error } = await supabase
                .from('associations')
                .update(updateData)
                .eq('id', currentAssociationId);
            if (error) throw error;
        }

        // Update current association data
        Object.assign(currentAssociation, formData, { logo_url: logoUrl });
        updateAssociationProfile(currentAssociation);
        
        showNotification('Profile updated successfully!', 'success');
        closeModal('profile-modal');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile.', 'error');
    }
}

// EVENT LISTENERS SETUP
function setupEventListeners() {
    // Header actions
    const profileBtn = document.getElementById('profile-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const alertsBtn = document.getElementById('alerts-btn');

    if (profileBtn) profileBtn.addEventListener('click', openProfileModal);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (alertsBtn) alertsBtn.addEventListener('click', openAlertsModal);

    // Quick actions
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    quickActionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            switch(action) {
                case 'add-route': openAddRouteModal(); break;
                case 'add-member': openAddMemberModal(); break;
                case 'manage-parts': openManagePartsModal(); break;
                case 'view-alerts': openAlertsModal(); break;
            }
        });
    });

    // Bottom navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            switch(target) {
                case 'dashboard': break;
                case 'map': openMapModal(); break;
                case 'wallet': openWalletModal(); break;
                case 'profile': openProfileModal(); break;
            }
        });
    });

    // Form submissions
    setupFormSubmissions();

    // Modal close buttons
    const closeBtns = document.querySelectorAll('.modal-close, .btn-cancel');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal-overlay');
            if (modal) {
                closeModal(modal.id);
                resetForms();
            }
        });
    });

    // Click outside to close modals
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal(e.target.id);
            resetForms();
        }
    });

    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
            resetForms();
        }
    });

    // Profile modal logo preview (one-time setup)
    setupProfileLogoPreview();
}

function setupProfileLogoPreview() {
    const logoInput = document.getElementById('edit-association-logo');
    const logoPreviewContainer = document.getElementById('edit-logo-preview-container');
    const logoPreviewImg = document.getElementById('edit-logo-preview-img');
    const removeLogoBtn = document.getElementById('edit-remove-logo-btn');
    const logoInfo = document.getElementById('edit-logo-info');

    if (logoInput && logoPreviewContainer && logoPreviewImg && removeLogoBtn && logoInfo) {
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 2 * 1024 * 1024) {
                    showNotification('Logo file size exceeds 2MB limit.', 'error');
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

function setupFormSubmissions() {
    // Member form
    const memberForm = document.getElementById('add-member-form');
    if (memberForm) {
        memberForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                member_email: document.getElementById('member-email').value,
                member_name: document.getElementById('member-name').value,
                phone: document.getElementById('member-phone').value,
                role: document.getElementById('member-role').value,
                is_verified: document.getElementById('member-verified').checked
            };

            try {
                if (this.getAttribute('data-edit-mode') === 'true') {
                    const memberId = this.getAttribute('data-member-id');
                    await updateMember(memberId, formData);
                } else {
                    await addMember(formData);
                }
            } catch (error) {
                console.error('Form submission error:', error);
            }
        });
    }

    // Route form
    const routeForm = document.getElementById('add-route-form');
    if (routeForm) {
        routeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                route_name: document.getElementById('route-name').value,
                origin: document.getElementById('route-origin').value,
                destination: document.getElementById('route-destination').value,
                schedule: document.getElementById('route-schedule').value,
                waypoints: document.getElementById('route-waypoints').value
            };

            try {
                if (this.getAttribute('data-edit-mode') === 'true') {
                    const routeId = this.getAttribute('data-route-id');
                    await updateRoute(routeId, formData);
                } else {
                    await addRoute(formData);
                }
            } catch (error) {
                console.error('Form submission error:', error);
            }
        });
    }

    // Profile form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAssociationProfile();
        });
    }
}

function resetForms() {
    // Reset member form
    const memberForm = document.getElementById('add-member-form');
    if (memberForm) {
        memberForm.reset();
        memberForm.removeAttribute('data-edit-mode');
        memberForm.removeAttribute('data-member-id');
        document.querySelector('#add-member-modal .modal-header h3').textContent = 'Add New Member';
    }

    // Reset route form
    const routeForm = document.getElementById('add-route-form');
    if (routeForm) {
        routeForm.reset();
        routeForm.removeAttribute('data-edit-mode');
        routeForm.removeAttribute('data-route-id');
        document.querySelector('#add-route-modal .modal-header h3').textContent = 'Add New Route';
    }
}

// MODAL MANAGEMENT
function openProfileModal() {
    openModal('profile-modal');
}

function openAddMemberModal() {
    openModal('add-member-modal');
}

function openAddRouteModal() {
    openModal('add-route-modal');
}

function openAlertsModal() {
    openModal('alerts-modal');
    loadAlertsData();
}

function openMapModal() {
    openModal('map-modal');
    loadMapData();
}

function openWalletModal() {
    openModal('wallet-modal');
    loadWalletData();
}

function openManagePartsModal() {
    openModal('parts-modal');
    loadPartsData();
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    });
}

// NOTIFICATION SYSTEM
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

// LOGOUT FUNCTION
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'index.html';
    }
}

// DEMO DATA FUNCTIONS (for fallback)
function loadAlertsData() {
    const alertsContent = document.getElementById('alerts-content');
    if (!alertsContent) return;

    alertsContent.innerHTML = `
        <div class="list-item">
            <div class="item-icon">
                <i class="fas fa-exclamation-triangle text-danger"></i>
            </div>
            <div class="item-details">
                <h4>Panic Alert - Route 12</h4>
                <p>Passenger reported emergency situation</p>
                <p class="text-muted">2 minutes ago</p>
            </div>
            <div class="item-actions">
                <button class="btn btn-primary btn-sm">Respond</button>
            </div>
        </div>
        <div class="list-item">
            <div class="item-icon">
                <i class="fas fa-exclamation-triangle text-warning"></i>
            </div>
            <div class="item-details">
                <h4>Vehicle Breakdown - ABC 123 GP</h4>
                <p>Vehicle reported mechanical issues</p>
                <p class="text-muted">15 minutes ago</p>
            </div>
            <div class="item-actions">
                <button class="btn btn-primary btn-sm">Respond</button>
            </div>
        </div>
    `;
}

function loadMapData() {
    const mapContent = document.getElementById('map-content');
    if (!mapContent) return;

    mapContent.innerHTML = `
        <div class="map-placeholder">
            <i class="fas fa-map-marked-alt"></i>
            <h3>Live Vehicle Tracking</h3>
            <p>Active vehicles will appear here in real-time</p>
            <div class="demo-vehicles">
                <div class="vehicle-marker">
                    <i class="fas fa-taxi"></i>
                    <span>ABC 123 GP</span>
                </div>
                <div class="vehicle-marker">
                    <i class="fas fa-taxi"></i>
                    <span>DEF 456 GP</span>
                </div>
            </div>
        </div>
    `;
}

function loadWalletData() {
    const walletContent = document.getElementById('wallet-content');
    if (!walletContent) return;

    walletContent.innerHTML = `
        <div class="wallet-summary">
            <h3>Association Wallet</h3>
            <div class="balance-display">
                <span class="balance-amount">R ${(currentAssociation?.wallet_balance || 0).toFixed(2)}</span>
                <p class="balance-label">Available Balance</p>
            </div>
        </div>
        <div class="transaction-history">
            <h4>Recent Transactions</h4>
            <div class="transaction-list">
                <div class="transaction-item">
                    <div class="transaction-icon">
                        <i class="fas fa-arrow-down text-success"></i>
                    </div>
                    <div class="transaction-details">
                        <h5>Member Dues</h5>
                        <p>Monthly collection</p>
                        <span class="transaction-date">Today</span>
                    </div>
                    <div class="transaction-amount text-success">
                        +R 2,500.00
                    </div>
                </div>
                <div class="transaction-item">
                    <div class="transaction-icon">
                        <i class="fas fa-arrow-up text-danger"></i>
                    </div>
                    <div class="transaction-details">
                        <h5>Maintenance</h5>
                        <p>Vehicle parts</p>
                        <span class="transaction-date">Yesterday</span>
                    </div>
                    <div class="transaction-amount text-danger">
                        -R 850.00
                    </div>
                </div>
            </div>
        </div>
    `;
}

function loadPartsData() {
    const partsContent = document.getElementById('parts-content');
    if (!partsContent) return;

    partsContent.innerHTML = `
        <div class="parts-summary">
            <h3>Parts Inventory</h3>
            <div class="inventory-stats">
                <div class="stat-card">
                    <h4>15</h4>
                    <p>Total Parts</p>
                </div>
                <div class="stat-card">
                    <h4>3</h4>
                    <p>Low Stock</p>
                </div>
            </div>
        </div>
        <div class="parts-list">
            <h4>Recent Parts</h4>
            <div class="list-item">
                <div class="item-icon">
                    <i class="fas fa-cog"></i>
                </div>
                <div class="item-details">
                    <h4>Brake Pads</h4>
                    <p>Part #: BP-2024-001</p>
                    <p class="text-warning">Low Stock: 2 remaining</p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-primary btn-sm">Order</button>
                </div>
            </div>
            <div class="list-item">
                <div class="item-icon">
                    <i class="fas fa-tire"></i>
                </div>
                <div class="item-details">
                    <h4>Tires</h4>
                    <p>Part #: TIRE-2024-015</p>
                    <p class="text-success">In Stock: 8 available</p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-primary btn-sm">Order</button>
                </div>
            </div>
        </div>
    `;
}

// Export functions for global access
window.openAddMemberModal = openAddMemberModal;
window.openAddRouteModal = openAddRouteModal;
window.openManagePartsModal = openManagePartsModal;
window.editMember = editMember;
window.deleteMember = deleteMember;
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;
window.handleLogout = handleLogout;
window.closeModal = closeModal;
