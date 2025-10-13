// Association Dashboard JavaScript
console.log('Association dashboard script loaded');

// Global variables
let supabase;
let currentAssociationId = null;
let map = null;
let vehicleMarkers = {};
let realtimeSubscription = null;

// DOM Elements
const elements = {
    statVehicles: document.getElementById('stat-vehicles'),
    statMembers: document.getElementById('stat-members'),
    statRoutes: document.getElementById('stat-routes'),
    statAlarms: document.getElementById('stat-alarms'),
    recentMembersContent: document.getElementById('recent-members-content'),
    recentRoutesContent: document.getElementById('recent-routes-content'),
    walletBalance: document.getElementById('wallet-balance'),
    alertBadge: document.getElementById('alert-badge'),
    alertCount: document.getElementById('alert-count')
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing dashboard...');
    initializeSupabase();
    checkAuthAndInitialize();
});

// Initialize Supabase
function initializeSupabase() {
    const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5MjQxNDcsImV4cCI6MjA0ODUwMDE0N30.9_jm6O1ZQICJ1J5-rSdfx0xJ4OSrf2luteOPKJWeBzM';

    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized');
}

// Check authentication and initialize dashboard
async function checkAuthAndInitialize() {
    try {
        console.log('Checking authentication status...');
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            console.error('Session error:', sessionError);
            redirectToLogin();
            return;
        }

        if (!session) {
            console.log('No session found, redirecting to login');
            redirectToLogin();
            return;
        }

        console.log('User authenticated:', session.user.id, session.user.email);
        currentAssociationId = session.user.id;

        // Initialize dashboard components
        await initializeDashboard();
        setupEventListeners();
        
    } catch (error) {
        console.error('Error checking authentication:', error);
        redirectToLogin();
    }
}

// Initialize dashboard components
async function initializeDashboard() {
    try {
        console.log('Initializing dashboard components...');
        
        // Load association data
        const association = await loadAssociationData();
        if (!association) {
            console.error('No association data found');
            showNotification('Error: Association data not found', 'error');
            return;
        }
        
        // Load dashboard stats
        await loadDashboardStats();
        
        // Load recent data
        await loadRecentMembers();
        await loadRecentRoutes();
        
        // Set up realtime subscriptions
        setupRealtimeSubscriptions();
        
        // Initialize map if modal exists
        initializeMap();
        
        console.log('Dashboard initialized successfully');
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error loading dashboard. Please refresh the page.', 'error');
    }
}

// Load association data
async function loadAssociationData() {
    try {
        console.log('Loading association data for ID:', currentAssociationId);
        
        const { data: association, error } = await supabase
            .from('associations')
            .select('id, association_name, email, phone, address, description, admin_name, admin_phone, logo_url, wallet_balance')
            .eq('id', currentAssociationId)
            .single();

        if (error) {
            console.error('Error fetching association:', error);
            
            // If association doesn't exist, create a default one
            if (error.code === 'PGRST116') {
                console.log('No association found, creating default association...');
                return await createDefaultAssociation();
            }
            
            throw error;
        }

        if (!association) {
            console.error('No association found for ID:', currentAssociationId);
            return await createDefaultAssociation();
        }

        console.log('Association data loaded:', association);
        
        // Update wallet balance
        if (elements.walletBalance) {
            elements.walletBalance.textContent = `R ${(association.wallet_balance || 0).toFixed(2)}`;
        }
        
        return association;
        
    } catch (error) {
        console.error('Error in loadAssociationData:', error);
        throw error;
    }
}

// Create default association if none exists
async function createDefaultAssociation() {
    try {
        console.log('Creating default association for user:', currentAssociationId);
        
        const { data: user } = await supabase.auth.getUser();
        const userEmail = user.user.email;
        
        const defaultAssociation = {
            id: currentAssociationId,
            association_name: `${userEmail.split('@')[0]} Association`,
            email: userEmail,
            phone: '',
            address: '',
            description: 'Taxi association management',
            admin_name: userEmail.split('@')[0],
            admin_phone: '',
            wallet_balance: 0,
            created_at: new Date().toISOString()
        };

        const { data: association, error } = await supabase
            .from('associations')
            .insert([defaultAssociation])
            .select()
            .single();

        if (error) {
            console.error('Error creating default association:', error);
            throw error;
        }

        console.log('Default association created:', association);
        return association;
        
    } catch (error) {
        console.error('Error creating default association:', error);
        throw error;
    }
}

