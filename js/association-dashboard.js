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
        
        // Get association data - try different query approaches
        let associationData = null;

        // Method 1: Try admin_id (most common)
        const { data: data1, error: error1 } = await supabase
            .from('associations')
            .select('*')
            .eq('admin_id', currentUser.id)
            .single();

        console.log('Association query result:', { data: data1, error: error1 });

        if (!error1 && data1) {
            associationData = data1;
        } else {
            // Method 2: Get all associations and find matching one
            const { data: allAssociations, error: allError } = await supabase
                .from('associations')
                .select('*');

            if (!allError && allAssociations && allAssociations.length > 0) {
                // Find association by admin_id or email
                associationData = allAssociations.find(assoc => 
                    assoc.admin_id === currentUser.id || 
                    assoc.email === currentUser.email
                );
            }
        }

        if (!associationData) {
            console.warn('No association data found in database');
            // Create default association data from user info
            associationData = {
                name: 'My Association',
                email: currentUser.email,
                phone: '',
                address: '',
                admin_id: currentUser.id,
                admin_name: currentUser.email.split('@')[0],
                admin_phone: '',
                description: '',
                logo_url: null,
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
            name: 'My Association',
            email: currentUser.email,
            phone: '',
            address: '',
            admin_id: currentUser.id,
            admin_name: currentUser.email.split('@')[0],
            admin_phone: '',
            description: '',
            logo_url: null,
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

    if (associationNameElement) associationNameElement.textContent = associationData.name || 'Association';
    if (associationNameMainElement) associationNameMainElement.textContent = associationData.name || 'Association';

    // Update association details in profile modal if open
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

// FIXED: Update association profile modal with null checks
function updateAssociationProfileModal(associationData) {
    // Only update if the modal elements exist
    const profileAssociationName = document.getElementById('profile-association-name');
    const profileAssociationEmail = document.getElementById('profile-association-email');
    const profileAssociationPhone = document.getElementById('profile-association-phone');
    const profileAssociationAddress = document.getElementById('profile-association-address');
    const profileAssociationDescription = document.getElementById('profile-association-description');
    const profileAdminName = document.getElementById('profile-admin-name');
    const profileAdminPhone = document.getElementById('profile-admin-phone');

    if (profileAssociationName) profileAssociationName.value = associationData.name || '';
    if (profileAssociationEmail) profileAssociationEmail.value = associationData.email || '';
    if (profileAssociationPhone) profileAssociationPhone.value = associationData.phone || '';
    if (profileAssociationAddress) profileAssociationAddress.value = associationData.address || '';
    if (profileAssociationDescription) profileAssociationDescription.value = associationData.description || '';
    if (profileAdminName) profileAdminName.value = associationData.admin_name || '';
    if (profileAdminPhone) profileAdminPhone.value = associationData.admin_phone || '';
}

// NEW: Dashboard Data Loading Functions
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
        // Get counts for different user types
        const { data: owners, error: ownersError } = await supabase
            .from('users')
            .select('id, status')
            .eq('role', 'owner');

        const { data: drivers, error: driversError } = await supabase
            .from('users')
            .select('id, status')
            .eq('role', 'driver');

        const { data: vehicles, error: vehiclesError } = await supabase
            .from('vehicles')
            .select('id')
            .eq('association_id', currentAssociation.id);

        const { data: alerts, error: alertsError } = await supabase
            .from('panic_alerts')
            .select('id')
            .eq('status', 'active');

        if (ownersError) console.error('Owners error:', ownersError);
        if (driversError) console.error('Drivers error:', driversError);
        if (vehiclesError) console.error('Vehicles error:', vehiclesError);
        if (alertsError) console.error('Alerts error:', alertsError);

        // Calculate statistics
        const stats = {
            registeredVehicles: vehicles ? vehicles.length : 0,
            registeredMembers: owners ? owners.length + (drivers ? drivers.length : 0) : 0,
            activeRoutes: 0, // You'll need to implement routes functionality
            passengerAlarms: alerts ? alerts.length : 0
        };

        // Update UI
        updateDashboardStats(stats);
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function updateDashboardStats(stats) {
    // Update stat cards with null checks
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
        // Get recent owners and drivers
        const { data: recentOwners, error: ownersError } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'owner')
            .order('created_at', { ascending: false })
            .limit(3);

        const { data: recentDrivers, error: driversError } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'driver')
            .order('created_at', { ascending: false })
            .limit(3);

        if (ownersError) throw ownersError;
        if (driversError) throw driversError;

        const recentMembers = [
            ...(recentOwners || []),
            ...(recentDrivers || [])
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);

        renderRecentMembers(recentMembers);
        
    } catch (error) {
        console.error('Error loading recent members:', error);
        showRecentMembersError();
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
        const statusClass = member.status === 'active' ? 'status-active' : 
                           member.status === 'inactive' ? 'status-inactive' : 'status-pending';
        const roleIcon = member.role === 'driver' ? 'fa-user-tie' : 'fa-user';
        
        membersHtml += `
            <div class="list-item">
                <div class="item-icon">
                    <i class="fas ${roleIcon}"></i>
                </div>
                <div class="item-details">
                    <h4>${member.name || 'Unnamed Member'}</h4>
                    <p>${member.email || 'N/A'}</p>
                    <p class="member-role">${member.role} • <span class="status-indicator ${statusClass}">${member.status || 'Unknown'}</span></p>
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
        // This would come from your routes table
        // For now, using demo data
        const demoRoutes = [
            {
                id: '1',
                name: 'City Center Route',
                origin: 'Downtown',
                destination: 'City Center',
                schedule: 'Daily 6AM-10PM',
                status: 'active'
            },
            {
                id: '2', 
                name: 'Airport Express',
                origin: 'Central Station',
                destination: 'International Airport',
                schedule: 'Every 30 mins',
                status: 'active'
            }
        ];

        renderRecentRoutes(demoRoutes);
        
    } catch (error) {
        console.error('Error loading recent routes:', error);
        showRecentRoutesError();
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
        const statusClass = route.status === 'active' ? 'status-active' : 'status-inactive';
        
        routesHtml += `
            <div class="list-item">
                <div class="item-icon">
                    <i class="fas fa-route"></i>
                </div>
                <div class="item-details">
                    <h4>${route.name}</h4>
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
        const { data: alerts, error } = await supabase
            .from('panic_alerts')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        updateAlertBadge(alerts ? alerts.length : 0);
        
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

// Modal Management Functions
function openProfileModal() {
    updateAssociationProfileModal(currentAssociation);
    showModal('profile-modal');
}

async function saveAssociationProfile() {
    try {
        const formData = {
            name: document.getElementById('profile-association-name')?.value || '',
            email: document.getElementById('profile-association-email')?.value || '',
            phone: document.getElementById('profile-association-phone')?.value || '',
            address: document.getElementById('profile-association-address')?.value || '',
            description: document.getElementById('profile-association-description')?.value || '',
            admin_name: document.getElementById('profile-admin-name')?.value || '',
            admin_phone: document.getElementById('profile-admin-phone')?.value || ''
        };

        // Check if we're updating an existing association or creating a new one
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

        // Update local data
        Object.assign(currentAssociation, formData);
        updateAssociationProfile(currentAssociation);
        
        showNotification('Profile updated successfully!', 'success');
        closeModal('profile-modal');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile.', 'error');
    }
}

// Quick Actions
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

function openMapModal() {
    showModal('map-modal');
    // Initialize map here if needed
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
    // Header actions with null checks
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
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
            
            switch(target) {
                case 'dashboard': 
                    // Already on dashboard
                    break;
                case 'map': 
                    openMapModal(); 
                    break;
                case 'wallet': 
                    openWalletModal(); 
                    break;
                case 'profile': 
                    openProfileModal(); 
                    break;
            }
        });
    });

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

    // Create notification
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

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Error state functions
function showRecentMembersError() {
    const content = document.getElementById('recent-members-content');
    if (content) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Members</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

function showRecentRoutesError() {
    const content = document.getElementById('recent-routes-content');
    if (content) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Routes</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Placeholder functions for member and route management
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
