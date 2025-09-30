// Association Dashboard - WITH GRACEFUL FALLBACKS
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

// Database table names with fallback handling
const TABLES = {
    ASSOCIATIONS: 'associations',
    MEMBERS: 'members', 
    ROUTES: 'routes',
    VEHICLES: 'vehicles',
    PANIC_ALERTS: 'panic_alerts',
    PARTS: 'parts',
    TRANSACTIONS: 'transactions'
};

// Track which tables exist
let tableStatus = {
    associations: false,
    members: false,
    routes: false,
    vehicles: false,
    panic_alerts: false
};

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
            .select('count')
            .limit(1);

        if (error && error.code === 'PGRST204') {
            console.log(`Table ${tableName} does not exist`);
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

        await Promise.all([
            loadUserData(),
            loadAssociationData()
        ]);

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
    if (!tableStatus.associations || !tableStatus.members || !tableStatus.routes) {
        showNotification('Some database tables are missing. Using demo data for now.', 'warning');
        showNotification('Run setupDatabase() in console to create tables.', 'info');
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
            const { data: data1, error: error1 } = await supabase
                .from(TABLES.ASSOCIATIONS)
                .select('*')
                .eq('admin_id', currentUser.id)
                .single();

            if (!error1 && data1) {
                associationData = data1;
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

        if (tableStatus.vehicles && currentAssociation.id && !currentAssociation.is_demo) {
            const { data: vehicles, error: vehiclesError } = await supabase
                .from(TABLES.VEHICLES)
                .select('id')
                .eq('association_id', currentAssociation.id);

            if (!vehiclesError && vehicles) stats.registeredVehicles = vehicles.length;
        }

        if (tableStatus.members && currentAssociation.id && !currentAssociation.is_demo) {
            const { data: members, error: membersError } = await supabase
                .from(TABLES.MEMBERS)
                .select('id')
                .eq('association_id', currentAssociation.id);

            if (!membersError && members) stats.registeredMembers = members.length;
        }

        if (tableStatus.routes && currentAssociation.id && !currentAssociation.is_demo) {
            const { data: routes, error: routesError } = await supabase
                .from(TABLES.ROUTES)
                .select('id')
                .eq('association_id', currentAssociation.id)
                .eq('status', 'active');

            if (!routesError && routes) stats.activeRoutes = routes.length;
        }

        if (tableStatus.panic_alerts && currentAssociation.id && !currentAssociation.is_demo) {
            const { data: alerts, error: alertsError } = await supabase
                .from(TABLES.PANIC_ALERTS)
                .select('id')
                .eq('association_id', currentAssociation.id)
                .eq('status', 'active');

            if (!alertsError && alerts) stats.passengerAlarms = alerts.length;
        }

        // Use demo data if no real data
        if (currentAssociation.is_demo) {
            stats.registeredVehicles = 12;
            stats.registeredMembers = 8;
            stats.activeRoutes = 5;
            stats.passengerAlarms = 2;
        }

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

        if (tableStatus.members && currentAssociation.id && !currentAssociation.is_demo) {
            const { data, error } = await supabase
                .from(TABLES.MEMBERS)
                .select('*')
                .eq('association_id', currentAssociation.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (!error && data) members = data;
        }

        // Use demo data if no real data
        if (members.length === 0 || currentAssociation.is_demo) {
            members = getDemoMembers();
        }

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
        if (!tableStatus.members) {
            throw new Error('Members table not available');
        }

        const memberWithAssociation = {
            ...memberData,
            association_id: currentAssociation.id,
            created_at: new Date().toISOString()
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
        showNotification('Failed to add member. Using demo mode.', 'warning');
        // In demo mode, just update the UI
        await loadRecentMembers();
        await loadDashboardStats();
        closeModal('add-member-modal');
    }
}

// ... (keep the rest of your existing functions for editMember, updateMember, deleteMember)

// ROUTE MANAGEMENT  
async function loadRecentRoutes() {
    try {
        let routes = [];

        if (tableStatus.routes && currentAssociation.id && !currentAssociation.is_demo) {
            const { data, error } = await supabase
                .from(TABLES.ROUTES)
                .select('*')
                .eq('association_id', currentAssociation.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (!error && data) routes = data;
        }

        // Use demo data if no real data
        if (routes.length === 0 || currentAssociation.is_demo) {
            routes = getDemoRoutes();
        }

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

// ... (keep the rest of your route management functions)

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

        if (tableStatus.associations && !currentAssociation.is_demo) {
            const { error } = await supabase
                .from(TABLES.ASSOCIATIONS)
                .update(formData)
                .eq('admin_id', currentUser.id);

            if (error) throw error;
        }

        // Update current association data (works in both demo and real mode)
        Object.assign(currentAssociation, formData);
        updateAssociationProfile(currentAssociation);
        
        showNotification('Profile updated successfully!', 'success');
        closeModal('profile-modal');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Profile updated locally. Database not available.', 'info');
        // Still update locally
        Object.assign(currentAssociation, formData);
        updateAssociationProfile(currentAssociation);
        closeModal('profile-modal');
    }
}

// ... (keep the rest of your existing functions)

// Make setup function globally available
window.setupDatabase = async function() {
    const setupScript = document.createElement('script');
    setupScript.src = './js/setup-database.js';
    document.head.appendChild(setupScript);
    
    setTimeout(() => {
        if (window.setupDatabase) {
            window.setupDatabase();
        } else {
            showNotification('Setup script loaded. Check console for SQL instructions.', 'info');
        }
    }, 1000);
};

// Make functions globally available
window.editMember = editMember;
window.deleteMember = deleteMember;
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;
window.closeModal = closeModal;
window.openAddRouteModal = openAddRouteModal;
window.openAddMemberModal = openAddMemberModal;
window.openProfileModal = openProfileModal;
