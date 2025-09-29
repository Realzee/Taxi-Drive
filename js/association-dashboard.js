// Supabase Configuration
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

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// Enhanced authentication check
async function checkAssociationAuthentication() {
    try {
        // Check Supabase authentication first
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.log('No authenticated user, redirecting to login');
            window.location.href = 'index.html';
            return null;
        }

        // Verify user role is association
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (userError || userData?.role !== 'association') {
            console.log('User is not an association, redirecting');
            window.location.href = 'dashboard.html';
            return null;
        }

        return user;
    } catch (error) {
        console.error('Authentication check error:', error);
        window.location.href = 'index.html';
        return null;
    }
}

// Initialize dashboard
async function initializeDashboard() {
    try {
        // Check authentication and role
        const user = await checkAssociationAuthentication();
        if (!user) return;

        currentUser = user;
        console.log('Association user authenticated:', user.email);

        // Load user data and association data
        await Promise.all([
            loadUserData(),
            loadAssociationData()
        ]);

        setupEventListeners();
        await loadDashboardData();
        
        // Initialize real-time subscriptions
        initializeRealtimeSubscriptions();

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Failed to initialize dashboard. Please try refreshing.', 'error');
    }
}

async function loadUserData() {
    try {
        // Get user data from users table
        const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        // Update UI with user data
        updateUserProfile(userData);
        
    } catch (error) {
        console.error('Error loading user data:', error);
        // Use basic user info from auth
        updateUserProfile({
            name: currentUser.email.split('@')[0],
            role: 'association',
            email: currentUser.email
        });
    }
}

async function loadAssociationData() {
    try {
        console.log('Loading association data for admin:', currentUser.id);
        
        // Get association data
        let associationData = null;

        // Try to get association by admin_id
        const { data: data1, error: error1 } = await supabase
            .from('associations')
            .select('*')
            .eq('admin_id', currentUser.id)
            .single();

        console.log('Association query result:', { data: data1, error: error1 });

        if (!error1 && data1) {
            associationData = data1;
        } else {
            // Try alternative: get any association data
            const { data: allAssociations, error: allError } = await supabase
                .from('associations')
                .select('*');

            if (!allError && allAssociations && allAssociations.length > 0) {
                associationData = allAssociations.find(assoc => 
                    assoc.admin_id === currentUser.id || 
                    assoc.email === currentUser.email
                );
            }
        }

        if (!associationData) {
            console.warn('No association data found in database');
            // Create default association data
            associationData = {
                association_name: 'My Taxi Association',
                email: currentUser.email,
                phone: '',
                address: '',
                admin_id: currentUser.id,
                admin_name: currentUser.email.split('@')[0],
                admin_phone: '',
                description: '',
                logo_url: null,
                wallet_balance: 0,
                created_at: new Date().toISOString()
            };
        }

        currentAssociation = associationData;
        console.log('✅ Association data loaded:', associationData);

        // Update UI with association data
        updateAssociationProfile(currentAssociation);
        
    } catch (error) {
        console.error('Error loading association data:', error);
        
        // Create fallback association data
        currentAssociation = {
            association_name: 'My Taxi Association',
            email: currentUser.email,
            phone: '',
            address: '',
            admin_id: currentUser.id,
            admin_name: currentUser.email.split('@')[0],
            admin_phone: '',
            description: '',
            logo_url: null,
            wallet_balance: 0,
            created_at: new Date().toISOString()
        };
        
        updateAssociationProfile(currentAssociation);
        showNotification('Using demo association data. Complete your association profile setup.', 'warning');
    }
}

function updateUserProfile(userData) {
    const userNameElement = document.getElementById('user-name');
    const userRoleElement = document.getElementById('user-role');
    const userAvatarElement = document.getElementById('user-avatar');

    if (userNameElement) userNameElement.textContent = userData.name || userData.email;
    if (userRoleElement) userRoleElement.textContent = userData.role || 'Association';
    if (userAvatarElement) userAvatarElement.textContent = (userData.name || userData.email).charAt(0).toUpperCase();
}

function updateAssociationProfile(associationData) {
    // Update association name in header
    const associationNameElement = document.getElementById('association-name');
    const associationNameMainElement = document.getElementById('association-name-main');

    if (associationNameElement) associationNameElement.textContent = associationData.association_name || 'Taxi Association';
    if (associationNameMainElement) associationNameMainElement.textContent = associationData.association_name || 'Taxi Association';

    // Update association details in profile modal
    updateAssociationProfileModal(associationData);

    // Update association logo
    if (associationData.logo_url) {
        updateAssociationLogo(associationData.logo_url);
    }
}