// Redirect to login
function redirectToLogin() {
    console.log('Redirecting to login page...');
    window.location.href = 'index.html';
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        if (!currentAssociationId) {
            console.error('No association ID available');
            return;
        }

        console.log('Loading dashboard stats for association:', currentAssociationId);

        // Load vehicles count
        const { count: vehiclesCount, error: vehiclesError } = await supabase
            .from('vehicles')
            .select('*', { count: 'exact', head: true })
            .eq('association_id', currentAssociationId);

        if (vehiclesError) {
            console.error('Error fetching vehicles count:', vehiclesError);
        } else {
            elements.statVehicles.textContent = vehiclesCount || 0;
        }

        // Load members count
        const { count: membersCount, error: membersError } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true })
            .eq('association_id', currentAssociationId);

        if (membersError) {
            console.error('Error fetching members count:', membersError);
        } else {
            elements.statMembers.textContent = membersCount || 0;
        }

        // Load routes count
        const { count: routesCount, error: routesError } = await supabase
            .from('routes')
            .select('*', { count: 'exact', head: true })
            .eq('association_id', currentAssociationId);

        if (routesError) {
            console.error('Error fetching routes count:', routesError);
        } else {
            elements.statRoutes.textContent = routesCount || 0;
        }

        // Load alarms count
        const { count: alarmsCount, error: alarmsError } = await supabase
            .from('alarms')
            .select('*', { count: 'exact', head: true })
            .eq('association_id', currentAssociationId)
            .eq('resolved', false);

        if (alarmsError) {
            console.error('Error fetching alarms count:', alarmsError);
        } else {
            elements.statAlarms.textContent = alarmsCount || 0;
            
            // Update alert badge
            if (alarmsCount > 0) {
                elements.alertBadge.style.display = 'flex';
                elements.alertCount.textContent = alarmsCount;
            } else {
                elements.alertBadge.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load recent members
async function loadRecentMembers() {
    try {
        if (!currentAssociationId) return;

        const { data: members, error } = await supabase
            .from('members')
            .select('id, name, role, email, phone, is_verified, created_at')
            .eq('association_id', currentAssociationId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error fetching recent members:', error);
            return;
        }

        if (!members || members.length === 0) {
            elements.recentMembersContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Owners Yet</h3>
                    <p>Start by adding owners to your association.</p>
                </div>
            `;
            return;
        }

        const membersHTML = members.map(member => `
            <div class="list-item">
                <div class="item-info">
                    <h4>${member.name}</h4>
                    <p>${member.email} • ${member.role}</p>
                </div>
                <div class="item-actions">
                    <span class="status-badge ${member.is_verified ? 'verified' : 'pending'}">
                        ${member.is_verified ? 'Verified' : 'Pending'}
                    </span>
                </div>
            </div>
        `).join('');

        elements.recentMembersContent.innerHTML = membersHTML;

    } catch (error) {
        console.error('Error loading recent members:', error);
    }
}

// Load recent routes
async function loadRecentRoutes() {
    try {
        if (!currentAssociationId) return;

        const { data: routes, error } = await supabase
            .from('routes')
            .select('id, name, origin, destination, schedule, is_active')
            .eq('association_id', currentAssociationId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error fetching recent routes:', error);
            return;
        }

        if (!routes || routes.length === 0) {
            elements.recentRoutesContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-route"></i>
                    <h3>No Routes Yet</h3>
                    <p>Create your first route to get started.</p>
                </div>
            `;
            return;
        }

        const routesHTML = routes.map(route => `
            <div class="list-item">
                <div class="item-info">
                    <h4>${route.name}</h4>
                    <p>${route.origin} → ${route.destination}</p>
                    <small>Schedule: ${route.schedule}</small>
                </div>
                <div class="item-actions">
                    <span class="status-badge ${route.is_active ? 'active' : 'inactive'}">
                        ${route.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
        `).join('');

        elements.recentRoutesContent.innerHTML = routesHTML;

    } catch (error) {
        console.error('Error loading recent routes:', error);
    }
}

// Initialize map
function initializeMap() {
    try {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.log('Map element not found, skipping map initialization');
            return;
        }

        // Default center (Johannesburg)
        const defaultCenter = [-26.2041, 28.0473];
        
        map = L.map('map').setView(defaultCenter, 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);

        console.log('Map initialized successfully');
        
        // Load vehicle locations
        loadVehicleLocations();
        
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Load vehicle locations on map
async function loadVehicleLocations() {
    try {
        if (!currentAssociationId || !map) return;

        const { data: vehicles, error } = await supabase
            .from('vehicles')
            .select('id, license_plate, current_lat, current_lng, driver_name, status')
            .eq('association_id', currentAssociationId)
            .not('current_lat', 'is', null)
            .not('current_lng', 'is', null);

        if (error) {
            console.error('Error fetching vehicle locations:', error);
            return;
        }

        // Clear existing markers
        Object.values(vehicleMarkers).forEach(marker => map.removeLayer(marker));
        vehicleMarkers = {};

        // Add new markers
        vehicles.forEach(vehicle => {
            if (vehicle.current_lat && vehicle.current_lng) {
                const marker = L.marker([vehicle.current_lat, vehicle.current_lng])
                    .addTo(map)
                    .bindPopup(`
                        <div class="vehicle-popup">
                            <h4>${vehicle.license_plate}</h4>
                            <p>Driver: ${vehicle.driver_name || 'Unknown'}</p>
                            <p>Status: ${vehicle.status || 'Unknown'}</p>
                        </div>
                    `);
                
                vehicleMarkers[vehicle.id] = marker;
            }
        });

        // Adjust map view to show all markers if there are any
        if (vehicles.length > 0) {
            const group = new L.featureGroup(Object.values(vehicleMarkers));
            map.fitBounds(group.getBounds().pad(0.1));
        }

    } catch (error) {
        console.error('Error loading vehicle locations:', error);
    }
}

// Set up realtime subscriptions
function setupRealtimeSubscriptions() {
    try {
        if (!currentAssociationId) {
            console.error('Cannot set up realtime: currentAssociationId is null');
            return;
        }

        console.log('Setting up realtime subscriptions for association:', currentAssociationId);

        // Subscribe to vehicle location updates
        const vehicleSubscription = supabase
            .channel('vehicle-locations')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'vehicles',
                    filter: `association_id=eq.${currentAssociationId}`
                }, 
                (payload) => {
                    console.log('Vehicle update received:', payload);
                    handleVehicleUpdate(payload);
                }
            )
            .subscribe();

        // Subscribe to alarm updates
        const alarmSubscription = supabase
            .channel('alarm-updates')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'alarms',
                    filter: `association_id=eq.${currentAssociationId}`
                },
                (payload) => {
                    console.log('Alarm update received:', payload);
                    handleAlarmUpdate(payload);
                }
            )
            .subscribe();

        realtimeSubscription = { vehicleSubscription, alarmSubscription };
        console.log('Realtime subscriptions established');

    } catch (error) {
        console.error('Error setting up realtime subscriptions:', error);
    }
}

