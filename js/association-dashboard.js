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
let mapInstance = null;
let userLocationMarker = null;
let userLocationWatcher = null;
let currentMembers = [];
let currentRoutes = [];

// Demo data storage for fallback
let demoData = {
    members: [],
    routes: [],
    vehicles: [
        { id: '1', registration_number: 'ABC123GP', latitude: -26.2041, longitude: 28.0473 },
        { id: '2', registration_number: 'XYZ456GP', latitude: -26.1952, longitude: 28.0341 }
    ]
};

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

// Authentication check - UPDATED FOR NEW SCHEMA
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
        
        // Get user profile from profiles table (NEW SCHEMA)
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

// Load association data - UPDATED FOR NEW SCHEMA
async function loadAssociationData() {
    try {
        console.log('Loading association data for admin:', currentUser.id);
        
        let associationData = null;

        // Try to get association by admin_id (NEW SCHEMA)
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
    createLargeLogoDisplay(associationData);
}

function createLargeLogoDisplay(associationData) {
    // Remove existing logo display if any
    const existingDisplay = document.getElementById('association-logo-display-section');
    if (existingDisplay) {
        existingDisplay.remove();
    }

    // Create the large logo display section
    const logoDisplaySection = document.createElement('div');
    logoDisplaySection.id = 'association-logo-display-section';
    logoDisplaySection.className = 'association-logo-display';

    let logoHtml = '';
    
    if (associationData.logo_url) {
        // Association has a logo - show it big
        logoHtml = `
            <img src="${associationData.logo_url}" 
                 alt="${associationData.association_name} Logo" 
                 class="association-logo-large">
            <h2 class="association-name-display">${associationData.association_name}</h2>
            <p class="association-email-display">${associationData.email}</p>
        `;
        logoDisplaySection.classList.remove('hidden');
    } else {
        // No logo - hide or show placeholder
        logoHtml = `
            <div class="empty-state">
                <i class="fas fa-image"></i>
                <h3>No Logo Uploaded</h3>
                <p>Edit profile to add your association logo.</p>
            </div>
        `;
        logoDisplaySection.classList.add('hidden');
    }

    logoDisplaySection.innerHTML = logoHtml;

    // Insert after header or at top of main
    const mainContainer = document.querySelector('.dashboard-container');
    if (mainContainer) {
        mainContainer.insertBefore(logoDisplaySection, mainContainer.firstChild);
    }
}

function updateAssociationLogo(logoUrl) {
    const logoElements = [
        document.getElementById('association-logo'),
        document.getElementById('association-logo-display')
    ];

    logoElements.forEach(logo => {
        if (logo) {
            if (logoUrl) {
                logo.src = logoUrl;
                logo.style.display = 'block';
            } else {
                logo.style.display = 'none';
            }
        }
    });
}

function updateAssociationProfileModal(associationData) {
    const fields = {
        'edit-association-name': associationData.association_name,
        'edit-association-email': associationData.email,
        'edit-association-phone': associationData.phone,
        'edit-association-address': associationData.address,
        'edit-association-description': associationData.description,
        'edit-admin-name': associationData.admin_name,
        'edit-admin-phone': associationData.admin_phone
    };

    for (const [id, value] of Object.entries(fields)) {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    }

    const logoPreviewContainer = document.getElementById('edit-logo-preview-container');
    const logoPreviewImg = document.getElementById('edit-logo-preview-img');
    const logoInfo = document.getElementById('edit-logo-info');

    if (associationData.logo_url) {
        logoPreviewImg.src = associationData.logo_url;
        logoPreviewContainer.style.display = 'block';
        logoInfo.textContent = 'Current logo loaded';
    } else {
        logoPreviewContainer.style.display = 'none';
        logoInfo.textContent = '';
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const { data: routesData, error: routesError } = await supabase
            .from('routes')
            .select('id, route_name, origin, destination, schedule, waypoints, fare')
            .eq('association_id', currentAssociationId);

        if (routesError) {
            console.error('Error fetching routes:', routesError);
            showNotification('Failed to load routes.', 'error');
            return;
        }

        currentRoutes = routesData || [];
        updateRoutesList();

        const { data: membersData, error: membersError } = await supabase
            .from('members')
            .select('id, email, name, phone, role, is_verified, user_id')
            .eq('association_id', currentAssociationId);

        if (membersError) {
            console.error('Error fetching members:', membersError);
            showNotification('Failed to load members.', 'error');
            return;
        }

        currentMembers = membersData || [];
        updateMembersList();

        updateDashboardStats();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data.', 'error');
    }
}

function updateDashboardStats() {
    document.getElementById('vehicle-count').textContent = 0; // Placeholder, fetch if needed
    document.getElementById('member-count').textContent = currentMembers.length;
    document.getElementById('route-count').textContent = currentRoutes.length;
    document.getElementById('alarm-count').textContent = 0; // Placeholder
}

function updateRoutesList() {
    const routesList = document.getElementById('routes-list');
    if (!routesList) return;

    const routes = currentAssociation.is_demo ? demoData.routes : currentRoutes;

    if (routes.length === 0) {
        document.getElementById('no-routes').style.display = 'block';
        routesList.style.display = 'none';
        return;
    }

    document.getElementById('no-routes').style.display = 'none';
    routesList.style.display = 'block';
    routesList.innerHTML = '';

    routes.forEach(route => {
        const routeCard = document.createElement('div');
        routeCard.className = 'list-item';
        routeCard.innerHTML = `
            <div class="list-item-content">
                <h4>${route.route_name}</h4>
                <p>From: ${route.origin} to ${route.destination}</p>
                <p>Schedule: ${route.schedule}</p>
                <p>Fare: R ${route.fare.toFixed(2)}</p>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-sm btn-primary" onclick="editRoute('${route.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRoute('${route.id}')">Delete</button>
            </div>
        `;
        routesList.appendChild(routeCard);
    });
}

function updateMembersList() {
    const membersList = document.getElementById('members-list');
    if (!membersList) return;

    const members = currentAssociation.is_demo ? demoData.members : currentMembers;

    if (members.length === 0) {
        document.getElementById('no-members').style.display = 'block';
        membersList.style.display = 'none';
        return;
    }

    document.getElementById('no-members').style.display = 'none';
    membersList.style.display = 'block';
    membersList.innerHTML = '';

    members.forEach(member => {
        const memberCard = document.createElement('div');
        memberCard.className = 'list-item';
        memberCard.innerHTML = `
            <div class="list-item-content">
                <h4>${member.name}</h4>
                <p>Email: ${member.email || 'N/A'}</p>
                <p>Role: ${member.role}</p>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-sm btn-primary" onclick="editMember('${member.id}')">Edit</button>
                ${member.role === 'owner' ? `<button class="btn btn-sm btn-primary owner-only" onclick="editOwnerLogin('${member.id}')">Edit Login</button>` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteMember('${member.id}')">Delete</button>
            </div>
        `;
        membersList.appendChild(memberCard);
    });
}

function setupEventListeners() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

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

    const memberRoleSelect = document.getElementById('member-role');
    const ownerFields = document.querySelectorAll('.owner-only');
    if (memberRoleSelect) {
        memberRoleSelect.addEventListener('change', (e) => {
            const isOwner = e.target.value === 'owner';
            ownerFields.forEach(field => {
                field.style.display = isOwner ? 'block' : 'none';
                if (isOwner) {
                    document.getElementById('member-password').setAttribute('required', '');
                } else {
                    document.getElementById('member-password').removeAttribute('required');
                }
            });
        });
    }

    setupFormSubmissions();
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
                is_verified: document.getElementById('member-verified').checked,
                password: document.getElementById('member-password').value
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
                showNotification('Error saving member: ' + error.message, 'error');
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
                waypoints: document.getElementById('route-waypoints').value,
                fare: parseFloat(document.getElementById('route-fare').value) || 0
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
                showNotification('Error saving route: ' + error.message, 'error');
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

    // New: Edit owner login form
    const ownerLoginForm = document.getElementById('edit-owner-login-form');
    if (ownerLoginForm) {
        ownerLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const memberId = this.getAttribute('data-member-id');
            const formData = {
                email: document.getElementById('owner-login-email').value,
                password: document.getElementById('owner-login-password').value || null
            };

            try {
                await updateOwnerLogin(memberId, formData);
                showNotification('Owner login details updated successfully', 'success');
                closeModal('edit-owner-login-modal');
                await loadDashboardData(); // Refresh member list
            } catch (error) {
                console.error('Error updating owner login:', error);
                showNotification('Error updating owner login: ' + error.message, 'error');
            }
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

    // Reset profile form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.reset();
    }
}

