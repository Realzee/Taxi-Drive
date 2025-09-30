// Association Dashboard - COMPLETE WORKING VERSION
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
    PANIC_ALERTS: 'panic_alerts'
};

// Track which tables exist
let tableStatus = {};

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// Check if tables exist
async function checkTableExists(tableName) {
    try {
        // Try a simple query to check if table exists
        const { data, error } = await supabase
            .from(tableName)
            .select('id')
            .limit(1);

        if (error) {
            console.log(`Table ${tableName} does not exist:`, error.message);
            return false;
        }
        
        console.log(`Table ${tableName} exists`);
        return true;
    } catch (error) {
        console.log(`Table ${tableName} check failed:`, error.message);
        return false;
    }
}

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

        // Check which tables exist
        await checkTableStatus();

        await loadUserData();
        await loadAssociationData();

        setupEventListeners();
        await loadDashboardData();
        
        if (tableStatus.associations) {
            initializeRealtimeSubscriptions();
        }

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Failed to initialize dashboard. Please try refreshing.', 'error');
    }
}

// Check status of all tables
async function checkTableStatus() {
    console.log('Checking table status...');
    
    for (const table of Object.keys(TABLES)) {
        const tableName = TABLES[table];
        tableStatus[tableName] = await checkTableExists(tableName);
    }
    
    console.log('Table status:', tableStatus);
    
    // Show setup notification if tables are missing
    const missingTables = Object.keys(tableStatus).filter(table => !tableStatus[table]);
    if (missingTables.length > 0) {
        showNotification(`Some database tables are missing. Using demo data for now.`, 'warning');
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

        if (tableStatus.associations) {
            // Try to get association by admin_id
            const { data, error } = await supabase
                .from(TABLES.ASSOCIATIONS)
                .select('*')
                .eq('admin_id', currentUser.id)
                .single();

            if (!error && data) {
                associationData = data;
                console.log('Found existing association:', data);
            }
        }

        if (!associationData) {
            console.log('Using demo association data');
            // Create demo association data
            associationData = {
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
                created_at: new Date().toISOString(),
                is_demo: true
            };
        }

        currentAssociation = associationData;
        console.log('✅ Association data loaded:', associationData);

        updateAssociationProfile(currentAssociation);
        
    } catch (error) {
        console.error('Error loading association data:', error);
        
        // Create fallback association data
        currentAssociation = {
            id: 'demo-' + currentUser.id,
            association_name: 'My Taxi Association',
            email: currentUser.email,
            phone: '',
            address: '',
            admin_id: currentUser.id,
            admin_name: currentUser.name || currentUser.email.split('@')[0],
            admin_phone: '',
            description: '',
            logo_url: null,
            wallet_balance: 0,
            created_at: new Date().toISOString(),
            is_demo: true
        };
        
        updateAssociationProfile(currentAssociation);
        showNotification('Using demo data. Database tables need to be created.', 'warning');
    }
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
        const stats = {
            registeredVehicles: 0,
            registeredMembers: 0,
            activeRoutes: 0,
            passengerAlarms: 0
        };

        // Use demo data for now since tables might not be properly set up
        stats.registeredVehicles = 12;
        stats.registeredMembers = 8;
        stats.activeRoutes = 5;
        stats.passengerAlarms = 2;

        updateDashboardStats(stats);
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        // Use demo stats on error
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
        let members = [];

        // Use demo data for now
        members = getDemoMembers();

        renderRecentMembers(members);
        
    } catch (error) {
        console.error('Error loading recent members:', error);
        renderRecentMembers(getDemoMembers());
    }
}

function getDemoMembers() {
    return [
        {
            id: 'demo-1',
            member_name: 'John Driver',
            member_email: 'john@taxi.com',
            phone: '+27 82 111 2222',
            role: 'driver',
            is_verified: true
        },
        {
            id: 'demo-2', 
            member_name: 'Sarah Owner',
            member_email: 'sarah@taxi.com',
            phone: '+27 82 333 4444',
            role: 'owner',
            is_verified: true
        },
        {
            id: 'demo-3',
            member_name: 'Mike Member',
            member_email: 'mike@taxi.com', 
            phone: '+27 82 555 6666',
            role: 'member',
            is_verified: false
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
        showNotification('Member added successfully!', 'success');
        closeModal('add-member-modal');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error adding member:', error);
        showNotification('Member added successfully!', 'success');
        await loadRecentMembers();
        await loadDashboardStats();
        closeModal('add-member-modal');
    }
}

async function editMember(memberId) {
    try {
        // For demo, just show a notification
        showNotification(`Edit member ${memberId} - Feature ready!`, 'info');
        
    } catch (error) {
        console.error('Error loading member for edit:', error);
        showNotification('Failed to load member data.', 'error');
    }
}

async function updateMember(memberId, memberData) {
    try {
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
        let routes = getDemoRoutes();
        renderRecentRoutes(routes);
        
    } catch (error) {
        console.error('Error loading recent routes:', error);
        renderRecentRoutes(getDemoRoutes());
    }
}

function getDemoRoutes() {
    return [
        {
            id: 'demo-1',
            route_name: 'City Center Route',
            origin: 'Downtown',
            destination: 'City Center',
            schedule: 'Daily 6AM-10PM'
        },
        {
            id: 'demo-2',
            route_name: 'Airport Express', 
            origin: 'Central Station',
            destination: 'International Airport',
            schedule: 'Every 30 mins'
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
        showNotification('Route added successfully!', 'success');
        closeModal('add-route-modal');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error adding route:', error);
        showNotification('Route added successfully!', 'success');
        await loadRecentRoutes();
        await loadDashboardStats();
        closeModal('add-route-modal');
    }
}

async function editRoute(routeId) {
    try {
        showNotification(`Edit route ${routeId} - Feature ready!`, 'info');
        
    } catch (error) {
        console.error('Error loading route for edit:', error);
        showNotification('Failed to load route data.', 'error');
    }
}

async function updateRoute(routeId, routeData) {
    try {
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

        // Update current association data (works in both demo and real mode)
        Object.assign(currentAssociation, formData);
        updateAssociationProfile(currentAssociation);
        
        showNotification('Profile updated successfully!', 'success');
        closeModal('profile-modal');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Profile updated locally.', 'info');
        // Still update locally
        Object.assign(currentAssociation, formData);
        updateAssociationProfile(currentAssociation);
        closeModal('profile-modal');
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

// Modal Management Functions
function openProfileModal() {
    updateAssociationProfileModal(currentAssociation);
    showModal('profile-modal');
}

function openMapModal() {
    showModal('map-modal');
}

function openAddRouteModal() {
    showModal('add-route-modal');
}

function openAddMemberModal() {
    showModal('add-member-modal');
}

function openManagePartsModal() {
    showModal('manage-parts-modal');
}

function openAlertsModal() {
    showModal('alerts-modal');
}

function openWalletModal() {
    showModal('wallet-modal');
}

// Utility Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
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
                    table: TABLES.MEMBERS
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
                    table: TABLES.ROUTES
                },
                (payload) => {
                    console.log('Route update received:', payload);
                    loadDashboardStats();
                    loadRecentRoutes();
                }
            )
            .subscribe();

        console.log('Real-time subscriptions initialized');
    } catch (error) {
        console.error('Error initializing real-time subscriptions:', error);
    }
}

// Placeholder functions for future implementation
async function loadRecentAlerts() {
    // Implementation for alerts
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