// Handle vehicle updates from realtime
function handleVehicleUpdate(payload) {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const vehicle = payload.new;
        if (vehicle.current_lat && vehicle.current_lng && map) {
            // Update or add marker
            if (vehicleMarkers[vehicle.id]) {
                vehicleMarkers[vehicle.id].setLatLng([vehicle.current_lat, vehicle.current_lng]);
            } else {
                const marker = L.marker([vehicle.current_lat, vehicle.current_lng])
                    .addTo(map)
                    .bindPopup(`
                        <div class="vehicle-popup">
                            <h4>${vehicle.license_plate}</h4>
                            <p>Driver: ${vehicle.driver_name || 'Unknown'}</p>
                            <p>Status: ${vehicle.status || 'Unknown'}</p>
                        </div>
                    `);
                vehicleMarkers[vehicle.id] = marker;
            }
        }
    } else if (payload.eventType === 'DELETE') {
        // Remove marker
        if (vehicleMarkers[payload.old.id]) {
            map.removeLayer(vehicleMarkers[payload.old.id]);
            delete vehicleMarkers[payload.old.id];
        }
    }
}

// Handle alarm updates from realtime
function handleAlarmUpdate(payload) {
    if (payload.eventType === 'INSERT' && !payload.new.resolved) {
        // New alarm - show notification and update badge
        showNotification(`New panic alert: ${payload.new.message || 'Emergency situation'}`, 'warning');
        updateAlertBadge();
    }
    
    // Refresh dashboard stats to get updated counts
    loadDashboardStats();
}

