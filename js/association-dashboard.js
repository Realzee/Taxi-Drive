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

// Update the initializeDashboard function:
async function initializeDashboard() {
    try {
        // Check authentication and role
        const user = await checkAssociationAuthentication();
        if (!user) return;

        currentUser = user;
        console.log('Association user authenticated:', user.email);

        // Rest of your existing initialization code...
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

async function initializeDashboard() {
    try {
        // Check if user is logged in
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            window.location.href = 'index.html';
            return;
        }

        currentUser = user;
        console.log('User authenticated:', user.email);

        // Load user data and association data
        await Promise.all([
            loadUserData(),
            loadAssociationData()
        ]);

        // Setup event listeners
        setupEventListeners();

        // Load dashboard data
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
        // Get association data
        const { data: associationData, error } = await supabase
            .from('associations')
            .select('*')
            .eq('admin_id', currentUser.id)
            .single();

        if (error) {
            // Try alternative column name
            const { data: altData, error: altError } = await supabase
                .from('associations')
                .select('*')
                .eq('admin_id', currentUser.id)
                .single();
                
            if (altError) throw altError;
            currentAssociation = altData;
        } else {
            currentAssociation = associationData;
        }

        // Update UI with association data
        updateAssociationProfile(currentAssociation);
        
    } catch (error) {
        console.error('Error loading association data:', error);
        showNotification('Association data not found. Please complete your association profile.', 'warning');
    }
}

function updateUserProfile(userData) {
    const userNameElement = document.getElementById('user-name');
    const userRoleElement = document.getElementById('user-role');
    const userAvatarElement = document.getElementById('user-avatar');
    const associationNameElement = document.getElementById('association-name');

    if (userNameElement) userNameElement.textContent = userData.name || userData.email;
    if (userRoleElement) userRoleElement.textContent = userData.role || 'Association';
    if (userAvatarElement) userAvatarElement.textContent = (userData.name || userData.email).charAt(0).toUpperCase();
    if (associationNameElement && currentAssociation) {
        associationNameElement.textContent = currentAssociation.name || 'Association';
    }
}

function updateAssociationProfile(associationData) {
    // Update association name in header
    const associationNameMainElement = document.getElementById('association-name-main');
    const dashboardAssociationNameElement = document.getElementById('dashboard-association-name');
    const driversAssociationNameElement = document.getElementById('drivers-dashboard-association-name');

    if (associationNameMainElement) associationNameMainElement.textContent = associationData.name;
    if (dashboardAssociationNameElement) dashboardAssociationNameElement.textContent = associationData.name;
    if (driversAssociationNameElement) driversAssociationNameElement.textContent = associationData.name;

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
        document.getElementById('main-logo').style.display = 'none';
        document.getElementById('main-logo-main').style.display = 'none';
    }
}