function updateAssociationLogo(logoUrl) {
    const associationLogoElement = document.getElementById('association-logo');
    const associationLogoMainElement = document.getElementById('association-logo-main');

    if (logoUrl) {
        if (associationLogoElement) {
            associationLogoElement.src = logoUrl;
            associationLogoElement.style.display = 'block';
        }
        if (associationLogoMainElement) {
            associationLogoMainElement.src = logoUrl;
            associationLogoMainElement.style.display = 'block';
        }
        
        // Hide main logos
        const mainLogo = document.getElementById('main-logo');
        const mainLogoMain = document.getElementById('main-logo-main');
        if (mainLogo) mainLogo.style.display = 'none';
        if (mainLogoMain) mainLogoMain.style.display = 'none';
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

        // Load vehicles count
        try {
            const { data: vehicles, error } = await supabase
                .from('vehicles')
                .select('id')
                .eq('association_id', currentAssociation.id);

            if (!error && vehicles) stats.registeredVehicles = vehicles.length;
        } catch (error) {
            console.log('Vehicles table not available');
        }

        // Load members count (using users table as fallback)
        try {
            const { data: members, error } = await supabase
                .from('members')
                .select('id')
                .eq('association_id', currentAssociation.id);

            if (!error && members) {
                stats.registeredMembers = members.length;
            } else {
                // Fallback to users table
                const { data: owners, error: ownersError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', 'owner');

                const { data: drivers, error: driversError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', 'driver');

                if (!ownersError && owners) stats.registeredMembers += owners.length;
                if (!driversError && drivers) stats.registeredMembers += drivers.length;
            }
        } catch (error) {
            console.log('Members table not available');
        }

        // Load routes count
        try {
            const { data: routes, error } = await supabase
                .from('routes')
                .select('id')
                .eq('association_id', currentAssociation.id)
                .eq('status', 'active');

            if (!error && routes) stats.activeRoutes = routes.length;
        } catch (error) {
            console.log('Routes table not available');
        }

        // Load alerts count
        try {
            const { data: alerts, error } = await supabase
                .from('panic_alerts')
                .select('id')
                .eq('association_id', currentAssociation.id)
                .eq('status', 'active');

            if (!error && alerts) stats.passengerAlarms = alerts.length;
        } catch (error) {
            console.log('Panic alerts table not available');
        }

        console.log('Dashboard stats:', stats);
        updateDashboardStats(stats);
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
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

async function loadRecentMembers() {
    try {
        let recentMembers = [];

        // Try to load from members table
        try {
            const { data: members, error } = await supabase
                .from('members')
                .select('*')
                .eq('association_id', currentAssociation.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (!error && members) {
                recentMembers = members.map(member => ({
                    id: member.id,
                    name: member.member_name,
                    email: member.member_email,
                    role: 'member',
                    is_verified: member.is_verified,
                    created_at: member.created_at
                }));
            }
        } catch (error) {
            console.log('Members table not available, using users as fallback');
            
            // Fallback to users table
            const { data: owners, error: ownersError } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'owner')
                .order('created_at', { ascending: false })
                .limit(3);

            const { data: drivers, error: driversError } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'driver')
                .order('created_at', { ascending: false })
                .limit(3);

            if (!ownersError && owners) recentMembers.push(...owners);
            if (!driversError && drivers) recentMembers.push(...drivers);

            recentMembers = recentMembers
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 3);
        }

        renderRecentMembers(recentMembers);
        
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
                    <h4>${member.name || 'Unnamed Member'}</h4>
                    <p>${member.email || 'N/A'}</p>
                    <p class="member-role">${member.role} • <span class="status-indicator ${statusClass}">${statusText}</span></p>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editMember('${member.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="removeMember('${member.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    recentMembersContent.innerHTML = membersHtml;
}

async function loadRecentRoutes() {
    try {
        let recentRoutes = [];

        // Try to load from routes table
        try {
            const { data: routes, error } = await supabase
                .from('routes')
                .select('*')
                .eq('association_id', currentAssociation.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(3);

            if (!error && routes) {
                recentRoutes = routes;
            }
        } catch (error) {
            console.log('Routes table not available, using demo data');
            // Demo data
            recentRoutes = [
                {
                    id: '1',
                    route_name: 'City Center Route',
                    origin: 'Downtown',
                    destination: 'City Center',
                    schedule: 'Daily 6AM-10PM',
                    status: 'active'
                },
                {
                    id: '2', 
                    route_name: 'Airport Express',
                    origin: 'Central Station',
                    destination: 'International Airport',
                    schedule: 'Every 30 mins',
                    status: 'active'
                }
            ];
        }

        renderRecentRoutes(recentRoutes);
        
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
                    <button class="btn btn-danger btn-sm" onclick="removeRoute('${route.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });

    recentRoutesContent.innerHTML = routesHtml;
}

async function loadRecentAlerts() {
    try {
        let alertCount = 0;
        
        try {
            const { data: alerts, error } = await supabase
                .from('panic_alerts')
                .select('*')
                .eq('association_id', currentAssociation.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(5);

            if (!error && alerts) {
                alertCount = alerts.length;
            }
        } catch (error) {
            console.log('Panic alerts table not available');
        }

        updateAlertBadge(alertCount);
        
    } catch (error) {
        console.error('Error loading recent alerts:', error);
        updateAlertBadge(0);
    }
}

function updateAlertBadge(count) {
    const alertBadge = document.getElementById('alert-badge');
    const alertCount = document.getElementById('alert-count');
    
    if (alertBadge) {
        alertBadge.style.display = count > 0 ? 'flex' : 'none';
    }
    
    if (alertCount) {
        alertCount.textContent = count;
    }
}

// Real-time Subscriptions
function initializeRealtimeSubscriptions() {
    try {
        // Subscribe to vehicles table for real-time updates
        realtimeSubscription = supabase
            .channel('dashboard-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'vehicles'
                },
                (payload) => {
                    console.log('Vehicle update received:', payload);
                    loadDashboardStats();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'panic_alerts'
                },
                (payload) => {
                    console.log('Alert update received:', payload);
                    loadDashboardStats();
                    loadRecentAlerts();
                }
            )
            .subscribe();

        console.log('Real-time subscriptions initialized');
    } catch (error) {
        console.error('Error initializing real-time subscriptions:', error);
    }
}

// Map Functions
function initializeMap() {
    if (!map) {
        map = L.map('map').setView([-26.2041, 28.0473], 10); // Johannesburg coordinates
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        loadVehicleMarkers();
    }
    return map;
}

function initializeFullScreenMap() {
    const fullMap = L.map('full-map').setView([-26.2041, 28.0473], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(fullMap);
    
    loadVehicleMarkers(fullMap);
    return fullMap;
}

async function loadVehicleMarkers(targetMap = null) {
    try {
        const mapToUse = targetMap || map;
        if (!mapToUse) return;

        // Clear existing markers
        if (window.vehicleMarkers) {
            window.vehicleMarkers.forEach(marker => mapToUse.removeLayer(marker));
        }
        window.vehicleMarkers = [];

        // Load vehicles with locations
        const { data: vehicles, error } = await supabase
            .from('vehicles')
            .select('vehicle_reg, last_location, driver_name')
            .eq('association_id', currentAssociation.id)
            .not('last_location', 'is', null);

        if (error) {
            console.error('Error loading vehicles for map:', error);
            return;
        }

        if (vehicles && vehicles.length > 0) {
            vehicles.forEach(vehicle => {
                if (vehicle.last_location) {
                    const [lat, lng] = vehicle.last_location.split(',').map(coord => parseFloat(coord.trim()));
                    const marker = L.marker([lat, lng]).addTo(mapToUse);
                    
                    marker.bindPopup(`
                        <div class="vehicle-popup">
                            <h4>${vehicle.vehicle_reg || 'Unknown Vehicle'}</h4>
                            <p>Driver: ${vehicle.driver_name || 'Unknown'}</p>
                            <p>Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
                        </div>
                    `);
                    
                    window.vehicleMarkers.push(marker);
                }
            });

            // Fit map to show all markers
            if (window.vehicleMarkers.length > 0) {
                const group = new L.featureGroup(window.vehicleMarkers);
                mapToUse.fitBounds(group.getBounds().pad(0.1));
            }
        }
    } catch (error) {
        console.error('Error loading vehicle markers:', error);
    }
}

// Modal Management Functions
function openProfileModal() {
    updateAssociationProfileModal(currentAssociation);
    showModal('profile-modal');
}

function openMapModal() {
    showModal('map-modal');
    setTimeout(() => {
        initializeFullScreenMap();
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
}

function openAlertsModal() {
    showModal('alerts-modal');
    loadAlertsForModal();
}

function openWalletModal() {
    showModal('wallet-modal');
    loadWalletData();
}

async function saveAssociationProfile() {
    try {
        const formData = {
            association_name: document.getElementById('profile-association-name')?.value || '',
            email: document.getElementById('profile-association-email')?.value || '',
            phone: document.getElementById('profile-association-phone')?.value || '',
            address: document.getElementById('profile-association-address')?.value || '',
            description: document.getElementById('profile-association-description')?.value || '',
            admin_name: document.getElementById('profile-admin-name')?.value || '',
            admin_phone: document.getElementById('profile-admin-phone')?.value || ''
        };

        if (currentAssociation.id && !currentAssociation.id.startsWith('temp-')) {
            // Update existing association
            const { error } = await supabase
                .from('associations')
                .update(formData)
                .eq('admin_id', currentUser.id);

            if (error) throw error;
        } else {
            // Create new association
            formData.admin_id = currentUser.id;
            formData.created_at = new Date().toISOString();
            
            const { data, error } = await supabase
                .from('associations')
                .insert([formData])
                .select();

            if (error) throw error;
            
            if (data && data.length > 0) {
                currentAssociation = data[0];
            }
        }

        Object.assign(currentAssociation, formData);
        updateAssociationProfile(currentAssociation);
        
        showNotification('Profile updated successfully!', 'success');
        closeModal('profile-modal');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile.', 'error');
    }
}

async function loadAlertsForModal() {
    try {
        const alertsContent = document.getElementById('alerts-modal-content');
        if (!alertsContent) return;

        let alerts = [];

        try {
            const { data, error } = await supabase
                .from('panic_alerts')
                .select('*')
                .eq('association_id', currentAssociation.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (!error && data) alerts = data;
        } catch (error) {
            console.log('Panic alerts table not available');
        }

        if (alerts.length === 0) {
            alertsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bell-slash"></i>
                    <h3>No Active Alerts</h3>
                    <p>All clear! No panic alerts at the moment.</p>
                </div>
            `;
            return;
        }

        let alertsHtml = '';
        alerts.forEach(alert => {
            const alertTime = new Date(alert.created_at).toLocaleString();
            alertsHtml += `
                <div class="alert-item">
                    <div class="alert-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="alert-details">
                        <h4>Panic Alert</h4>
                        <p>Location: ${alert.lat || 'N/A'}, ${alert.lng || 'N/A'}</p>
                        <p>Time: ${alertTime}</p>
                    </div>
                    <div class="alert-actions">
                        <button class="btn btn-success btn-sm" onclick="resolveAlert('${alert.id}')">
                            <i class="fas fa-check"></i> Resolve
                        </button>
                    </div>
                </div>
            `;
        });

        alertsContent.innerHTML = alertsHtml;
    } catch (error) {
        console.error('Error loading alerts for modal:', error);
    }
}

async function resolveAlert(alertId) {
    try {
        const { error } = await supabase
            .from('panic_alerts')
            .update({ status: 'resolved' })
            .eq('id', alertId);

        if (error) throw error;

        showNotification('Alert resolved successfully!', 'success');
        loadAlertsForModal();
        loadDashboardStats();
        
    } catch (error) {
        console.error('Error resolving alert:', error);
        showNotification('Failed to resolve alert.', 'error');
    }
}

async function loadWalletData() {
    try {
        // This would load transaction history and update wallet balance
        const walletBalance = document.getElementById('wallet-balance');
        if (walletBalance) {
            walletBalance.textContent = `R ${(currentAssociation.wallet_balance || 0).toFixed(2)}`;
        }
    } catch (error) {
        console.error('Error loading wallet data:', error);
    }
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

    // Map toggle
    const mapToggle = document.getElementById('map-toggle');
    const mapSection = document.getElementById('map-section');
    if (mapToggle && mapSection) {
        mapToggle.addEventListener('click', function() {
            const isVisible = mapSection.style.display !== 'none';
            mapSection.style.display = isVisible ? 'none' : 'block';
            this.textContent = isVisible ? 'Show Map' : 'Hide Map';
            
            if (!isVisible && !map) {
                setTimeout(() => {
                    initializeMap();
                }, 100);
            }
        });
    }

    // Modal close buttons
    const closeBtns = document.querySelectorAll('.modal-close, .btn-cancel');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal-overlay');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAssociationProfile();
        });
    }

    // Click outside to close modals
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal(e.target.id);
        }
    });

    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

async function handleLogout() {
    try {
        // Clean up real-time subscriptions
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
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Placeholder functions
function editMember(memberId) {
    showNotification(`Edit member ${memberId} - Feature coming soon`, 'info');
}

function removeMember(memberId) {
    if (confirm('Are you sure you want to remove this member?')) {
        showNotification(`Remove member ${memberId} - Feature coming soon`, 'info');
    }
}

function editRoute(routeId) {
    showNotification(`Edit route ${routeId} - Feature coming soon`, 'info');
}

function removeRoute(routeId) {
    if (confirm('Are you sure you want to remove this route?')) {
        showNotification(`Remove route ${routeId} - Feature coming soon`, 'info');
    }
}

// Make functions globally available
window.editMember = editMember;
window.removeMember = removeMember;
window.editRoute = editRoute;
window.removeRoute = removeRoute;
window.closeModal = closeModal;
window.resolveAlert = resolveAlert;