// MODAL MANAGEMENT FUNCTIONS
function openProfileModal() {
    console.log('Opening profile modal');
    showModal('profile-modal');
    updateAssociationProfileModal(currentAssociation);
    
    // Load current profile data into form
    const logoInput = document.getElementById('edit-association-logo');
    if (logoInput) logoInput.value = ''; // Clear any previous file selection
}

function openMapModal() {
    console.log('Opening map modal');
    showModal('map-modal');
    
    if (!mapInstance) {
        initializeMap();
    } else {
        // Update map size when modal reopens
        mapInstance.invalidateSize();
    }
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

// UTILITY FUNCTIONS
function showModal(modalId) {
    console.log(`Showing modal: ${modalId}`);
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        console.error(`Modal ${modalId} not found`);
    }
}

function closeModal(modalId) {
    console.log(`Closing modal: ${modalId}`);
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
}

// Map Initialization with OSM and Current Location
function initializeMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Initialize Leaflet map
    mapInstance = L.map('map').setView([-26.2041, 28.0473], 10); // Default to Johannesburg

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(mapInstance);

    // Fetch vehicle locations from Supabase (example)
    async function loadVehicles() {
        try {
            const { data: vehicles, error } = await supabase
                .from('vehicles') // Adjust table name as needed
                .select('id, registration_number, latitude, longitude')
                .eq('association_id', currentAssociationId);

            if (error) {
                console.error('Error fetching vehicles:', error);
                showNotification('Failed to load vehicle locations.', 'error');
                return;
            }

            vehicles.forEach(vehicle => {
                if (vehicle.latitude && vehicle.longitude) {
                    L.marker([vehicle.latitude, vehicle.longitude])
                        .addTo(mapInstance)
                        .bindPopup(`Vehicle: ${vehicle.registration_number}`);
                }
            });
        } catch (error) {
            console.error('Error loading vehicle data:', error);
            showNotification('Error loading vehicle data.', 'error');
        }
    }

    loadVehicles();

    // Get and track user's current location
    if (navigator.geolocation) {
        // Initial location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                // Center map on user's location
                mapInstance.setView([latitude, longitude], 13);

                // Add or update marker for current location
                if (userLocationMarker) {
                    userLocationMarker.setLatLng([latitude, longitude]);
                } else {
                    userLocationMarker = L.marker([latitude, longitude], {
                        icon: L.divIcon({
                            className: 'user-location-marker',
                            html: '<div style="background-color: #007bff; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>',
                            iconSize: [15, 15],
                            iconAnchor: [7.5, 7.5]
                        })
                    }).addTo(mapInstance)
                      .bindPopup('Your Current Location');
                }

                showNotification('Your location is now displayed on the map.', 'success');
            },
            (error) => {
                console.error('Geolocation error:', error);
                showNotification('Unable to access your location. Please enable location services.', 'error');
            }
        );

        // Watch for location updates
        userLocationWatcher = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (userLocationMarker) {
                    userLocationMarker.setLatLng([latitude, longitude]);
                    mapInstance.panTo([latitude, longitude]); // Optional: Keep map centered
                }
            },
            (error) => {
                console.error('Geolocation watch error:', error);
                showNotification('Location update failed.', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    } else {
        console.error('Geolocation not supported by browser');
        showNotification('Your browser does not support location services.', 'error');
    }

    // Ensure map resizes correctly
    setTimeout(() => {
        mapInstance.invalidateSize();
    }, 100);
}

