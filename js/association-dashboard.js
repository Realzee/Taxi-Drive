// Association Dashboard - UPDATED FOR NEW SCHEMA AND MEMBER AUTH
// Relies on supabase-services.js for Supabase client and core functions

// Prevent duplicate script execution
if (window.associationDashboardLoaded) {
    console.warn('association-dashboard.js already loaded, skipping initialization');
} else {
    window.associationDashboardLoaded = true;

    console.log('Loading association-dashboard.js at:', new Date().toLocaleString());

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
        if (!window.supabase) {
            console.error('Supabase client not initialized. Ensure supabase-services.js is loaded.');
            window.showNotification('Failed to initialize dashboard. Please try refreshing.', 'error');
            return;
        }
        initializeDashboard();
    });

    // Authentication check
    async function checkAssociationAuthentication() {
        try {
            console.log('Starting authentication check...');
            const user = await window.checkAssociationAuthentication();
            if (!user) {
                console.log('No authenticated user, redirecting to login.');
                window.location.href = 'index.html';
                return null;
            }
            console.log('Authentication successful:', user);
            return user;
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

            window.showNotification('Dashboard loaded successfully!', 'success');
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            window.showNotification('Failed to initialize dashboard. Please try refreshing.', 'error');
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

    // Load association data
    async function loadAssociationData() {
        try {
            console.log('Loading association data for admin:', currentUser.id);
            const associationData = await window.getAssociationByAdminId(currentUser.id, currentAssociation?.is_demo);
            if (!associationData) {
                console.log('No association found, creating new one');
                const newAssociation = await window.createAssociation(currentUser.id, currentUser.email, currentUser.name);
                currentAssociation = newAssociation;
            } else {
                console.log('Found existing association:', associationData);
                currentAssociation = associationData;
            }

            currentAssociationId = currentAssociation.id;
            updateAssociationProfile(currentAssociation);
        } catch (error) {
            console.error('Error loading association data:', error);
            window.showNotification('Using demo mode. Database setup may be incomplete.', 'warning');
            currentAssociation = window.demoData.association;
            currentAssociationId = 'demo-mode';
            updateAssociationProfile(currentAssociation);
        }
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
        const existingDisplay = document.getElementById('association-logo-display-section');
        if (existingDisplay) {
            existingDisplay.remove();
        }

        const logoDisplaySection = document.createElement('div');
        logoDisplaySection.id = 'association-logo-display-section';
        logoDisplaySection.className = 'association-logo-display';

        let logoHtml = '';
        
        if (associationData.logo_url) {
            logoHtml = `
                <img src="${associationData.logo_url}" 
                     alt="${associationData.association_name || 'Association'} Logo" 
                     class="association-logo-large"
                     onerror="this.style.display='none'">
                <h2 class="association-name-display">${associationData.association_name || 'Taxi Association'}</h2>
                ${associationData.email ? `<p class="association-email-display">${associationData.email}</p>` : ''}
            `;
        } else {
            logoHtml = `
                <div style="text-align: center; padding: 20px;">
                    <div style="width: 120px; height: 120px; border-radius: 20px; background: linear-gradient(135deg, var(--dark-blue) 0%, var(--light-blue) 100%); display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto; border: 4px solid rgba(255, 255, 255, 0.8); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);">
                        <i class="fas fa-building" style="font-size: 3rem; color: white;"></i>
                    </div>
                    <h2 class="association-name-display">${associationData.association_name || 'Taxi Association'}</h2>
                    ${associationData.email ? `<p class="association-email-display">${associationData.email}</p>` : ''}
                    <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">Upload a logo in profile settings</p>
                </div>
            `;
        }

        logoDisplaySection.innerHTML = logoHtml;
        const dashboardOverview = document.querySelector('.stats-section');
        const mainContent = document.querySelector('.main-content .dashboard-container');
        
        if (dashboardOverview && mainContent) {
            mainContent.insertBefore(logoDisplaySection, dashboardOverview);
        } else if (mainContent) {
            mainContent.insertBefore(logoDisplaySection, mainContent.firstChild);
        }
    }

    function updateAssociationLogo(logoUrl) {
        const associationLogoElement = document.getElementById('association-logo');
        const mainLogoElement = document.getElementById('main-logo');

        if (mainLogoElement) {
            mainLogoElement.style.display = 'block';
            mainLogoElement.style.visibility = 'visible';
            mainLogoElement.style.opacity = '1';
        }

        if (associationLogoElement) {
            associationLogoElement.style.display = 'none';
        }

        const largeLogoDisplay = document.getElementById('association-logo-display-section');
        if (largeLogoDisplay && logoUrl) {
            const logoImg = largeLogoDisplay.querySelector('.association-logo-large');
            if (logoImg) {
                logoImg.src = logoUrl;
                logoImg.style.display = 'block';
            }
        }

        if (associationLogoElement && logoUrl) {
            associationLogoElement.src = logoUrl;
            associationLogoElement.style.display = 'block';
            associationLogoElement.style.visibility = 'visible';
            associationLogoElement.style.opacity = '1';
            associationLogoElement.onerror = function() {
                console.error('Failed to load association logo');
                this.style.display = 'none';
            };
        }
    }

    function updateAssociationProfileModal(associationData) {
        const profileForm = document.getElementById('edit-profile-form');
        if (profileForm && associationData) {
            document.getElementById('edit-association-name').value = associationData.association_name || '';
            document.getElementById('edit-association-email').value = associationData.email || '';
            document.getElementById('edit-association-phone').value = associationData.phone || '';
            document.getElementById('edit-association-address').value = associationData.address || '';
            document.getElementById('edit-association-description').value = associationData.description || '';
            document.getElementById('edit-admin-name').value = associationData.admin_name || '';
            document.getElementById('edit-admin-phone').value = associationData.admin_phone || '';

            const logoPreviewImg = document.getElementById('edit-logo-preview-img');
            const logoPreviewContainer = document.getElementById('edit-logo-preview-container');
            const logoInfo = document.getElementById('edit-logo-info');

            if (associationData.logo_url && logoPreviewImg && logoPreviewContainer) {
                logoPreviewImg.src = associationData.logo_url;
                logoPreviewContainer.style.display = 'block';
                logoInfo.textContent = 'Current logo';
            } else if (logoPreviewContainer) {
                logoPreviewContainer.style.display = 'none';
                logoInfo.textContent = '';
            }
        }
    }

    async function loadDashboardData() {
        try {
            await Promise.all([
                loadDashboardStats(),
                loadRecentMembers(),
                loadRecentRoutes()
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async function loadDashboardStats() {
        try {
            const stats = await window.getDashboardStats(currentAssociationId, currentAssociation.is_demo);
            updateDashboardStats(stats);
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
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
            const members = await window.getRecentMembers(currentAssociationId, currentAssociation.is_demo);
            demoData.members = members;
            renderRecentMembers(members);
        } catch (error) {
            console.error('Error loading recent members:', error);
            demoData.members = window.demoData.members.slice(0, 3);
            renderRecentMembers(demoData.members);
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
            const statusClass = member.verified ? 'status-active' : 'status-pending';
            const statusText = member.verified ? 'Verified' : 'Pending';
            
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
                        <button class="btn btn-secondary btn-sm" onclick="window.editMember('${member.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteMember('${member.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        recentMembersContent.innerHTML = membersHtml;
    }

    async function editMember(memberId) {
        try {
            const member = await window.getMemberById(memberId, currentAssociationId, currentAssociation.is_demo);
            if (!member) {
                window.showNotification('Member not found.', 'error');
                return;
            }

            const form = document.getElementById('add-member-form');
            form.setAttribute('data-edit-mode', 'true');
            form.setAttribute('data-member-id', memberId);

            document.getElementById('member-email').value = member.email;
            document.getElementById('member-password').value = ''; // Password field empty for security
            document.getElementById('member-name').value = member.name || '';
            document.getElementById('member-phone').value = member.phone || '';
            document.getElementById('member-role').value = member.role || 'owner';
            document.getElementById('member-verified').checked = member.verified || false;

            const errorElement = document.getElementById('member-error-message');
            if (errorElement) {
                errorElement.style.display = 'none';
            }
            document.querySelector('#add-member-modal .modal-header h3').textContent = 'Edit Member';
            window.showModal('add-member-modal');
        } catch (error) {
            console.error('Error editing member:', error);
            window.showNotification('Error loading member data.', 'error');
        }
    }

    async function updateMember(memberId, formData) {
        try {
            await window.updateMember(memberId, currentAssociationId, formData, currentAssociation.is_demo);
            window.showNotification('Member updated successfully!', 'success');
            window.closeModal('add-member-modal');
            resetForms();
            await loadRecentMembers();
            await loadDashboardStats();
        } catch (error) {
            console.error('Error updating member:', error);
            const errorElement = document.getElementById('member-error-message');
            if (errorElement) {
                window.showError('member-error-message', error.message || 'Error updating member.');
            } else {
                window.showNotification(error.message || 'Error updating member.', 'error');
            }
        }
    }

    async function deleteMember(memberId) {
        if (!confirm('Are you sure you want to delete this member?')) return;

        try {
            await window.deleteMember(memberId, currentAssociationId, currentAssociation.is_demo);
            window.showNotification('Member deleted successfully!', 'success');
            await loadRecentMembers();
            await loadDashboardStats();
        } catch (error) {
            console.error('Error deleting member:', error);
            window.showNotification(error.message || 'Error deleting member.', 'error');
        }
    }

    // ROUTE MANAGEMENT
    async function loadRecentRoutes() {
        try {
            const routes = await window.getRecentRoutes(currentAssociationId, currentAssociation.is_demo);
            demoData.routes = routes;
            renderRecentRoutes(routes);
        } catch (error) {
            console.error('Error loading recent routes:', error);
            demoData.routes = window.demoData.routes.slice(0, 3);
            renderRecentRoutes(demoData.routes);
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
                        <button class="btn btn-secondary btn-sm" onclick="window.editRoute('${route.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="window.deleteRoute('${route.id}')">
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
            await window.addRoute(currentAssociationId, routeData, currentAssociation.is_demo);
            window.showNotification('Route added successfully!', 'success');
            window.closeModal('add-route-modal');
            await loadRecentRoutes();
            await loadDashboardStats();
        } catch (error) {
            console.error('Error adding route:', error);
            window.showNotification('Failed to add route.', 'error');
        }
    }

    async function editRoute(routeId) {
        try {
            const route = await window.getRouteById(routeId, currentAssociationId, currentAssociation.is_demo);
            if (!route) {
                window.showNotification('Route not found.', 'error');
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
            window.showModal('add-route-modal');
        } catch (error) {
            console.error('Error loading route for edit:', error);
            window.showNotification('Failed to load route data.', 'error');
        }
    }

    async function updateRoute(routeId, routeData) {
        try {
            await window.updateRoute(routeId, currentAssociationId, routeData, currentAssociation.is_demo);
            window.showNotification('Route updated successfully!', 'success');
            window.closeModal('add-route-modal');
            await loadRecentRoutes();
            await loadDashboardStats();
        } catch (error) {
            console.error('Error updating route:', error);
            window.showNotification('Failed to update route.', 'error');
        }
    }

    async function deleteRoute(routeId) {
        if (!confirm('Are you sure you want to delete this route?')) return;

        try {
            await window.deleteRoute(routeId, currentAssociationId, currentAssociation.is_demo);
            window.showNotification('Route deleted successfully!', 'success');
            await loadRecentRoutes();
            await loadDashboardStats();
        } catch (error) {
            console.error('Error deleting route:', error);
            window.showNotification('Failed to delete route.', 'error');
        }
    }

    // ASSOCIATION PROFILE MANAGEMENT
    async function saveAssociationProfile() {
        try {
            const logoInput = document.getElementById('edit-association-logo');
            const logoFile = logoInput?.files[0];

            if (logoFile && logoFile.size > 2 * 1024 * 1024) {
                window.showNotification('Logo file size exceeds 2MB limit.', 'error');
                return;
            }

            const formData = {
                association_name: document.getElementById('edit-association-name')?.value || '',
                email: document.getElementById('edit-association-email')?.value || '',
                phone: document.getElementById('edit-association-phone')?.value || '',
                address: document.getElementById('edit-association-address')?.value || '',
                description: document.getElementById('edit-association-description')?.value || '',
                admin_name: document.getElementById('edit-admin-name')?.value || '',
                admin_phone: document.getElementById('edit-admin-phone')?.value || '',
                updated_at: new Date().toISOString()
            };

            let logoUrl = currentAssociation.logo_url;

            if (!currentAssociation.is_demo && logoFile) {
                logoUrl = await window.uploadLogo(currentAssociationId, logoFile, currentAssociation.is_demo);
            }

            const updateData = { ...formData, logo_url: logoUrl };
            await window.updateAssociation(currentAssociationId, updateData, currentAssociation.is_demo);

            Object.assign(currentAssociation, updateData);
            updateAssociationProfile(currentAssociation);
            
            window.showNotification('Profile updated successfully!', 'success');
            window.closeModal('profile-modal');
        } catch (error) {
            console.error('Error updating profile:', error);
            window.showNotification('Failed to update profile.', 'error');
        }
    }

    function setupEventListeners() {
        console.log('Setting up event listeners...');
        console.log('showModal available:', !!window.showModal);
        console.log('closeModal available:', !!window.closeModal);

        const profileBtn = document.getElementById('profile-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const alertsBtn = document.getElementById('alerts-btn');

        if (profileBtn) profileBtn.addEventListener('click', window.openProfileModal);
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
        if (alertsBtn) alertsBtn.addEventListener('click', window.openAlertsModal);

        const quickActionBtns = document.querySelectorAll('.quick-action-btn');
        quickActionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                if (action === 'add-member') {
                    window.showModal('add-member-modal');
                } else if (action === 'add-route') {
                    window.showModal('add-route-modal');
                } else if (action === 'view-map') {
                    window.showModal('map-modal');
                }
            });
        });

        // Enhanced member form submission handler
        const addMemberForm = document.getElementById('add-member-form');
        if (addMemberForm) {
            addMemberForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const editMode = addMemberForm.getAttribute('data-edit-mode') === 'true';
                const memberId = addMemberForm.getAttribute('data-member-id');

                const formData = {
                    email: document.getElementById('member-email')?.value,
                    password: document.getElementById('member-password')?.value,
                    name: document.getElementById('member-name')?.value,
                    phone: document.getElementById('member-phone')?.value,
                    role: document.getElementById('member-role')?.value,
                    verified: document.getElementById('member-verified')?.checked
                };

                // Validation
                if (!formData.email || (!formData.password && !editMode)) {
                    window.showError('member-error-message', 'Email and password are required.');
                    return;
                }

                if (!editMode && formData.password.length < 8) {
                    window.showError('member-error-message', 'Password must be at least 8 characters long.');
                    return;
                }

                try {
                    // Show loading state
                    const submitBtn = addMemberForm.querySelector('button[type="submit"]');
                    const originalText = submitBtn.textContent;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                    submitBtn.disabled = true;

                    if (editMode) {
                        await updateMember(memberId, formData);
                    } else {
                        await window.addMember(currentAssociationId, formData, currentAssociation.is_demo);
                        window.showNotification('Member added successfully!', 'success');
                        window.closeModal('add-member-modal');
                    }
                    
                    resetForms();
                    await loadRecentMembers();
                    await loadDashboardStats();
                    
                } catch (error) {
                    console.error('❌ Error handling member form:', error);
                    
                    // User-friendly error messages
                    let userMessage = error.message || 'Error processing member.';
                    
                    if (error.message.includes('authentication service') || 
                        error.message.includes('Cannot connect') ||
                        error.message.includes('CORS')) {
                        userMessage = 'Authentication service is temporarily unavailable. Please try again in a few moments.';
                    } else if (error.message.includes('already registered')) {
                        userMessage = 'This email is already registered. Please use a different email.';
                    }
                    
                    window.showError('member-error-message', userMessage);
                } finally {
                    // Reset button state
                    const submitBtn = addMemberForm.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.innerHTML = originalText;
                        submitBtn.disabled = false;
                    }
                }
            });
        }

        const addRouteForm = document.getElementById('add-route-form');
        if (addRouteForm) {
            addRouteForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const editMode = addRouteForm.getAttribute('data-edit-mode') === 'true';
                const routeId = addRouteForm.getAttribute('data-route-id');

                const routeData = {
                    route_name: document.getElementById('route-name')?.value,
                    origin: document.getElementById('route-origin')?.value,
                    destination: document.getElementById('route-destination')?.value,
                    schedule: document.getElementById('route-schedule')?.value,
                    waypoints: document.getElementById('route-waypoints')?.value
                };

                if (!routeData.route_name || !routeData.origin || !routeData.destination) {
                    window.showError('route-error-message', 'Route name, origin, and destination are required.');
                    return;
                }

                try {
                    if (editMode) {
                        await updateRoute(routeId, routeData);
                    } else {
                        await addRoute(routeData);
                    }
                    resetForms();
                } catch (error) {
                    console.error('Error handling route form:', error);
                    window.showError('route-error-message', error.message || 'Error processing route.');
                }
            });
        }

        const editProfileForm = document.getElementById('edit-profile-form');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveAssociationProfile();
            });
        }

        const logoInput = document.getElementById('edit-association-logo');
        const logoPreviewImg = document.getElementById('edit-logo-preview-img');
        const logoPreviewContainer = document.getElementById('edit-logo-preview-container');
        const removeLogoBtn = document.getElementById('edit-remove-logo-btn');
        const logoInfo = document.getElementById('edit-logo-info');

        if (logoInput && logoPreviewImg && logoPreviewContainer && removeLogoBtn && logoInfo) {
            logoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        window.showError('profile-error-message', 'Logo file size exceeds 2MB limit.');
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

        const closeButtons = document.querySelectorAll('.modal-close-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const modalId = button.getAttribute('data-modal');
                if (modalId) {
                    window.closeModal(modalId);
                }
            });
        });

        // Map Modal
        const mapModal = document.getElementById('map-modal');
        if (mapModal) {
            mapModal.addEventListener('shown', window.initializeMap);
        }
    }

    function resetForms() {
        const forms = document.querySelectorAll('#add-member-form, #add-route-form, #edit-profile-form');
        forms.forEach(form => {
            form.reset();
            form.removeAttribute('data-edit-mode');
            form.removeAttribute('data-member-id');
            form.removeAttribute('data-route-id');
            if (form.id === 'add-member-form') {
                document.querySelector('#add-member-modal .modal-header h3').textContent = 'Add New Member';
            } else if (form.id === 'add-route-form') {
                document.querySelector('#add-route-modal .modal-header h3').textContent = 'Add New Route';
            }
        });

        const errorElements = document.querySelectorAll('#member-error-message, #route-error-message, #profile-error-message');
        errorElements.forEach(el => {
            el.style.display = 'none';
        });
    }

    async function handleLogout() {
        try {
            await window.signOut();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error logging out:', error);
            window.showNotification('Error logging out.', 'error');
        }
    }

    async function initializeMap() {
        try {
            const vehicles = await window.getVehicles(currentAssociationId, currentAssociation.is_demo);
            const mapElement = document.getElementById('map');
            if (!mapElement) {
                console.error('Map element not found');
                return;
            }

            // Initialize Leaflet map
            const map = L.map(mapElement).setView([-26.2041, 28.0473], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            vehicles.forEach(vehicle => {
                if (vehicle.latitude && vehicle.longitude) {
                    L.marker([vehicle.latitude, vehicle.longitude])
                        .addTo(map)
                        .bindPopup(`Vehicle: ${vehicle.registration_number}`);
                }
            });
        } catch (error) {
            console.error('Error initializing map:', error);
            window.showNotification('Failed to load map.', 'error');
        }
    }

    window.openProfileModal = function() {
        updateAssociationProfileModal(currentAssociation);
        window.showModal('profile-modal');
    };

    window.openAlertsModal = function() {
        window.showModal('alerts-modal');
    };

    // Expose necessary functions globally
    window.editMember = editMember;
    window.deleteMember = deleteMember;
    window.editRoute = editRoute;
    window.deleteRoute = deleteRoute;
    window.initializeMap = initializeMap;

    console.log('association-dashboard.js fully loaded');
}