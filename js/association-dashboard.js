// Association Dashboard JavaScript - Demo Mode
console.log('Association dashboard script loaded');

// Global variables
let supabase = null;
let currentAssociationId = null;
let map = null;
let vehicleMarkers = {};
let realtimeSubscription = null;

// Demo data
const demoData = {
    association: {
        id: 'demo-association-id',
        association_name: 'TaxiDrive Association',
        email: 'admin@taxidrive.com',
        wallet_balance: 12500.50
    },
    stats: {
        vehicles: 24,
        members: 18,
        routes: 12,
        alarms: 2
    },
    recentMembers: [
        { id: 1, name: 'John Smith', email: 'john@taxidrive.com', role: 'owner', is_verified: true },
        { id: 2, name: 'Sarah Johnson', email: 'sarah@taxidrive.com', role: 'driver', is_verified: true },
        { id: 3, name: 'Mike Brown', email: 'mike@taxidrive.com', role: 'owner', is_verified: false }
    ],
    recentRoutes: [
        { id: 1, name: 'City Center Express', origin: 'Downtown', destination: 'City Center', schedule: 'Daily 6AM-10PM', is_active: true },
        { id: 2, name: 'Airport Shuttle', origin: 'Central Station', destination: 'International Airport', schedule: '24/7', is_active: true }
    ]
};

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
    initializeApp();
});

// Initialize the entire application
async function initializeApp() {
    try {
        await initializeSupabase();
        await checkAuthAndInitialize();
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Running in demo mode with sample data', 'info');
        initializeDemoMode();
    }
}

// Initialize Supabase with demo mode fallback
async function initializeSupabase() {
    try {
        const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';

        // Check if supabase is available
        if (typeof window.supabase === 'undefined') {
            throw new Error('Supabase library not loaded');
        }

        console.log('Initializing Supabase client...');
        
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });

        // Test the connection
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
            console.log('Supabase connection failed, using demo mode');
            throw new Error('Using demo mode');
        }
        
        console.log('Supabase client initialized successfully');
        return supabase;
        
    } catch (error) {
        console.log('Initializing demo mode:', error.message);
        throw error; // Force demo mode
    }
}

// Check authentication and initialize dashboard
async function checkAuthAndInitialize() {
    try {
        console.log('Checking authentication status...');
        
        // For demo purposes, set a demo user
        currentAssociationId = 'demo-user-id';
        
        // Initialize dashboard components
        await initializeDashboard();
        setupEventListeners();
        
    } catch (error) {
        console.error('Error checking authentication:', error);
        initializeDemoMode();
    }
}

