// Association Dashboard - COMPLETE WORKING VERSION WITH DATABASE INTEGRATION
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
let map = null;
let realtimeSubscription = null;

// Database table names
const TABLES = {
    ASSOCIATIONS: 'associations',
    MEMBERS: 'members', 
    ROUTES: 'routes',
    VEHICLES: 'vehicles',
    PANIC_ALERTS: 'panic_alerts',
    PARTS: 'parts',
    TRANSACTIONS: 'transactions'
};

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// Enhanced authentication check
async function checkAssociationAuthentication() {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.log('No authenticated user, redirecting to login');
            window.location.href = 'index.html';
            return null;
        }

        // Verify user role is association
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, name, email')
            .eq('id', user.id)
            .single();

        if (userError || userData?.role !== 'association') {
            console.log('User is not an association, redirecting');
            window.location.href = 'dashboard.html';
            return null;
        }

        return { ...user, ...userData };
    } catch (error) {
        console.error('Authentication check error:', error);
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
        
        initializeRealtimeSubscriptions();

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
    
    // Create or update user info display in header
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

        // Try to get association by admin_id
        const { data, error } = await supabase
            .from(TABLES.ASSOCIATIONS)
            .select('*')
            .eq('admin_id', currentUser.id)
            .single();

        if (error) {
            console.log('No association found, creating new one:', error.message);
            // Create new association
            associationData = await createNewAssociation();
        } else {
            associationData = data;
            console.log('Found existing association:', data);
        }

        currentAssociation = associationData;
        console.log('✅ Association data loaded:', associationData);

        updateAssociationProfile(currentAssociation);
        
    } catch (error) {
        console.error('Error loading association data:', error);
        showNotification('Error loading association data. Using demo mode.', 'error');
        // Fallback to demo data
        currentAssociation = createDemoAssociation();
        updateAssociationProfile(currentAssociation);
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
            .from(TABLES.ASSOCIATIONS)
            .insert([newAssociation])
            .select()
            .single();

        if (error) throw error;

        showNotification('New association created successfully!', 'success');
        return data;
        
    } catch (error) {
        console.error('Error creating association:', error);
        throw error;
    }
}

