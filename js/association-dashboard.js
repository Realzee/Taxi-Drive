// Association Dashboard - ENHANCED VERSION WITH ROBUST AUTH AND LOGGING
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';

// Initialize Supabase
let supabase;
try {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialized successfully');
} catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    showNotification('Failed to connect to database. Using demo mode.', 'error');
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
    console.log('🚀 Initializing association dashboard...');
    initializeDashboard();
});

// Authentication check
async function checkAssociationAuthentication() {
    console.log('🔍 Checking association authentication...');
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.error('❌ No authenticated user:', authError?.message || 'No user data');
            showNotification('Please log in to continue.', 'error');
            window.location.href = 'index.html';
            return null;
        }

        console.log('✅ Authenticated user:', user.email, 'ID:', user.id);

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, name, email')
            .eq('id', user.id)
            .single();

        if (userError) {
            console.error('❌ User data fetch error:', userError);
            showNotification('User profile not found. Contact support.', 'error');
            await supabase.auth.signOut();
            window.location.href = 'index.html';
            return null;
        }

        if (userData?.role !== 'association') {
            console.error('❌ User is not an association, role:', userData.role);
            showNotification('Access denied: Not an association account.', 'error');
            await supabase.auth.signOut();
            window.location.href = 'dashboard.html';
            return null;
        }

        console.log('✅ User is association:', userData);
        return { ...user, ...userData };
    } catch (error) {
        console.error('❌ Authentication check error:', error);
        showNotification('Authentication error. Please try again.', 'error');
        window.location.href = 'index.html';
        return null;
    }
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        const user = await checkAssociationAuthentication();
        if (!user) {
            console.error('❌ Initialization aborted: No valid user');
            return;
        }

        currentUser = user;
        console.log('✅ Association user authenticated:', user.email);

        await loadUserData();
        await loadAssociationData();

        setupEventListeners();
        await loadDashboardData();

        showNotification('Dashboard loaded successfully!', 'success');
        console.log('✅ Dashboard initialization complete');

    } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        showNotification('Failed to initialize dashboard. Please try refreshing.', 'error');
    }
}