// Update alert badge
function updateAlertBadge() {
    if (elements.alertBadge && elements.alertCount) {
        const currentCount = parseInt(elements.alertCount.textContent) || 0;
        const newCount = currentCount + 1;
        elements.alertCount.textContent = newCount;
        elements.alertBadge.style.display = 'flex';
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const target = this.getAttribute('data-target');
            handleNavigation(target);
        });
    });

    // Quick action buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            handleQuickAction(action);
        });
    });

    // Header buttons
    document.getElementById('alerts-btn')?.addEventListener('click', () => showAlertsModal());
    document.getElementById('profile-btn')?.addEventListener('click', () => showProfileModal());
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

    // Modal close buttons
    document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal-overlay');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Form submissions
    document.getElementById('add-route-form')?.addEventListener('submit', handleAddRoute);
    document.getElementById('add-member-form')?.addEventListener('submit', handleAddMember);
    document.getElementById('profile-form')?.addEventListener('submit', handleProfileUpdate);

    // Map modal
    document.querySelector('[data-target="map"]')?.addEventListener('click', showMapModal);
    
    // Wallet navigation
    document.querySelector('[data-target="wallet"]')?.addEventListener('click', showWalletModal);
    
    console.log('Event listeners setup complete');
}

// Handle navigation
function handleNavigation(target) {
    console.log('Navigation to:', target);
    switch(target) {
        case 'dashboard':
            // Already on dashboard
            break;
        case 'map':
            showMapModal();
            break;
        case 'wallet':
            showWalletModal();
            break;
        case 'profile':
            showProfileModal();
            break;
    }
}

// Handle quick actions
function handleQuickAction(action) {
    console.log('Quick action:', action);
    switch(action) {
        case 'add-route':
            showModal('add-route-modal');
            break;
        case 'add-member':
            showModal('add-member-modal');
            break;
        case 'manage-parts':
            showModal('manage-parts-modal');
            break;
        case 'view-alerts':
            showAlertsModal();
            break;
    }
}

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Initialize map if it's the map modal
        if (modalId === 'map-modal') {
            setTimeout(() => {
                if (!document.getElementById('full-map')._leaflet_id) {
                    initializeFullMap();
                }
            }, 100);
        }
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Show map modal
function showMapModal() {
    showModal('map-modal');
}

// Initialize full screen map
function initializeFullMap() {
    const fullMapElement = document.getElementById('full-map');
    if (!fullMapElement) return;

    const fullMap = L.map('full-map').setView([-26.2041, 28.0473], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(fullMap);

    // Load vehicles for full map
    loadVehiclesForMap(fullMap);
}

// Load vehicles for specific map
async function loadVehiclesForMap(targetMap) {
    if (!currentAssociationId) return;

    const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select('id, license_plate, current_lat, current_lng, driver_name, status')
        .eq('association_id', currentAssociationId)
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);

    if (error) {
        console.error('Error loading vehicles for map:', error);
        return;
    }

    vehicles.forEach(vehicle => {
        if (vehicle.current_lat && vehicle.current_lng) {
            L.marker([vehicle.current_lat, vehicle.current_lng])
                .addTo(targetMap)
                .bindPopup(`
                    <div class="vehicle-popup">
                        <h4>${vehicle.license_plate}</h4>
                        <p>Driver: ${vehicle.driver_name || 'Unknown'}</p>
                        <p>Status: ${vehicle.status || 'Unknown'}</p>
                    </div>
                `);
        }
    });

    if (vehicles.length > 0) {
        const bounds = vehicles
            .filter(v => v.current_lat && v.current_lng)
            .map(v => [v.current_lat, v.current_lng]);
        targetMap.fitBounds(bounds);
    }
}