function closeMapModal() {
    closeModal('map-modal');
    if (userLocationWatcher) {
        navigator.geolocation.clearWatch(userLocationWatcher);
        userLocationWatcher = null;
        console.log('Stopped location tracking');
    }
}

async function addRoute(formData) {
    try {
        const routeData = {
            association_id: currentAssociationId,
            ...formData
        };

        const { error } = await supabase
            .from('routes')
            .insert([routeData]);

        if (error) throw error;

        showNotification('Route added successfully', 'success');
        closeModal('add-route-modal');
        await loadDashboardData();
    } catch (error) {
        console.error('Error adding route:', error);
        showNotification('Error adding route: ' + error.message, 'error');
    }
}

async function updateRoute(routeId, formData) {
    try {
        const { error } = await supabase
            .from('routes')
            .update(formData)
            .eq('id', routeId)
            .eq('association_id', currentAssociationId);

        if (error) throw error;

        showNotification('Route updated successfully', 'success');
        closeModal('add-route-modal');
        await loadDashboardData();
    } catch (error) {
        console.error('Error updating route:', error);
        showNotification('Error updating route: ' + error.message, 'error');
    }
}

async function deleteRoute(routeId) {
    if (!confirm('Are you sure you want to delete this route?')) return;

    try {
        const { error } = await supabase
            .from('routes')
            .delete()
            .eq('id', routeId)
            .eq('association_id', currentAssociationId);

        if (error) throw error;

        showNotification('Route deleted successfully', 'success');
        await loadDashboardData();
    } catch (error) {
        console.error('Error deleting route:', error);
        showNotification('Error deleting route: ' + error.message, 'error');
    }
}