async function loadDashboardData() {
    try {
        await Promise.all([
            loadPendingOwners(),
            loadRegisteredOwners(),
            loadDrivers(),
            loadDashboardStats()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data.', 'error');
    }
}

async function loadPendingOwners() {
    try {
        const { data: pendingOwners, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'owner')
            .eq('association_approved', false)
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderPendingOwners(pendingOwners || []);
        updatePendingCount(pendingOwners ? pendingOwners.length : 0);
        
    } catch (error) {
        console.error('Error loading pending owners:', error);
        showPendingOwnersError();
    }
}

function renderPendingOwners(owners) {
    const pendingOwnersContent = document.getElementById('pending-owners-content');
    
    if (!owners || owners.length === 0) {
        pendingOwnersContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <h3>No Pending Approvals</h3>
                <p>All owner applications have been reviewed.</p>
            </div>
        `;
        return;
    }

    let ownersHtml = '';
    owners.forEach(owner => {
        ownersHtml += `
            <div class="list-item">
                <div class="owner-info">
                    <h4>${owner.name || 'Unnamed Owner'}</h4>
                    <p><i class="fas fa-envelope"></i> ${owner.email || 'N/A'}</p>
                    <p><i class="fas fa-phone"></i> ${owner.phone || 'N/A'}</p>
                    <p><i class="fas fa-calendar"></i> Applied: ${formatDate(owner.created_at)}</p>
                </div>
                <div class="owner-documents">
                    <button class="btn btn-primary btn-sm view-docs-btn" data-owner-id="${owner.id}">
                        <i class="fas fa-file-alt"></i> View Documents
                    </button>
                    <button class="btn btn-success btn-sm approve-btn" data-owner-id="${owner.id}">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-danger btn-sm reject-btn" data-owner-id="${owner.id}">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>
        `;
    });

    pendingOwnersContent.innerHTML = ownersHtml;

    // Add event listeners
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ownerId = e.target.closest('.approve-btn').getAttribute('data-owner-id');
            approveOwner(ownerId);
        });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ownerId = e.target.closest('.reject-btn').getAttribute('data-owner-id');
            rejectOwner(ownerId);
        });
    });
}

async function approveOwner(ownerId) {
    if (!confirm('Are you sure you want to approve this owner?')) return;

    try {
        const { error } = await supabase
            .from('users')
            .update({ 
                association_approved: true,
                approved_at: new Date().toISOString(),
                status: 'active'
            })
            .eq('id', ownerId);

        if (error) throw error;

        showNotification('Owner approved successfully!', 'success');
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error approving owner:', error);
        showNotification('Failed to approve owner.', 'error');
    }
}

async function rejectOwner(ownerId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason === null) return;

    try {
        const { error } = await supabase
            .from('users')
            .update({ 
                association_approved: false,
                rejection_reason: reason,
                status: 'rejected',
                rejected_at: new Date().toISOString()
            })
            .eq('id', ownerId);

        if (error) throw error;

        showNotification('Owner rejected successfully!', 'success');
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error rejecting owner:', error);
        showNotification('Failed to reject owner.', 'error');
    }
}

async function loadRegisteredOwners() {
    try {
        const { data: owners, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'owner')
            .eq('association_approved', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderRegisteredOwners(owners || []);
        updateRegisteredCounts(owners || []);
        
    } catch (error) {
        console.error('Error loading registered owners:', error);
        showRegisteredOwnersError();
    }
}

function renderRegisteredOwners(owners) {
    const registeredOwnersContent = document.getElementById('registered-owners-content');
    
    if (!owners || owners.length === 0) {
        registeredOwnersContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Registered Owners</h3>
                <p>No owners have been registered yet.</p>
            </div>
        `;
        return;
    }

    let ownersHtml = '';
    owners.forEach(owner => {
        const statusClass = owner.status === 'active' ? 'status-active' : 
                           owner.status === 'inactive' ? 'status-inactive' : 'status-pending';
        
        ownersHtml += `
            <div class="list-item">
                <div class="owner-info">
                    <h4>${owner.name || 'Unnamed Owner'}</h4>
                    <p><i class="fas fa-envelope"></i> ${owner.email || 'N/A'}</p>
                    <p><i class="fas fa-phone"></i> ${owner.phone || 'N/A'}</p>
                    <p><i class="fas fa-calendar"></i> Registered: ${formatDate(owner.created_at)}</p>
                    <p><i class="fas fa-id-card"></i> Status: <span class="status-indicator ${statusClass}">${owner.status || 'Unknown'}</span></p>
                </div>
                <div class="owner-documents">
                    <button class="btn btn-primary btn-sm edit-owner-btn" data-owner-id="${owner.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm deactivate-btn" data-owner-id="${owner.id}">
                        <i class="fas fa-ban"></i> Deactivate
                    </button>
                </div>
            </div>
        `;
    });

    registeredOwnersContent.innerHTML = ownersHtml;
}

async function loadDrivers() {
    try {
        const { data: drivers, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'driver')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderDrivers(drivers || []);
        updateDriverCounts(drivers || []);
        
    } catch (error) {
        console.error('Error loading drivers:', error);
        showDriversError();
    }
}

function renderDrivers(drivers) {
    const driversContent = document.getElementById('drivers-content');
    
    if (!drivers || drivers.length === 0) {
        driversContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-tie"></i>
                <h3>No Registered Drivers</h3>
                <p>No drivers have been registered yet.</p>
            </div>
        `;
        return;
    }

    let driversHtml = '';
    drivers.forEach(driver => {
        const statusClass = driver.status === 'active' ? 'status-active' : 
                           driver.status === 'inactive' ? 'status-inactive' : 'status-pending';
        
        driversHtml += `
            <div class="list-item">
                <div class="owner-info">
                    <h4>${driver.name || 'Unnamed Driver'}</h4>
                    <p><i class="fas fa-envelope"></i> ${driver.email || 'N/A'}</p>
                    <p><i class="fas fa-phone"></i> ${driver.phone || 'N/A'}</p>
                    <p><i class="fas fa-id-card"></i> License: ${driver.license_number || 'N/A'}</p>
                    <p><i class="fas fa-calendar"></i> Registered: ${formatDate(driver.created_at)}</p>
                    <p><i class="fas fa-car"></i> Status: <span class="status-indicator ${statusClass}">${driver.status || 'Unknown'}</span></p>
                </div>
            </div>
        `;
    });

    driversContent.innerHTML = driversHtml;
}

async function loadDashboardStats() {
    try {
        // Get counts for different user types
        const { data: owners, error: ownersError } = await supabase
            .from('users')
            .select('id, status, created_at')
            .eq('role', 'owner');

        const { data: drivers, error: driversError } = await supabase
            .from('users')
            .select('id, status')
            .eq('role', 'driver');

        if (ownersError) throw ownersError;
        if (driversError) throw driversError;

        // Calculate statistics
        const totalOwners = owners ? owners.length : 0;
        const activeOwners = owners ? owners.filter(o => o.status === 'active').length : 0;
        const pendingOwners = owners ? owners.filter(o => !o.association_approved).length : 0;
        
        const totalDrivers = drivers ? drivers.length : 0;
        const activeDrivers = drivers ? drivers.filter(d => d.status === 'active').length : 0;

        // Update UI
        updateDashboardStats({
            totalOwners,
            activeOwners,
            pendingOwners,
            totalDrivers,
            activeDrivers
        });
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function updateDashboardStats(stats) {
    // Update association header stats
    document.getElementById('association-registered-count').textContent = stats.totalOwners;
    document.getElementById('association-active-count').textContent = stats.activeOwners;
    document.getElementById('association-pending-count').textContent = stats.pendingOwners;

    // Update approval dashboard stats
    document.getElementById('pending-count').textContent = stats.pendingOwners;
    document.getElementById('total-owners').textContent = stats.totalOwners;

    // Update registered owners stats
    document.getElementById('registered-count').textContent = stats.totalOwners;
    document.getElementById('active-owners-count').textContent = stats.activeOwners;
    document.getElementById('inactive-owners-count').textContent = stats.totalOwners - stats.activeOwners;

    // Update drivers stats
    document.getElementById('total-drivers-count').textContent = stats.totalDrivers;
    document.getElementById('active-drivers-count').textContent = stats.activeDrivers;
    document.getElementById('inactive-drivers-count').textContent = stats.totalDrivers - stats.activeDrivers;
}

function setupEventListeners() {
    // Refresh buttons
    document.getElementById('refresh-dashboard').addEventListener('click', () => {
        loadDashboardData();
        showNotification('Dashboard refreshed!', 'success');
    });

    document.getElementById('refresh-registered-owners').addEventListener('click', () => {
        loadRegisteredOwners();
        showNotification('Owners list refreshed!', 'success');
    });

    document.getElementById('refresh-drivers').addEventListener('click', () => {
        loadDrivers();
        showNotification('Drivers list refreshed!', 'success');
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error logging out:', error);
            showNotification('Error logging out. Please try again.', 'error');
        }
    });

    // Register new owner button
    document.getElementById('register-new-owner-btn').addEventListener('click', () => {
        openOwnerRegistrationModal();
    });

    // Edit association profile button
    document.getElementById('edit-association-profile-btn').addEventListener('click', () => {
        openEditAssociationModal();
    });
}

function openOwnerRegistrationModal() {
    // Simple implementation - you can expand this with a proper modal
    const email = prompt('Enter owner email:');
    const name = prompt('Enter owner name:');
    
    if (email && name) {
        registerNewOwner(email, name);
    }
}

async function registerNewOwner(email, name) {
    try {
        // Generate a random password
        const tempPassword = generateTempPassword();
        
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: tempPassword,
        });

        if (authError) throw authError;

        // Create user record
        const { error: dbError } = await supabase
            .from('users')
            .insert({
                id: authData.user.id,
                email: email,
                name: name,
                role: 'owner',
                association_approved: true, // Auto-approve for association registration
                status: 'active',
                created_at: new Date().toISOString()
            });

        if (dbError) throw dbError;

        showNotification(`Owner ${name} registered successfully! Temporary password: ${tempPassword}`, 'success');
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error registering owner:', error);
        showNotification('Failed to register owner. Please try again.', 'error');
    }
}

function generateTempPassword() {
    return Math.random().toString(36).slice(-8) + '!';
}

function openEditAssociationModal() {
    // Simple implementation - you can expand this with a proper modal
    const newName = prompt('Enter new association name:', currentAssociation?.name || '');
    
    if (newName) {
        updateAssociationName(newName);
    }
}

async function updateAssociationName(newName) {
    try {
        const { error } = await supabase
            .from('associations')
            .update({ name: newName })
            .eq('admin_id', currentUser.id);

        if (error) throw error;

        currentAssociation.name = newName;
        updateAssociationProfile(currentAssociation);
        showNotification('Association name updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating association name:', error);
        showNotification('Failed to update association name.', 'error');
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return 'Invalid Date';
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
        <span class="notification-close" onclick="this.parentElement.remove()">&times;</span>
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
function showPendingOwnersError() {
    const pendingOwnersContent = document.getElementById('pending-owners-content');
    pendingOwnersContent.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Pending Owners</h3>
            <p>Please try refreshing the page.</p>
        </div>
    `;
}

function showRegisteredOwnersError() {
    const registeredOwnersContent = document.getElementById('registered-owners-content');
    registeredOwnersContent.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Registered Owners</h3>
            <p>Please try refreshing the page.</p>
        </div>
    `;
}

function showDriversError() {
    const driversContent = document.getElementById('drivers-content');
    driversContent.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Drivers</h3>
            <p>Please try refreshing the page.</p>
        </div>
    `;
}

// Make functions globally available for debugging
window.refreshDashboard = loadDashboardData;
window.getCurrentUser = () => currentUser;
window.getCurrentAssociation = () => currentAssociation;