function createDemoAssociation() {
    return {
        id: 'demo-' + currentUser.id,
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
    // Update association name in header
    const associationNameElement = document.getElementById('association-name');
    if (associationNameElement) {
        associationNameElement.textContent = associationData.association_name || 'Taxi Association';
    }

    // Update association logo
    updateAssociationLogo(associationData.logo_url);

    // Update association details in profile modal
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
}

// Dashboard Data Loading Functions
async function loadDashboardData() {
    try {
        await Promise.all([
            loadDashboardStats(),
            loadRecentMembers(),
            loadRecentRoutes(),
            loadRecentAlerts()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data.', 'error');
    }
}

async function loadDashboardStats() {
    try {
        // Use the database view for stats
        const { data: stats, error } = await supabase
            .from('association_stats')
            .select('*')
            .eq('association_id', currentAssociation.id)
            .single();

        if (error) {
            console.log('Stats view not available, calculating manually:', error.message);
            await loadManualStats();
            return;
        }

        updateDashboardStats({
            registeredVehicles: stats.vehicle_count || 0,
            registeredMembers: stats.member_count || 0,
            activeRoutes: stats.route_count || 0,
            passengerAlarms: stats.active_alerts_count || 0
        });
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        await loadManualStats();
    }
}

async function loadManualStats() {
    try {
        const [vehicles, members, routes, alerts] = await Promise.all([
            supabase.from(TABLES.VEHICLES).select('id').eq('association_id', currentAssociation.id),
            supabase.from(TABLES.MEMBERS).select('id').eq('association_id', currentAssociation.id),
            supabase.from(TABLES.ROUTES).select('id').eq('association_id', currentAssociation.id).eq('status', 'active'),
            supabase.from(TABLES.PANIC_ALERTS).select('id').eq('association_id', currentAssociation.id).eq('status', 'active')
        ]);

        updateDashboardStats({
            registeredVehicles: vehicles.data?.length || 0,
            registeredMembers: members.data?.length || 0,
            activeRoutes: routes.data?.length || 0,
            passengerAlarms: alerts.data?.length || 0
        });
        
    } catch (error) {
        console.error('Error loading manual stats:', error);
        updateDashboardStats({
            registeredVehicles: 0,
            registeredMembers: 0,
            activeRoutes: 0,
            passengerAlarms: 0
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
        const { data: members, error } = await supabase
            .from(TABLES.MEMBERS)
            .select('*')
            .eq('association_id', currentAssociation.id)
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) throw error;

        renderRecentMembers(members || []);
        
    } catch (error) {
        console.error('Error loading recent members:', error);
        renderRecentMembers([]);
    }
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
        const memberWithAssociation = {
            ...memberData,
            association_id: currentAssociation.id
        };

        const { data, error } = await supabase
            .from(TABLES.MEMBERS)
            .insert([memberWithAssociation])
            .select()
            .single();

        if (error) throw error;

        showNotification('Member added successfully!', 'success');
        closeModal('add-member-modal');
        await loadRecentMembers();
        await loadDashboardStats();
        
        return data;
    } catch (error) {
        console.error('Error adding member:', error);
        showNotification('Failed to add member.', 'error');
        throw error;
    }
}

async function editMember(memberId) {
    try {
        const { data: member, error } = await supabase
            .from(TABLES.MEMBERS)
            .select('*')
            .eq('id', memberId)
            .single();

        if (error) throw error;

        // Populate edit form
        document.getElementById('member-email').value = member.member_email || '';
        document.getElementById('member-name').value = member.member_name || '';
        document.getElementById('member-phone').value = member.phone || '';
        document.getElementById('member-role').value = member.role || 'member';
        document.getElementById('member-verified').checked = member.is_verified || false;

        // Change form to edit mode
        const form = document.getElementById('add-member-form');
        form.setAttribute('data-edit-mode', 'true');
        form.setAttribute('data-member-id', memberId);

        // Update modal title
        document.querySelector('#add-member-modal .modal-header h3').textContent = 'Edit Member';

        openAddMemberModal();
        
    } catch (error) {
        console.error('Error loading member for edit:', error);
        showNotification('Failed to load member data.', 'error');
    }
}

async function updateMember(memberId, memberData) {
    try {
        const { error } = await supabase
            .from(TABLES.MEMBERS)
            .update(memberData)
            .eq('id', memberId);

        if (error) throw error;

        showNotification('Member updated successfully!', 'success');
        closeModal('add-member-modal');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error updating member:', error);
        showNotification('Failed to update member.', 'error');
        throw error;
    }
}

async function deleteMember(memberId) {
    if (!confirm('Are you sure you want to delete this member?')) return;

    try {
        const { error } = await supabase
            .from(TABLES.MEMBERS)
            .delete()
            .eq('id', memberId);

        if (error) throw error;

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
        const { data: routes, error } = await supabase
            .from(TABLES.ROUTES)
            .select('*')
            .eq('association_id', currentAssociation.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) throw error;

        renderRecentRoutes(routes || []);
        
    } catch (error) {
        console.error('Error loading recent routes:', error);
        renderRecentRoutes([]);
    }
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
        const routeWithAssociation = {
            ...routeData,
            association_id: currentAssociation.id,
            status: 'active'
        };

        const { data, error } = await supabase
            .from(TABLES.ROUTES)
            .insert([routeWithAssociation])
            .select()
            .single();

        if (error) throw error;

        showNotification('Route added successfully!', 'success');
        closeModal('add-route-modal');
        await loadRecentRoutes();
        await loadDashboardStats();
        
        return data;
    } catch (error) {
        console.error('Error adding route:', error);
        showNotification('Failed to add route.', 'error');
        throw error;
    }
}

async function editRoute(routeId) {
    try {
        const { data: route, error } = await supabase
            .from(TABLES.ROUTES)
            .select('*')
            .eq('id', routeId)
            .single();

        if (error) throw error;

        // Populate edit form
        document.getElementById('route-name').value = route.route_name || '';
        document.getElementById('route-origin').value = route.origin || '';
        document.getElementById('route-destination').value = route.destination || '';
        document.getElementById('route-schedule').value = route.schedule || '';
        document.getElementById('route-waypoints').value = route.waypoints || '';

        // Change form to edit mode
        const form = document.getElementById('add-route-form');
        form.setAttribute('data-edit-mode', 'true');
        form.setAttribute('data-route-id', routeId);

        // Update modal title
        document.querySelector('#add-route-modal .modal-header h3').textContent = 'Edit Route';

        openAddRouteModal();
        
    } catch (error) {
        console.error('Error loading route for edit:', error);
        showNotification('Failed to load route data.', 'error');
    }
}

async function updateRoute(routeId, routeData) {
    try {
        const { error } = await supabase
            .from(TABLES.ROUTES)
            .update(routeData)
            .eq('id', routeId);

        if (error) throw error;

        showNotification('Route updated successfully!', 'success');
        closeModal('add-route-modal');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error updating route:', error);
        showNotification('Failed to update route.', 'error');
        throw error;
    }
}

async function deleteRoute(routeId) {
    if (!confirm('Are you sure you want to delete this route?')) return;

    try {
        const { error } = await supabase
            .from(TABLES.ROUTES)
            .delete()
            .eq('id', routeId);

        if (error) throw error;

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

        const { error } = await supabase
            .from(TABLES.ASSOCIATIONS)
            .update(formData)
            .eq('id', currentAssociation.id);

        if (error) throw error;

        // Update current association data
        Object.assign(currentAssociation, formData);
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

// MODAL MANAGEMENT FUNCTIONS
function openProfileModal() {
    updateAssociationProfileModal(currentAssociation);
    showModal('profile-modal');
}

function openMapModal() {
    showModal('map-modal');
    // Initialize map if needed
    setTimeout(() => {
        if (window.initializeFullScreenMap) {
            window.initializeFullScreenMap();
        }
    }, 100);
}

function openAddRouteModal() {
    showModal('add-route-modal');
}

function openAddMemberModal() {
    showModal('add-member-modal');
}

function openManagePartsModal() {
    showModal('manage-parts-modal');
    loadPartsData();
}

function openAlertsModal() {
    showModal('alerts-modal');
    loadAlertsForModal();
}

function openWalletModal() {
    showModal('wallet-modal');
    loadWalletData();
}

// UTILITY FUNCTIONS
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        console.log('Modal opened:', modalId);
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        console.log('Modal closed:', modalId);
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
    console.log('All modals closed');
}

async function handleLogout() {
    try {
        if (realtimeSubscription) {
            await supabase.removeChannel(realtimeSubscription);
        }
        
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
        showNotification('Error logging out. Please try again.', 'error');
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    // Create new notification
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

    // Add close event
    notification.querySelector('.notification-close').addEventListener('click', function() {
        notification.remove();
    });

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Real-time Subscriptions
function initializeRealtimeSubscriptions() {
    try {
        realtimeSubscription = supabase
            .channel('dashboard-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: TABLES.MEMBERS,
                    filter: `association_id=eq.${currentAssociation.id}`
                },
                (payload) => {
                    console.log('Member update received:', payload);
                    loadDashboardStats();
                    loadRecentMembers();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: TABLES.ROUTES,
                    filter: `association_id=eq.${currentAssociation.id}`
                },
                (payload) => {
                    console.log('Route update received:', payload);
                    loadDashboardStats();
                    loadRecentRoutes();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: TABLES.ASSOCIATIONS,
                    filter: `id=eq.${currentAssociation.id}`
                },
                (payload) => {
                    console.log('Association update received:', payload);
                    if (payload.eventType === 'UPDATE') {
                        Object.assign(currentAssociation, payload.new);
                        updateAssociationProfile(currentAssociation);
                    }
                }
            )
            .subscribe();

        console.log('Real-time subscriptions initialized');
    } catch (error) {
        console.error('Error initializing real-time subscriptions:', error);
    }
}

// PLACEHOLDER FUNCTIONS FOR FUTURE IMPLEMENTATION
async function loadPartsData() {
    // Implementation for parts management
    console.log('Loading parts data...');
}

async function loadAlertsForModal() {
    // Implementation for alerts modal
    console.log('Loading alerts for modal...');
}

async function loadWalletData() {
    // Implementation for wallet
    console.log('Loading wallet data...');
}

async function loadRecentAlerts() {
    // Implementation for recent alerts
    console.log('Loading recent alerts...');
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