function editRoute(routeId) {
    const route = currentRoutes.find(r => r.id === routeId);
    if (!route) {
        showNotification('Route not found', 'error');
        return;
    }

    const form = document.getElementById('add-route-form');
    if (form) {
        form.setAttribute('data-edit-mode', 'true');
        form.setAttribute('data-route-id', routeId);
        document.querySelector('#add-route-modal .modal-header h3').textContent = 'Edit Route';

        document.getElementById('route-name').value = route.route_name;
        document.getElementById('route-origin').value = route.origin;
        document.getElementById('route-destination').value = route.destination;
        document.getElementById('route-schedule').value = route.schedule;
        document.getElementById('route-fare').value = route.fare;
        document.getElementById('route-waypoints').value = route.waypoints;
    }

    openAddRouteModal();
}

async function addMember(formData) {
    try {
        if (formData.role === 'owner' && formData.password) {
            // Create owner in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: formData.member_email,
                password: formData.password,
                email_confirm: true
            });

            if (authError) {
                throw new Error('Failed to create owner account: ' + authError.message);
            }

            // Create profile
            const profileData = {
                id: authData.user.id,
                email: formData.member_email,
                role: 'owner',
                profile_complete: true
            };

            const { error: profileError } = await supabase
                .from('profiles')
                .insert([profileData]);

            if (profileError) {
                // Rollback auth user if profile creation fails
                await supabase.auth.admin.deleteUser(authData.user.id);
                throw new Error('Failed to create owner profile: ' + profileError.message);
            }

            // Add to members table
            const memberData = {
                association_id: currentAssociationId,
                email: formData.member_email,
                name: formData.member_name,
                phone: formData.phone,
                role: formData.role,
                is_verified: formData.is_verified,
                user_id: authData.user.id // Link to auth user
            };

            const { error: memberError } = await supabase
                .from('members')
                .insert([memberData]);

            if (memberError) {
                // Rollback profile and auth user
                await supabase.auth.admin.deleteUser(authData.user.id);
                await supabase.from('profiles').delete().eq('id', authData.user.id);
                throw new Error('Failed to add owner to members: ' + memberError.message);
            }
        } else {
            // Non-owner members (no auth changes)
            const memberData = {
                association_id: currentAssociationId,
                email: formData.member_email,
                name: formData.member_name,
                phone: formData.phone,
                role: formData.role,
                is_verified: formData.is_verified
            };

            const { error } = await supabase
                .from('members')
                .insert([memberData]);

            if (error) throw error;
        }

        showNotification('Member added successfully', 'success');
        closeModal('add-member-modal');
        memberForm.reset();
        await loadDashboardData();
    } catch (error) {
        console.error('Error adding member:', error);
        showNotification('Error adding member: ' + error.message, 'error');
    }
}