async function loadUserData() {
    try {
        updateUserHeader(currentUser);
        console.log('✅ User header updated');
    } catch (error) {
        console.error('❌ Error loading user data:', error);
        updateUserHeader({
            name: currentUser.email.split('@')[0],
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
    console.log('✅ User header set:', userData.name || userData.email);
}

async function loadAssociationData() {
    try {
        console.log('🔍 Loading association data for admin:', currentUser.id);
        
        let associationData = null;

        const tableCheck = await checkTableAccessibility();
        if (!tableCheck.accessible) {
            console.log('⚠️ Associations table not accessible, using demo mode');
            currentAssociation = createDemoAssociation();
            currentAssociationId = 'demo-mode';
            updateAssociationProfile(currentAssociation);
            return;
        }

        const { data, error } = await supabase
            .from('associations')
            .select('id, name, email, phone, address, admin_id, admin_name, admin_phone, admin_id_number, description, logo_url, created_at, updated_at')
            .eq('admin_id', currentUser.id)
            .single();

        if (error) {
            console.error('❌ No association found:', error);
            showNotification('No association found. Creating new one.', 'warning');
            associationData = await createNewAssociation();
        } else {
            associationData = data;
            console.log('✅ Found existing association:', data.name, 'ID:', data.id);
        }

        currentAssociation = associationData;
        currentAssociationId = associationData.id;
        updateAssociationProfile(currentAssociation);
        
    } catch (error) {
        console.error('❌ Error loading association data:', error);
        showNotification('Using demo mode due to database error.', 'warning');
        currentAssociation = createDemoAssociation();
        currentAssociationId = 'demo-mode';
        updateAssociationProfile(currentAssociation);
    }
}

async function checkTableAccessibility() {
    try {
        const { data, error } = await supabase
            .from('associations')
            .select('id')
            .limit(1);

        return {
            accessible: !error,
            exists: !error || error.code !== 'PGRST204'
        };
    } catch (error) {
        console.error('❌ Table accessibility check failed:', error);
        return {
            accessible: false,
            exists: false
        };
    }
}

async function createNewAssociation() {
    try {
        const newAssociation = {
            name: 'My Taxi Association',
            email: currentUser.email,
            phone: '',
            address: '',
            admin_id: currentUser.id,
            admin_name: currentUser.name || currentUser.email.split('@')[0],
            admin_phone: '',
            admin_id_number: '',
            description: '',
            logo_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('associations')
            .insert([newAssociation])
            .select()
            .single();

        if (error) {
            console.error('❌ Failed to create association:', error);
            throw error;
        }

        showNotification('New association created successfully!', 'success');
        console.log('✅ New association created:', data.name, 'ID:', data.id);
        return data;
        
    } catch (error) {
        console.error('❌ Error creating association:', error);
        return createDemoAssociation();
    }
}

function createDemoAssociation() {
    const demoAssociation = {
        id: 'demo-mode',
        name: 'My Taxi Association',
        email: currentUser.email,
        phone: '+27 12 345 6789',
        address: '123 Main Street, Johannesburg',
        admin_id: currentUser.id,
        admin_name: currentUser.name || currentUser.email.split('@')[0],
        admin_phone: '+27 82 123 4567',
        admin_id_number: '1234567890123',
        description: 'Your taxi association management dashboard',
        logo_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_demo: true
    };
    console.log('✅ Created demo association:', demoAssociation.name);
    return demoAssociation;
}

function updateAssociationProfile(associationData) {
    const associationNameElement = document.getElementById('association-name');
    if (associationNameElement) {
        associationNameElement.textContent = associationData.name || 'Taxi Association';
    }

    updateAssociationLogo(associationData.logo_url);
    updateAssociationProfileModal(associationData);
    console.log('✅ Association profile updated:', associationData.name);
}

function updateAssociationLogo(logoUrl) {
    const associationLogoElement = document.getElementById('association-logo');
    const mainLogoElement = document.getElementById('main-logo');

    if (logoUrl) {
        if (associationLogoElement) {
            associationLogoElement.src = logoUrl;
            associationLogoElement.style.display = 'block';
            console.log('✅ Association logo set:', logoUrl);
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
        console.log('⚠️ No logo URL, showing default logo');
    }
}

function updateAssociationProfileModal(associationData) {
    const elements = {
        'profile-association-name': associationData.name || '',
        'profile-association-email': associationData.email || '',
        'profile-association-phone': associationData.phone || '',
        'profile-association-address': associationData.address || '',
        'profile-association-description': associationData.description || '',
        'profile-admin-name': associationData.admin_name || '',
        'profile-admin-phone': associationData.admin_phone || ''
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

    const editLogoPreviewImg = document.getElementById('edit-logo-preview-img');
    const editLogoPreviewContainer = document.getElementById('edit-logo-preview-container');
    if (editLogoPreviewImg && editLogoPreviewContainer) {
        if (associationData.logo_url) {
            editLogoPreviewImg.src = associationData.logo_url;
            editLogoPreviewContainer.style.display = 'block';
            console.log('✅ Profile modal logo preview set:', associationData.logo_url);
        } else {
            editLogoPreviewContainer.style.display = 'none';
            editLogoPreviewImg.src = '';
            console.log('⚠️ No logo for profile modal preview');
        }
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
        console.log('✅ Dashboard data loaded');
    } catch (error) {
        console.error('❌ Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data. Showing demo data.', 'warning');
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
            console.log('✅ Demo stats loaded');
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
        console.log('✅ Real stats loaded');
        
    } catch (error) {
        console.error('❌ Error loading dashboard stats:', error);
        updateDashboardStats({
            registeredVehicles: 12,
            registeredMembers: 8,
            activeRoutes: 5,
            passengerAlarms: 2
        });
        console.log('✅ Fallback to demo stats');
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
    console.log('✅ Dashboard stats updated:', stats);
}

// MEMBER MANAGEMENT
async function loadRecentMembers() {
    try {
        if (currentAssociation.is_demo) {
            if (demoData.members.length === 0) {
                demoData.members = getInitialDemoMembers();
            }
            renderRecentMembers(demoData.members.slice(0, 3));
            console.log('✅ Demo members loaded');
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
        console.log('✅ Real members loaded:', members.length);
        
    } catch (error) {
        console.error('❌ Error loading recent members:', error);
        renderRecentMembers(getInitialDemoMembers().slice(0, 3));
        console.log('✅ Fallback to demo members');
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
    if (!recentMembersContent) {
        console.error('❌ Recent members content element not found');
        return;
    }
    
    if (!members || members.length === 0) {
        recentMembersContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Members Yet</h3>
                <p>Start by adding members to your association.</p>
            </div>
        `;
        console.log('✅ Rendered empty members state');
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
    console.log('✅ Rendered members:', members.length);
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
            console.log('✅ Added demo member:', newMember.member_name);
        } else {
            const memberWithAssociation = {
                ...memberData,
                association_id: currentAssociation.id
            };

            const { error } = await supabase
                .from('members')
                .insert([memberWithAssociation]);

            if (error) throw error;
            console.log('✅ Added real member:', memberData.member_name);
        }

        showNotification('Member added successfully!', 'success');
        closeModal('add-member-modal');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('❌ Error adding member:', error);
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
            console.error('❌ Member not found:', memberId);
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
        console.log('✅ Opened edit member modal for:', memberId);
        
    } catch (error) {
        console.error('❌ Error loading member for edit:', error);
        showNotification('Failed to load member data.', 'error');
    }
}

async function updateMember(memberId, memberData) {
    try {
        if (currentAssociation.is_demo) {
            const memberIndex = demoData.members.findIndex(m => m.id === memberId);
            if (memberIndex !== -1) {
                demoData.members[memberIndex] = { ...demoData.members[memberIndex], ...memberData };
                console.log('✅ Updated demo member:', memberId);
            }
        } else {
            const { error } = await supabase
                .from('members')
                .update(memberData)
                .eq('id', memberId);
            if (error) throw error;
            console.log('✅ Updated real member:', memberId);
        }

        showNotification('Member updated successfully!', 'success');
        closeModal('add-member-modal');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('❌ Error updating member:', error);
        showNotification('Failed to update member.', 'error');
    }
}

async function deleteMember(memberId) {
    if (!confirm('Are you sure you want to delete this member?')) return;

    try {
        if (currentAssociation.is_demo) {
            demoData.members = demoData.members.filter(m => m.id !== memberId);
            console.log('✅ Deleted demo member:', memberId);
        } else {
            const { error } = await supabase
                .from('members')
                .delete()
                .eq('id', memberId);
            if (error) throw error;
            console.log('✅ Deleted real member:', memberId);
        }

        showNotification('Member deleted successfully!', 'success');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('❌ Error deleting member:', error);
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
            console.log('✅ Demo routes loaded');
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
        console.log('✅ Real routes loaded:', routes.length);
        
    } catch (error) {
        console.error('❌ Error loading recent routes:', error);
        renderRecentRoutes(getInitialDemoRoutes().slice(0, 3));
        console.log('✅ Fallback to demo routes');
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
    if (!recentRoutesContent) {
        console.error('❌ Recent routes content element not found');
        return;
    }
    
    if (!routes || routes.length === 0) {
        recentRoutesContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-route"></i>
                <h3>No Routes Yet</h3>
                <p>Create your first route to get started.</p>
            </div>
        `;
        console.log('✅ Rendered empty routes state');
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
    console.log('✅ Rendered routes:', routes.length);
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
            console.log('✅ Added demo route:', newRoute.route_name);
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
            console.log('✅ Added real route:', routeData.route_name);
        }

        showNotification('Route added successfully!', 'success');
        closeModal('add-route-modal');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('❌ Error adding route:', error);
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
            console.error('❌ Route not found:', routeId);
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
        console.log('✅ Opened edit route modal for:', routeId);
        
    } catch (error) {
        console.error('❌ Error loading route for edit:', error);
        showNotification('Failed to load route data.', 'error');
    }
}

async function updateRoute(routeId, routeData) {
    try {
        if (currentAssociation.is_demo) {
            const routeIndex = demoData.routes.findIndex(r => r.id === routeId);
            if (routeIndex !== -1) {
                demoData.routes[routeIndex] = { ...demoData.routes[routeIndex], ...routeData };
                console.log('✅ Updated demo route:', routeId);
            }
        } else {
            const { error } = await supabase
                .from('routes')
                .update(routeData)
                .eq('id', routeId);
            if (error) throw error;
            console.log('✅ Updated real route:', routeId);
        }

        showNotification('Route updated successfully!', 'success');
        closeModal('add-route-modal');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('❌ Error updating route:', error);
        showNotification('Failed to update route.', 'error');
    }
}

async function deleteRoute(routeId) {
    if (!confirm('Are you sure you want to delete this route?')) return;

    try {
        if (currentAssociation.is_demo) {
            demoData.routes = demoData.routes.filter(r => r.id === routeId);
            console.log('✅ Deleted demo route:', routeId);
        } else {
            const { error } = await supabase
                .from('routes')
                .delete()
                .eq('id', routeId);
            if (error) throw error;
            console.log('✅ Deleted real route:', routeId);
        }

        showNotification('Route deleted successfully!', 'success');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('❌ Error deleting route:', error);
        showNotification('Failed to delete route.', 'error');
    }
}

// ASSOCIATION PROFILE MANAGEMENT
async function saveAssociationProfile() {
    try {
        const logoInput = document.getElementById('edit-association-logo');
        const logoFile = logoInput?.files[0];

        if (logoFile && logoFile.size > 2 * 1024 * 1024) {
            showNotification('Logo file size exceeds 2MB limit.', 'error');
            console.error('❌ Logo file too large:', logoFile.size);
            return;
        }

        const formData = {
            name: document.getElementById('profile-association-name')?.value || '',
            email: document.getElementById('profile-association-email')?.value || '',
            phone: document.getElementById('profile-association-phone')?.value || '',
            address: document.getElementById('profile-association-address')?.value || '',
            description: document.getElementById('profile-association-description')?.value || '',
            admin_name: document.getElementById('profile-admin-name')?.value || '',
            admin_phone: document.getElementById('profile-admin-phone')?.value || '',
            updated_at: new Date().toISOString()
        };

        let logoUrl = currentAssociation.logo_url;

        if (!currentAssociation.is_demo && logoFile) {
            const fileName = `${currentAssociationId}/${Date.now()}_${logoFile.name}`;
            const { data: storageData, error: storageError } = await supabase.storage
                .from('logos')
                .upload(fileName, logoFile, { 
                    cacheControl: '3600', 
                    upsert: false 
                });

            if (storageError) {
                console.error('❌ Logo upload error:', storageError);
                showNotification('Failed to upload logo. Profile saved without logo.', 'warning');
            } else {
                const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
                logoUrl = publicUrlData.publicUrl;
                console.log('✅ New logo uploaded:', logoUrl);
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
            console.log('✅ Updated association profile in database:', currentAssociationId);
        }

        Object.assign(currentAssociation, formData, { logo_url: logoUrl });
        updateAssociationProfile(currentAssociation);
        
        showNotification('Profile updated successfully!', 'success');
        closeModal('profile-modal');
        console.log('✅ Profile modal closed after save');
        
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        showNotification('Failed to update profile.', 'error');
    }
}

// EVENT LISTENERS SETUP
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
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
            console.log('⚡ Quick action clicked:', action);
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
            console.log('🧭 Navigation clicked:', target);
            
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
                console.log('✅ Modal closed via button:', modal.id);
            }
        });
    });

    // Click outside to close modals
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal(e.target.id);
            resetForms();
            console.log('✅ Modal closed via click outside:', e.target.id);
        }
    });

    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
            resetForms();
            console.log('✅ All modals closed via ESC key');
        }
    });

    // Profile modal logo preview
    setupProfileLogoPreview();
    console.log('✅ Event listeners setup complete');
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
                    logoInfo.textContent = '';
                    console.error('❌ Logo file too large:', file.size);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    logoPreviewImg.src = e.target.result;
                    logoPreviewContainer.style.display = 'block';
                    logoInfo.textContent = `File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
                    console.log('✅ Logo preview updated:', file.name);
                };
                reader.readAsDataURL(file);
            }
        });

        removeLogoBtn.addEventListener('click', () => {
            logoInput.value = '';
            logoPreviewContainer.style.display = 'none';
            logoPreviewImg.src = '';
            logoInfo.textContent = '';
            console.log('✅ Logo preview removed');
        });
    } else {
        console.warn('⚠️ Profile logo preview elements missing');
    }
}

function setupFormSubmissions() {
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
                console.error('❌ Form submission error:', error);
                showNotification('Failed to process member form.', 'error');
            }
        });
    }

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
                console.error('❌ Form submission error:', error);
                showNotification('Failed to process route form.', 'error');
            }
        });
    }

    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAssociationProfile();
        });
    }
}

function resetForms() {
    const memberForm = document.getElementById('add-member-form');
    if (memberForm) {
        memberForm.reset();
        memberForm.removeAttribute('data-edit-mode');
        memberForm.removeAttribute('data-member-id');
        document.querySelector('#add-member-modal .modal-header h3').textContent = 'Add New Member';
        console.log('✅ Member form reset');
    }

    const routeForm = document.getElementById('add-route-form');
    if (routeForm) {
        routeForm.reset();
        routeForm.removeAttribute('data-edit-mode');
        routeForm.removeAttribute('data-route-id');
        document.querySelector('#add-route-modal .modal-header h3').textContent = 'Add New Route';
        console.log('✅ Route form reset');
    }

    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.reset();
        const logoInput = document.getElementById('edit-association-logo');
        const logoPreviewContainer = document.getElementById('edit-logo-preview-container');
        const logoPreviewImg = document.getElementById('edit-logo-preview-img');
        const logoInfo = document.getElementById('edit-logo-info');
        if (logoInput) logoInput.value = '';
        if (logoPreviewContainer) logoPreviewContainer.style.display = 'none';
        if (logoPreviewImg) logoPreviewImg.src = '';
        if (logoInfo) logoInfo.textContent = '';
        console.log('✅ Profile form reset');
    }
}

// MODAL MANAGEMENT FUNCTIONS
function openProfileModal() {
    console.log('🔍 Opening profile modal');
    showModal('profile-modal');
    updateAssociationProfileModal(currentAssociation);
    const logoInput = document.getElementById('edit-association-logo');
    if (logoInput) logoInput.value = '';
}

function openMapModal() {
    console.log('🔍 Opening map modal');
    showModal('map-modal');
}

function openAddRouteModal() {
    console.log('🔍 Opening add route modal');
    showModal('add-route-modal');
}

function openAddMemberModal() {
    console.log('🔍 Opening add member modal');
    showModal('add-member-modal');
}

function openManagePartsModal() {
    console.log('🔍 Opening manage parts modal');
    showModal('manage-parts-modal');
}

function openAlertsModal() {
    console.log('🔍 Opening alerts modal');
    showModal('alerts-modal');
}

function openWalletModal() {
    console.log('🔍 Opening wallet modal');
    showModal('wallet-modal');
}

function showModal(modalId) {
    console.log(`✅ Showing modal: ${modalId}`);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        console.error(`❌ Modal ${modalId} not found`);
        showNotification(`Modal ${modalId} not found.`, 'error');
    }
}

function closeModal(modalId) {
    console.log(`✅ Closing modal: ${modalId}`);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
    console.log('✅ All modals closed');
}

async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        console.log('✅ Logged out successfully');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('❌ Error logging out:', error);
        showNotification('Error logging out. Please try again.', 'error');
    }
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-triangle',
        warning: 'exclamation-circle',
        info: 'info-circle'
    };

    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${icons[type] || 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">&times;</button>
    `;

    document.body.appendChild(notification);

    notification.querySelector('.notification-close').addEventListener('click', function() {
        notification.remove();
    });

    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
    console.log(`✅ Notification shown: ${message} (${type})`);
}

// Make functions globally available
window.editMember = editMember;
window.deleteMember = deleteMember;
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;
window.closeModal = closeModal;
window.openAddRouteModal = openAddRouteModal;
window.openAddMemberModal = openAddMemberModal;
window.openProfileModal = openProfileModal;
window.openMapModal = openMapModal;
window.openManagePartsModal = openManagePartsModal;
window.openAlertsModal = openAlertsModal;
window.openWalletModal = openWalletModal;