// Initialize dashboard components
async function initializeDashboard() {
    try {
        console.log('Initializing dashboard components...');
        
        // Load association data
        const association = await loadAssociationData();
        if (!association) {
            console.log('Using demo association data');
            loadDemoAssociationData();
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
        initializeDemoMode();
    }
}

// Initialize demo mode
function initializeDemoMode() {
    console.log('Initializing demo mode with sample data');
    showNotification('🔧 Running in demo mode with sample data', 'info');
    
    // Load demo data
    loadDemoAssociationData();
    loadDemoStats();
    loadDemoRecentMembers();
    loadDemoRecentRoutes();
    setupEventListeners();
    initializeMap();
}

// Load demo association data
function loadDemoAssociationData() {
    if (elements.walletBalance) {
        elements.walletBalance.textContent = `R ${demoData.association.wallet_balance.toFixed(2)}`;
    }
    return demoData.association;
}

// Load demo stats
function loadDemoStats() {
    if (elements.statVehicles) elements.statVehicles.textContent = demoData.stats.vehicles;
    if (elements.statMembers) elements.statMembers.textContent = demoData.stats.members;
    if (elements.statRoutes) elements.statRoutes.textContent = demoData.stats.routes;
    if (elements.statAlarms) elements.statAlarms.textContent = demoData.stats.alarms;
    
    // Update alert badge
    if (elements.alertBadge && elements.alertCount) {
        if (demoData.stats.alarms > 0) {
            elements.alertBadge.style.display = 'flex';
            elements.alertCount.textContent = demoData.stats.alarms;
        } else {
            elements.alertBadge.style.display = 'none';
        }
    }
}

// Load demo recent members
function loadDemoRecentMembers() {
    const membersHTML = demoData.recentMembers.map(member => `
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
}

// Load demo recent routes
function loadDemoRecentRoutes() {
    const routesHTML = demoData.recentRoutes.map(route => `
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
}

// Load association data
async function loadAssociationData() {
    try {
        if (!supabase) {
            return null;
        }

        const { data: association, error } = await supabase
            .from('associations')
            .select('id, association_name, email, phone, address, description, admin_name, admin_phone, logo_url, wallet_balance')
            .eq('id', currentAssociationId)
            .single();

        if (error) {
            return null;
        }

        if (!association) {
            return null;
        }

        console.log('Association data loaded:', association);
        
        // Update wallet balance
        if (elements.walletBalance) {
            elements.walletBalance.textContent = `R ${(association.wallet_balance || 0).toFixed(2)}`;
        }
        
        return association;
        
    } catch (error) {
        console.error('Error in loadAssociationData:', error);
        return null;
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        if (!currentAssociationId || !supabase) {
            loadDemoStats();
            return;
        }

        // Helper function to safely count records
        const safeCount = async (tableName) => {
            try {
                const { count, error } = await supabase
                    .from(tableName)
                    .select('*', { count: 'exact', head: true })
                    .eq('association_id', currentAssociationId);

                if (error) {
                    return 0;
                }
                return count || 0;
            } catch (error) {
                return 0;
            }
        };

        // Load counts safely
        const vehiclesCount = await safeCount('vehicles');
        const membersCount = await safeCount('members');
        const routesCount = await safeCount('routes');
        
        // Alarms count with additional filter
        let alarmsCount = 0;
        try {
            const { count, error } = await supabase
                .from('alarms')
                .select('*', { count: 'exact', head: true })
                .eq('association_id', currentAssociationId)
                .eq('resolved', false);

            if (!error) {
                alarmsCount = count || 0;
            }
        } catch (error) {
            // Use demo data
        }

        // Update UI elements
        if (vehiclesCount > 0 || membersCount > 0 || routesCount > 0 || alarmsCount > 0) {
            // Use real data if available
            if (elements.statVehicles) elements.statVehicles.textContent = vehiclesCount;
            if (elements.statMembers) elements.statMembers.textContent = membersCount;
            if (elements.statRoutes) elements.statRoutes.textContent = routesCount;
            if (elements.statAlarms) elements.statAlarms.textContent = alarmsCount;
            
            // Update alert badge
            if (elements.alertBadge && elements.alertCount) {
                if (alarmsCount > 0) {
                    elements.alertBadge.style.display = 'flex';
                    elements.alertCount.textContent = alarmsCount;
                } else {
                    elements.alertBadge.style.display = 'none';
                }
            }
        } else {
            // Use demo data
            loadDemoStats();
        }

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        loadDemoStats();
    }
}

// Load recent members
async function loadRecentMembers() {
    try {
        if (!currentAssociationId || !supabase) {
            loadDemoRecentMembers();
            return;
        }

        const { data: members, error } = await supabase
            .from('members')
            .select('id, name, role, email, phone, is_verified, created_at')
            .eq('association_id', currentAssociationId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error || !members || members.length === 0) {
            loadDemoRecentMembers();
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
        loadDemoRecentMembers();
    }
}

// Load recent routes
async function loadRecentRoutes() {
    try {
        if (!currentAssociationId || !supabase) {
            loadDemoRecentRoutes();
            return;
        }

        const { data: routes, error } = await supabase
            .from('routes')
            .select('id, name, origin, destination, schedule, is_active')
            .eq('association_id', currentAssociationId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error || !routes || routes.length === 0) {
            loadDemoRecentRoutes();
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
        loadDemoRecentRoutes();
    }
}

// [ALL OTHER FUNCTIONS REMAIN THE SAME AS BEFORE]
// initializeMap, setupEventListeners, handleNavigation, showModal, closeModal, etc.
// ... (include all the other functions from the previous versions)

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
        
        // Add some demo vehicle markers
        addDemoVehicleMarkers();
        
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Add demo vehicle markers
function addDemoVehicleMarkers() {
    if (!map) return;

    const demoVehicles = [
        { lat: -26.2041, lng: 28.0473, license: 'ABC123', driver: 'John Driver', status: 'Active' },
        { lat: -26.1941, lng: 28.0373, license: 'DEF456', driver: 'Sarah Driver', status: 'Active' },
        { lat: -26.2141, lng: 28.0573, license: 'GHI789', driver: 'Mike Driver', status: 'On Break' }
    ];

    demoVehicles.forEach(vehicle => {
        L.marker([vehicle.lat, vehicle.lng])
            .addTo(map)
            .bindPopup(`
                <div class="vehicle-popup">
                    <h4>${vehicle.license}</h4>
                    <p>Driver: ${vehicle.driver}</p>
                    <p>Status: ${vehicle.status}</p>
                </div>
            `);
    });
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
                initializeFullMap();
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

    // Check if map already initialized
    if (fullMapElement._leaflet_id) {
        return;
    }

    const fullMap = L.map('full-map').setView([-26.2041, 28.0473], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(fullMap);

    // Add demo vehicles to full map
    const demoVehicles = [
        { lat: -26.2041, lng: 28.0473, license: 'ABC123', driver: 'John Driver', status: 'Active' },
        { lat: -26.1941, lng: 28.0373, license: 'DEF456', driver: 'Sarah Driver', status: 'Active' },
        { lat: -26.2141, lng: 28.0573, license: 'GHI789', driver: 'Mike Driver', status: 'On Break' },
        { lat: -26.2241, lng: 28.0273, license: 'JKL012', driver: 'Emma Driver', status: 'Active' }
    ];

    demoVehicles.forEach(vehicle => {
        L.marker([vehicle.lat, vehicle.lng])
            .addTo(fullMap)
            .bindPopup(`
                <div class="vehicle-popup">
                    <h4>${vehicle.license}</h4>
                    <p>Driver: ${vehicle.driver}</p>
                    <p>Status: ${vehicle.status}</p>
                </div>
            `);
    });

    // Fit bounds to show all markers
    if (demoVehicles.length > 0) {
        const bounds = demoVehicles.map(v => [v.lat, v.lng]);
        fullMap.fitBounds(bounds);
    }
}

// Show wallet modal
async function showWalletModal() {
    try {
        // Update wallet balance in modal
        const walletBalanceElement = document.getElementById('wallet-balance');
        if (walletBalanceElement) {
            walletBalanceElement.textContent = `R ${demoData.association.wallet_balance.toFixed(2)}`;
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
        const transactionsList = document.getElementById('transactions-list');
        if (!transactionsList) return;

        // Demo transactions
        const demoTransactions = [
            { description: 'Monthly Subscription', amount: -500.00, type: 'debit', created_at: new Date() },
            { description: 'Ride Payments', amount: 1250.75, type: 'credit', created_at: new Date(Date.now() - 86400000) },
            { description: 'Maintenance Fee', amount: -150.25, type: 'debit', created_at: new Date(Date.now() - 172800000) }
        ];

        const transactionsHTML = demoTransactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <h4>${transaction.description}</h4>
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
        const alertsContent = document.getElementById('alerts-modal-content');
        if (!alertsContent) return;

        // Demo alerts
        const demoAlerts = [
            { id: 1, message: 'Panic button activated - Vehicle ABC123', resolved: false, created_at: new Date() },
            { id: 2, message: 'Emergency stop - Route Downtown Express', resolved: true, created_at: new Date(Date.now() - 3600000) }
        ];

        const alertsHTML = demoAlerts.map(alarm => `
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
        showModal('alerts-modal');

    } catch (error) {
        console.error('Error showing alerts modal:', error);
        showNotification('Error loading alerts', 'error');
    }
}

// Resolve alarm
async function resolveAlarm(alarmId) {
    try {
        showNotification(`Alert ${alarmId} resolved successfully`, 'success');
        showAlertsModal(); // Refresh the modal
        // Update demo stats
        demoData.stats.alarms = Math.max(0, demoData.stats.alarms - 1);
        if (elements.statAlarms) {
            elements.statAlarms.textContent = demoData.stats.alarms;
        }
        
        // Update alert badge
        if (elements.alertBadge && elements.alertCount) {
            if (demoData.stats.alarms > 0) {
                elements.alertBadge.style.display = 'flex';
                elements.alertCount.textContent = demoData.stats.alarms;
            } else {
                elements.alertBadge.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('Error resolving alarm:', error);
        showNotification('Error resolving alert', 'error');
    }
}

// Show profile modal
async function showProfileModal() {
    try {
        const profileForm = document.getElementById('profile-form');
        
        if (profileForm) {
            // Populate form fields with demo data
            document.getElementById('profile-association-name').value = demoData.association.association_name;
            document.getElementById('profile-association-email').value = demoData.association.email;
            document.getElementById('profile-association-phone').value = '+27 11 123 4567';
            document.getElementById('profile-association-address').value = '123 Taxi Drive, Johannesburg';
            document.getElementById('profile-association-description').value = 'Leading taxi association in Johannesburg';
            document.getElementById('profile-admin-name').value = 'Admin User';
            document.getElementById('profile-admin-phone').value = '+27 82 123 4567';
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
        showNotification('Profile updated successfully (demo mode)', 'success');
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
        showNotification('Route added successfully (demo mode)', 'success');
        event.target.reset();
        closeModal('add-route-modal');
        
        // Update demo stats
        demoData.stats.routes++;
        if (elements.statRoutes) {
            elements.statRoutes.textContent = demoData.stats.routes;
        }

    } catch (error) {
        console.error('Error adding route:', error);
        showNotification('Error adding route', 'error');
    }
}

// Handle add member
async function handleAddMember(event) {
    event.preventDefault();
    
    try {
        showNotification('Member added successfully (demo mode)', 'success');
        event.target.reset();
        closeModal('add-member-modal');
        
        // Update demo stats
        demoData.stats.members++;
        if (elements.statMembers) {
            elements.statMembers.textContent = demoData.stats.members;
        }

    } catch (error) {
        console.error('Error adding member:', error);
        showNotification('Error adding member', 'error');
    }
}

// Handle logout
async function handleLogout() {
    try {
        showNotification('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
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

// Make functions globally available for HTML onclick handlers
window.resolveAlarm = resolveAlarm;
window.showModal = showModal;
window.closeModal = closeModal;
window.showMapModal = showMapModal;
window.showWalletModal = showWalletModal;
window.showAlertsModal = showAlertsModal;
window.showProfileModal = showProfileModal;