// Show wallet modal
async function showWalletModal() {
    try {
        if (!currentAssociationId) return;

        const { data: association, error } = await supabase
            .from('associations')
            .select('wallet_balance')
            .eq('id', currentAssociationId)
            .single();

        if (error) {
            console.error('Error fetching wallet balance:', error);
            return;
        }

        // Update wallet balance in modal
        const walletBalanceElement = document.getElementById('wallet-balance');
        if (walletBalanceElement) {
            walletBalanceElement.textContent = `R ${(association.wallet_balance || 0).toFixed(2)}`;
        }

        // Load recent transactions
        await loadRecentTransactions();

        showModal('wallet-modal');

    } catch (error) {
        console.error('Error showing wallet modal:', error);
        showNotification('Error loading wallet data', 'error');
    }
}

// Load recent transactions
async function loadRecentTransactions() {
    try {
        if (!currentAssociationId) return;

        // First check if transactions table exists by trying to query it
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('id, amount, type, description, created_at')
            .eq('association_id', currentAssociationId)
            .order('created_at', { ascending: false })
            .limit(10);

        const transactionsList = document.getElementById('transactions-list');
        if (!transactionsList) return;

        if (error || !transactions || transactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No Transactions</h3>
                    <p>Transaction history will appear here.</p>
                </div>
            `;
            return;
        }

        const transactionsHTML = transactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <h4>${transaction.description || 'Transaction'}</h4>
                    <small>${new Date(transaction.created_at).toLocaleString()}</small>
                </div>
                <div class="transaction-amount ${transaction.type === 'credit' ? 'credit' : 'debit'}">
                    ${transaction.type === 'credit' ? '+' : '-'}R ${Math.abs(transaction.amount).toFixed(2)}
                </div>
            </div>
        `).join('');

        transactionsList.innerHTML = transactionsHTML;

    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Show alerts modal
async function showAlertsModal() {
    try {
        if (!currentAssociationId) return;

        const { data: alarms, error } = await supabase
            .from('alarms')
            .select('id, message, created_at, resolved')
            .eq('association_id', currentAssociationId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error fetching alarms:', error);
            return;
        }

        const alertsContent = document.getElementById('alerts-modal-content');
        if (!alertsContent) return;

        if (!alarms || alarms.length === 0) {
            alertsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bell-slash"></i>
                    <h3>No Active Alerts</h3>
                    <p>All clear! No panic alerts at the moment.</p>
                </div>
            `;
        } else {
            const alertsHTML = alarms.map(alarm => `
                <div class="alert-item ${alarm.resolved ? 'resolved' : 'active'}">
                    <div class="alert-icon">
                        <i class="fas ${alarm.resolved ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                    </div>
                    <div class="alert-content">
                        <p class="alert-message">${alarm.message}</p>
                        <small class="alert-time">${new Date(alarm.created_at).toLocaleString()}</small>
                    </div>
                    ${!alarm.resolved ? `
                        <button class="btn btn-sm btn-success" onclick="resolveAlarm('${alarm.id}')">
                            <i class="fas fa-check"></i> Resolve
                        </button>
                    ` : ''}
                </div>
            `).join('');

            alertsContent.innerHTML = alertsHTML;
        }

        showModal('alerts-modal');

    } catch (error) {
        console.error('Error showing alerts modal:', error);
    }
}

// Resolve alarm
async function resolveAlarm(alarmId) {
    try {
        const { error } = await supabase
            .from('alarms')
            .update({ resolved: true, resolved_at: new Date().toISOString() })
            .eq('id', alarmId);

        if (error) {
            throw error;
        }

        showNotification('Alert resolved successfully', 'success');
        showAlertsModal(); // Refresh the modal
        loadDashboardStats(); // Update counts

    } catch (error) {
        console.error('Error resolving alarm:', error);
        showNotification('Error resolving alert', 'error');
    }
}

// Show profile modal
async function showProfileModal() {
    try {
        const association = await loadAssociationData();
        const profileForm = document.getElementById('profile-form');
        
        if (profileForm && association) {
            // Populate form fields
            document.getElementById('profile-association-name').value = association.association_name || '';
            document.getElementById('profile-association-email').value = association.email || '';
            document.getElementById('profile-association-phone').value = association.phone || '';
            document.getElementById('profile-association-address').value = association.address || '';
            document.getElementById('profile-association-description').value = association.description || '';
            document.getElementById('profile-admin-name').value = association.admin_name || '';
            document.getElementById('profile-admin-phone').value = association.admin_phone || '';
        }

        showModal('profile-modal');

    } catch (error) {
        console.error('Error showing profile modal:', error);
        showNotification('Error loading profile data', 'error');
    }
}

// Handle profile update
async function handleProfileUpdate(event) {
    event.preventDefault();
    
    try {
        const updates = {
            association_name: document.getElementById('profile-association-name').value,
            email: document.getElementById('profile-association-email').value,
            phone: document.getElementById('profile-association-phone').value,
            address: document.getElementById('profile-association-address').value,
            description: document.getElementById('profile-association-description').value,
            admin_name: document.getElementById('profile-admin-name').value,
            admin_phone: document.getElementById('profile-admin-phone').value,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('associations')
            .update(updates)
            .eq('id', currentAssociationId);

        if (error) {
            throw error;
        }

        showNotification('Profile updated successfully', 'success');
        closeModal('profile-modal');

    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile', 'error');
    }
}

// Handle add route
async function handleAddRoute(event) {
    event.preventDefault();
    
    try {
        const routeData = {
            name: document.getElementById('route-name').value,
            origin: document.getElementById('route-origin').value,
            destination: document.getElementById('route-destination').value,
            schedule: document.getElementById('route-schedule').value,
            is_active: true,
            association_id: currentAssociationId,
            created_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('routes')
            .insert([routeData]);

        if (error) {
            throw error;
        }

        showNotification('Route added successfully', 'success');
        event.target.reset();
        closeModal('add-route-modal');
        loadDashboardStats();
        loadRecentRoutes();

    } catch (error) {
        console.error('Error adding route:', error);
        showNotification('Error adding route', 'error');
    }
}

// Handle add member
async function handleAddMember(event) {
    event.preventDefault();
    
    try {
        const memberData = {
            name: document.getElementById('member-name').value,
            email: document.getElementById('member-email').value,
            phone: document.getElementById('member-phone').value,
            role: document.getElementById('member-role').value,
            is_verified: document.getElementById('member-verified').checked,
            association_id: currentAssociationId,
            created_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('members')
            .insert([memberData]);

        if (error) {
            throw error;
        }

        showNotification('Member added successfully', 'success');
        event.target.reset();
        closeModal('add-member-modal');
        loadDashboardStats();
        loadRecentMembers();

    } catch (error) {
        console.error('Error adding member:', error);
        showNotification('Error adding member', 'error');
    }
}

// Handle logout
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw error;
        }
        
        // Unsubscribe from realtime
        if (realtimeSubscription) {
            realtimeSubscription.vehicleSubscription?.unsubscribe();
            realtimeSubscription.alarmSubscription?.unsubscribe();
        }
        
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Error signing out:', error);
        showNotification('Error signing out', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Get notification icon
function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// Auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed in association dashboard:', { event, userId: session?.user?.id });
    
    if (event === 'SIGNED_OUT') {
        console.log('User signed out, redirecting to login');
        window.location.href = 'index.html';
    } else if (event === 'SIGNED_IN' && currentAssociationId === null) {
        console.log('User signed in, re-initializing dashboard');
        currentAssociationId = session.user.id;
        initializeDashboard();
    }
});

// Make functions globally available for HTML onclick handlers
window.resolveAlarm = resolveAlarm;
window.showModal = showModal;
window.closeModal = closeModal;
window.showMapModal = showMapModal;
window.showWalletModal = showWalletModal;
window.showAlertsModal = showAlertsModal;
window.showProfileModal = showProfileModal;