async function updateOwnerLogin(memberId, formData) {
    try {
        // Fetch member to get user_id
        const { data: member, error: memberError } = await supabase
            .from('members')
            .select('user_id, email')
            .eq('id', memberId)
            .eq('association_id', currentAssociationId)
            .single();

        if (memberError || !member.user_id) {
            throw new Error('Member not found or not an owner');
        }

        // Update email in Supabase Auth
        const { error: authError } = await supabase.auth.admin.updateUserById(
            member.user_id,
            { email: formData.email }
        );

        if (authError) {
            throw new Error('Failed to update owner email: ' + authError.message);
        }

        // Update password if provided
        if (formData.password) {
            const { error: passwordError } = await supabase.auth.admin.updateUserById(
                member.user_id,
                { password: formData.password }
            );

            if (passwordError) {
                throw new Error('Failed to update owner password: ' + passwordError.message);
            }
        }

        // Update email in members and profiles tables
        const { error: memberUpdateError } = await supabase
            .from('members')
            .update({ email: formData.email })
            .eq('id', memberId)
            .eq('association_id', currentAssociationId);

        if (memberUpdateError) {
            throw new Error('Failed to update member email: ' + memberUpdateError.message);
        }

        const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ email: formData.email })
            .eq('id', member.user_id);

        if (profileUpdateError) {
            throw new Error('Failed to update profile email: ' + profileUpdateError.message);
        }
    } catch (error) {
        throw error;
    }
}

function editOwnerLogin(memberId) {
    const member = currentAssociation.is_demo
        ? demoData.members.find(m => m.id === memberId)
        : currentMembers.find(m => m.id === memberId);

    if (!member || member.role !== 'owner') {
        showNotification('Member not found or not an owner', 'error');
        return;
    }

    const form = document.getElementById('edit-owner-login-form');
    if (form) {
        form.setAttribute('data-member-id', memberId);
        document.getElementById('owner-login-email').value = member.email || '';
        document.getElementById('owner-login-password').value = ''; // Password blank for security
        showModal('edit-owner-login-modal');
    }
}

async function saveAssociationProfile() {
    try {
        const formData = {
            association_name: document.getElementById('edit-association-name').value,
            email: document.getElementById('edit-association-email').value,
            phone: document.getElementById('edit-association-phone').value,
            address: document.getElementById('edit-association-address').value,
            description: document.getElementById('edit-association-description').value,
            admin_name: document.getElementById('edit-admin-name').value,
            admin_phone: document.getElementById('edit-admin-phone').value
        };

        const logoFile = document.getElementById('edit-association-logo').files[0];
        let logoUrl = currentAssociation.logo_url;

        if (logoFile) {
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('logos')
                .upload(`associations/${currentAssociationId}/${logoFile.name}`, logoFile);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('logos')
                .getPublicUrl(uploadData.path);

            logoUrl = publicUrlData.publicUrl;
            formData.logo_url = logoUrl;
        }

        const { error } = await supabase
            .from('associations')
            .update(formData)
            .eq('id', currentAssociationId);

        if (error) throw error;

        showNotification('Profile updated successfully', 'success');
        closeModal('profile-modal');
        await loadAssociationData();
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Error saving profile: ' + error.message, 'error');
    }
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
window.editOwnerLogin = editOwnerLogin;
