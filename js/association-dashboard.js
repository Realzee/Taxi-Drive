
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

// Demo data storage for fallback
let demoData = {
    members: [],
    routes: []
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

// CREDENTIAL MANAGEMENT FOR MEMBERS/OWNERS
async function generateMemberCredentials(memberId, memberData) {
    try {
        console.log('Generating credentials for member:', memberId);
        
        // Generate a random password
        const tempPassword = generateTempPassword();
        
        if (currentAssociation.is_demo) {
            // Store in demo data
            const member = demoData.members.find(m => m.id === memberId);
            if (member) {
                member.temp_password = tempPassword;
                member.credentials_generated = true;
            }
            return { email: member.member_email, password: tempPassword };
        } else {
            // Create auth user in Supabase
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: memberData.member_email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: {
                    name: memberData.member_name,
                    role: memberData.role
                }
            });

            if (authError) {
                console.error('Auth user creation failed:', authError);
                throw new Error('Failed to create user credentials');
            }

            console.log('Auth user created:', authData.user.id);

            // Update member record with auth_id
            const { error: updateError } = await supabase
                .from('members')
                .update({ 
                    auth_id: authData.user.id,
                    credentials_generated: true
                })
                .eq('id', memberId);

            if (updateError) throw updateError;

            return { email: memberData.member_email, password: tempPassword };
        }
    } catch (error) {
        console.error('Error generating credentials:', error);
        throw error;
    }
}

function generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + '!'; // Add special character for password requirements
}

async function resetMemberCredentials(memberId) {
    try {
        const tempPassword = generateTempPassword();
        
        if (currentAssociation.is_demo) {
            const member = demoData.members.find(m => m.id === memberId);
            if (member) {
                member.temp_password = tempPassword;
            }
            return { password: tempPassword };
        } else {
            // Get member data to find auth_id
            const { data: member, error } = await supabase
                .from('members')
                .select('auth_id, member_email')
                .eq('id', memberId)
                .single();

            if (error) throw error;

            if (!member.auth_id) {
                throw new Error('No auth user found for this member');
            }

            // Update user password
            const { error: updateError } = await supabase.auth.admin.updateUserById(
                member.auth_id,
                { password: tempPassword }
            );

            if (updateError) throw updateError;

            return { email: member.member_email, password: tempPassword };
        }
    } catch (error) {
        console.error('Error resetting credentials:', error);
        throw error;
    }
}

// Update the member list rendering to include credential actions
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
        const hasCredentials = member.credentials_generated || member.temp_password;
        
        membersHtml += `
            <div class="list-item">
                <div class="item-icon">
                    <i class="fas fa-user"></i>
                </div>
                <div class="item-details">
                    <h4>${member.member_name || 'Unnamed Member'}</h4>
                    <p>${member.member_email || 'N/A'}</p>
                    <p class="member-role">${member.role} • <span class="status-indicator ${statusClass}">${statusText}</span></p>
                    <p class="credential-status ${hasCredentials ? 'text-success' : 'text-warning'}">
                        <i class="fas ${hasCredentials ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                        ${hasCredentials ? 'Credentials Set' : 'No Login Access'}
                    </p>
                </div>
                <div class="item-actions">
                    ${!hasCredentials ? `
                        <button class="btn btn-success btn-sm" onclick="setupMemberCredentials('${member.id}')" title="Setup Login">
                            <i class="fas fa-key"></i>
                        </button>
                    ` : `
                        <button class="btn btn-warning btn-sm" onclick="resetMemberCredentialsPrompt('${member.id}')" title="Reset Password">
                            <i class="fas fa-sync"></i>
                        </button>
                    `}
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

// Add credential setup function
async function setupMemberCredentials(memberId) {
    try {
        let member;
        
        if (currentAssociation.is_demo) {
            member = demoData.members.find(m => m.id === memberId);
        } else {
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .eq('id', memberId)
                .single();
            if (error) throw error;
            member = data;
        }

        if (!member) {
            showNotification('Member not found.', 'error');
            return;
        }

        const credentials = await generateMemberCredentials(memberId, member);
        
        showCredentialModal('Credentials Generated', `
            <p><strong>Login Details:</strong></p>
            <p>Email: ${credentials.email}</p>
            <p>Password: ${credentials.password}</p>
            <p class="text-warning"><i class="fas fa-exclamation-triangle"></i> Please save this password securely!</p>
        `);
        
        await loadRecentMembers();
        
    } catch (error) {
        console.error('Error setting up credentials:', error);
        showNotification('Failed to setup credentials: ' + error.message, 'error');
    }
}

async function resetMemberCredentialsPrompt(memberId) {
    if (!confirm('Are you sure you want to reset this member\'s password? They will need to use the new password to login.')) return;

    try {
        const credentials = await resetMemberCredentials(memberId);
        
        showCredentialModal('Password Reset', `
            <p><strong>New Login Details:</strong></p>
            <p>Password: ${credentials.password}</p>
            <p class="text-warning"><i class="fas fa-exclamation-triangle"></i> Provide the new password to the member!</p>
        `);
        
    } catch (error) {
        console.error('Error resetting credentials:', error);
        showNotification('Failed to reset password: ' + error.message, 'error');
    }
}

function showCredentialModal(title, content) {
    // Create or update credential modal
    let modal = document.getElementById('credential-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'credential-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="closeModal('credential-modal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="credential-content">${content}</div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="closeModal('credential-modal')">Close</button>
                    <button class="btn btn-success" onclick="copyCredentials()">
                        <i class="fas fa-copy"></i> Copy Details
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.querySelector('.modal-header h3').textContent = title;
        document.getElementById('credential-content').innerHTML = content;
    }
    
    showModal('credential-modal');
}

function copyCredentials() {
    const content = document.getElementById('credential-content').textContent;
    navigator.clipboard.writeText(content).then(() => {
        showNotification('Credentials copied to clipboard!', 'success');
    });
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
                 alt="${associationData.association_name || 'Association'} Logo" 
                 class="association-logo-large"
                 onerror="this.style.display='none'">
            <h2 class="association-name-display">${associationData.association_name || 'Taxi Association'}</h2>
            ${associationData.email ? `<p class="association-email-display">${associationData.email}</p>` : ''}
        `;
    } else {
        // No logo - show association name prominently
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

    // Insert before the Dashboard Overview section
    const dashboardOverview = document.querySelector('.stats-section');
    const mainContent = document.querySelector('.main-content .dashboard-container');
    
    if (dashboardOverview && mainContent) {
        mainContent.insertBefore(logoDisplaySection, dashboardOverview);
    } else if (mainContent) {
        // Fallback: insert at the beginning of main content
        mainContent.insertBefore(logoDisplaySection, mainContent.firstChild);
    }
}

function updateAssociationLogo(logoUrl) {
    const associationLogoElement = document.getElementById('association-logo');
    const mainLogoElement = document.getElementById('main-logo');

    // Main logo ALWAYS stays visible
    if (mainLogoElement) {
        mainLogoElement.style.display = 'block';
        mainLogoElement.style.visibility = 'visible';
        mainLogoElement.style.opacity = '1';
    }

    // Hide the small header association logo since we have the big display
    if (associationLogoElement) {
        associationLogoElement.style.display = 'none';
    }

    // Update the large logo display if it exists
    const largeLogoDisplay = document.getElementById('association-logo-display-section');
    if (largeLogoDisplay && logoUrl) {
        const logoImg = largeLogoDisplay.querySelector('.association-logo-large');
        if (logoImg) {
            logoImg.src = logoUrl;
            logoImg.style.display = 'block';
        }
    }

    // Association logo appears centered when available
    if (associationLogoElement) {
        if (logoUrl) {
            associationLogoElement.src = logoUrl;
            associationLogoElement.style.display = 'block';
            associationLogoElement.style.visibility = 'visible';
            associationLogoElement.style.opacity = '1';
            
            // Add loading error handling
            associationLogoElement.onerror = function() {
                console.error('Failed to load association logo:', logoUrl);
                this.style.display = 'none';
            };
            
            associationLogoElement.onload = function() {
                console.log('Association logo loaded successfully');
            };
        } else {
            // No association logo - hide it
            associationLogoElement.style.display = 'none';
            associationLogoElement.src = '';
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

    // Handle logo preview in profile modal
    const editLogoPreviewImg = document.getElementById('edit-logo-preview-img');
    const editLogoPreviewContainer = document.getElementById('edit-logo-preview-container');
    if (editLogoPreviewImg && editLogoPreviewContainer && associationData.logo_url) {
        editLogoPreviewImg.src = associationData.logo_url;
        editLogoPreviewContainer.style.display = 'block';
    } else if (editLogoPreviewImg && editLogoPreviewContainer) {
        editLogoPreviewContainer.style.display = 'none';
    }
}

// Dashboard Data Loading
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
        if (currentAssociation.is_demo) {
            updateDashboardStats({
                registeredVehicles: 12,
                registeredMembers: demoData.members.length || 8,
                activeRoutes: demoData.routes.length || 5,
                passengerAlarms: 2
            });
            return;
        }

        // UPDATED QUERIES FOR NEW SCHEMA
        const [vehicles, members, routes, alerts] = await Promise.all([
            supabase.from('vehicles').select('id').eq('association_id', currentAssociation.id),
            supabase.from('members').select('id').eq('association_id', currentAssociation.id),
            supabase.from('routes').select('id').eq('association_id', currentAssociation.id).eq('status', 'active'),
            supabase.from('panic_alerts').select('id').eq('association_id', currentAssociation.id).eq('status', 'active')
        ]);

        updateDashboardStats({
            registeredVehicles: vehicles.data?.length || 0,
            registeredMembers: members.data?.length || 0,
            activeRoutes: routes.data?.length || 0,
            passengerAlarms: alerts.data?.length || 0
        });
        
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

// MEMBER MANAGEMENT - UPDATED FOR NEW SCHEMA
async function loadRecentMembers() {
    try {
        if (currentAssociation.is_demo) {
            if (demoData.members.length === 0) {
                demoData.members = getInitialDemoMembers();
            }
            renderRecentMembers(demoData.members.slice(0, 3));
            return;
        }

        const { data: members, error } = await supabase
            .from('members')
            .select('*')
            .eq('association_id', currentAssociation.id)
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) throw error;
        renderRecentMembers(members || []);
        
    } catch (error) {
        console.error('Error loading recent members:', error);
        renderRecentMembers(getInitialDemoMembers().slice(0, 3));
    }
}

function getInitialDemoMembers() {
    return [
        {
            id: 'demo-member-1',
            member_name: 'John Driver',
            member_email: 'john@taxi.com',
            phone: '+27 82 111 2222',
            role: 'driver',
            is_verified: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-member-2', 
            member_name: 'Sarah Owner',
            member_email: 'sarah@taxi.com',
            phone: '+27 82 333 4444',
            role: 'owner',
            is_verified: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-member-3',
            member_name: 'Mike Member',
            member_email: 'mike@taxi.com', 
            phone: '+27 82 555 6666',
            role: 'member',
            is_verified: false,
            created_at: new Date().toISOString()
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
        if (currentAssociation.is_demo) {
            const newMember = {
                id: 'member-' + Date.now(),
                ...memberData,
                created_at: new Date().toISOString()
            };
            demoData.members.unshift(newMember);
        } else {
            const memberWithAssociation = {
                ...memberData,
                association_id: currentAssociation.id
            };

            const { error } = await supabase
                .from('members')
                .insert([memberWithAssociation]);

            if (error) throw error;
        }

        showNotification('Member added successfully!', 'success');
        closeModal('add-member-modal');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error adding member:', error);
        showNotification('Failed to add member.', 'error');
    }
}

async function editMember(memberId) {
    try {
        let member;
        
        if (currentAssociation.is_demo) {
            member = demoData.members.find(m => m.id === memberId);
        } else {
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .eq('id', memberId)
                .single();
            if (error) throw error;
            member = data;
        }

        if (!member) {
            showNotification('Member not found.', 'error');
            return;
        }

        document.getElementById('member-email').value = member.member_email || '';
        document.getElementById('member-name').value = member.member_name || '';
        document.getElementById('member-phone').value = member.phone || '';
        document.getElementById('member-role').value = member.role || 'member';
        document.getElementById('member-verified').checked = member.is_verified || false;

        const form = document.getElementById('add-member-form');
        form.setAttribute('data-edit-mode', 'true');
        form.setAttribute('data-member-id', memberId);

        document.querySelector('#add-member-modal .modal-header h3').textContent = 'Edit Member';
        openAddMemberModal();
        
    } catch (error) {
        console.error('Error loading member for edit:', error);
        showNotification('Failed to load member data.', 'error');
    }
}

async function updateMember(memberId, memberData) {
    try {
        if (currentAssociation.is_demo) {
            const memberIndex = demoData.members.findIndex(m => m.id === memberId);
            if (memberIndex !== -1) {
                demoData.members[memberIndex] = { ...demoData.members[memberIndex], ...memberData };
            }
        } else {
            const { error } = await supabase
                .from('members')
                .update(memberData)
                .eq('id', memberId);
            if (error) throw error;
        }

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
        if (currentAssociation.is_demo) {
            demoData.members = demoData.members.filter(m => m.id !== memberId);
        } else {
            const { error } = await supabase
                .from('members')
                .delete()
                .eq('id', memberId);
            if (error) throw error;
        }

        showNotification('Member deleted successfully!', 'success');
        await loadRecentMembers();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error deleting member:', error);
        showNotification('Failed to delete member.', 'error');
    }
}

// ROUTE MANAGEMENT - UPDATED FOR NEW SCHEMA
async function loadRecentRoutes() {
    try {
        if (currentAssociation.is_demo) {
            if (demoData.routes.length === 0) {
                demoData.routes = getInitialDemoRoutes();
            }
            renderRecentRoutes(demoData.routes.slice(0, 3));
            return;
        }

        const { data: routes, error } = await supabase
            .from('routes')
            .select('*')
            .eq('association_id', currentAssociation.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(3);

        if (error) throw error;
        renderRecentRoutes(routes || []);
        
    } catch (error) {
        console.error('Error loading recent routes:', error);
        renderRecentRoutes(getInitialDemoRoutes().slice(0, 3));
    }
}

function getInitialDemoRoutes() {
    return [
        {
            id: 'demo-route-1',
            route_name: 'City Center Route',
            origin: 'Downtown',
            destination: 'City Center',
            schedule: 'Daily 6AM-10PM',
            status: 'active',
            created_at: new Date().toISOString()
        },
        {
            id: 'demo-route-2',
            route_name: 'Airport Express', 
            origin: 'Central Station',
            destination: 'International Airport',
            schedule: 'Every 30 mins',
            status: 'active',
            created_at: new Date().toISOString()
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
        if (currentAssociation.is_demo) {
            const newRoute = {
                id: 'route-' + Date.now(),
                ...routeData,
                status: 'active',
                created_at: new Date().toISOString()
            };
            demoData.routes.unshift(newRoute);
        } else {
            const routeWithAssociation = {
                ...routeData,
                association_id: currentAssociation.id,
                status: 'active'
            };

            const { error } = await supabase
                .from('routes')
                .insert([routeWithAssociation]);
            if (error) throw error;
        }

        showNotification('Route added successfully!', 'success');
        closeModal('add-route-modal');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error adding route:', error);
        showNotification('Failed to add route.', 'error');
    }
}

async function editRoute(routeId) {
    try {
        let route;
        
        if (currentAssociation.is_demo) {
            route = demoData.routes.find(r => r.id === routeId);
        } else {
            const { data, error } = await supabase
                .from('routes')
                .select('*')
                .eq('id', routeId)
                .single();
            if (error) throw error;
            route = data;
        }

        if (!route) {
            showNotification('Route not found.', 'error');
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
        openAddRouteModal();
        
    } catch (error) {
        console.error('Error loading route for edit:', error);
        showNotification('Failed to load route data.', 'error');
    }
}

async function updateRoute(routeId, routeData) {
    try {
        if (currentAssociation.is_demo) {
            const routeIndex = demoData.routes.findIndex(r => r.id === routeId);
            if (routeIndex !== -1) {
                demoData.routes[routeIndex] = { ...demoData.routes[routeIndex], ...routeData };
            }
        } else {
            const { error } = await supabase
                .from('routes')
                .update(routeData)
                .eq('id', routeId);
            if (error) throw error;
        }

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
        if (currentAssociation.is_demo) {
            demoData.routes = demoData.routes.filter(r => r.id !== routeId);
        } else {
            const { error } = await supabase
                .from('routes')
                .delete()
                .eq('id', routeId);
            if (error) throw error;
        }

        showNotification('Route deleted successfully!', 'success');
        await loadRecentRoutes();
        await loadDashboardStats();
        
    } catch (error) {
        console.error('Error deleting route:', error);
        showNotification('Failed to delete route.', 'error');
    }
}

// ASSOCIATION PROFILE MANAGEMENT - UPDATED FOR NEW SCHEMA
async function saveAssociationProfile() {
    try {
        const logoInput = document.getElementById('edit-association-logo');
        const logoFile = logoInput?.files[0];

        // Validate logo file size
        if (logoFile && logoFile.size > 2 * 1024 * 1024) {
            showNotification('Logo file size exceeds 2MB limit.', 'error');
            return;
        }

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

        let logoUrl = currentAssociation.logo_url;

        if (!currentAssociation.is_demo && logoFile) {
            try {
                console.log('📝 Uploading logo...');
                const fileName = `${currentAssociationId}/${Date.now()}_${logoFile.name}`;
                
                const { data: storageData, error: storageError } = await supabase.storage
                    .from('logos')
                    .upload(fileName, logoFile, { 
                        cacheControl: '3600', 
                        upsert: false 
                    });

                if (storageError) {
                    console.error('❌ Logo upload error:', storageError);
                    
                    // If RLS error, provide helpful message
                    if (storageError.message.includes('row-level security')) {
                        showNotification('Logo upload failed due to security policies. Please contact administrator.', 'warning');
                    } else {
                        showNotification('Failed to upload logo. Please try again.', 'warning');
                    }
                    
                    // Continue without logo - don't block profile save
                    console.log('⚠️ Continuing without logo upload');
                } else {
                    const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
                    logoUrl = publicUrlData.publicUrl;
                    console.log('✅ Logo uploaded:', logoUrl);
                    showNotification('Logo uploaded successfully!', 'success');
                }
            } catch (uploadError) {
                console.error('❌ Logo upload failed:', uploadError);
                showNotification('Logo upload failed. Please try again.', 'warning');
                // Continue without logo
            }
        }

        // Update association data regardless of logo upload success
        if (!currentAssociation.is_demo) {
            const updateData = {
                ...formData,
                logo_url: logoUrl
            };

            const { error } = await supabase
                .from('associations')
                .update(updateData)
                .eq('id', currentAssociationId);
            if (error) throw error;
        }

        // Update current association data
        Object.assign(currentAssociation, formData, { logo_url: logoUrl });
        updateAssociationProfile(currentAssociation);
        
        showNotification('Profile updated successfully!', 'success');
        closeModal('profile-modal');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile.', 'error');
    }
}

// EVENT LISTENERS SETUP (NO CHANGES NEEDED)
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

    // Profile modal logo preview
    setupProfileLogoPreview();
}

function setupProfileLogoPreview() {
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

    // Reset profile form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.reset();
    }
}

// MODAL MANAGEMENT FUNCTIONS (NO CHANGES NEEDED)
function openProfileModal() {
    console.log('Opening profile modal');
    showModal('profile-modal');
    updateAssociationProfileModal(currentAssociation);
    
    // Load current profile data into form
    const logoInput = document.getElementById('edit-association-logo');
    if (logoInput) logoInput.value = ''; // Clear any previous file selection
}

// Global map variable to manage Leaflet instance
let mapInstance = null;
let userLocationMarker = null; // Marker for user's current location
let userLocationWatcher = null; // Geolocation watcher ID

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

    // Fetch vehicle locations from Supabase (if applicable)
    async function loadVehicles() {
        try {
            const { data: vehicles, error } = await supabase
                .from('vehicles')
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

// Clean up watcher when modal is closed
function closeMapModal() {
    closeModal('map-modal');
    if (userLocationWatcher) {
        navigator.geolocation.clearWatch(userLocationWatcher);
        userLocationWatcher = null;
        console.log('Stopped location tracking');
    }
}

// Update openMapModal to initialize map
function openMapModal() {
    console.log('Opening map modal');
    showModal('map-modal');
    
    if (!mapInstance) {
        initializeMap();
    } else {
        mapInstance.invalidateSize();
    }
}

let userAccuracyCircle = null;
// In getCurrentPosition/watchPosition success callback:
const accuracy = position.coords.accuracy;
if (userAccuracyCircle) {
    userAccuracyCircle.setLatLng([latitude, longitude]).setRadius(accuracy);
} else {
    userAccuracyCircle = L.circle([latitude, longitude], {
        radius: accuracy,
        color: '#007bff',
        fillOpacity: 0.1,
        weight: 1
    }).addTo(mapInstance);
}

function centerOnUserLocation() {
    if (userLocationMarker) {
        mapInstance.panTo(userLocationMarker.getLatLng());
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

// UTILITY FUNCTIONS (NO CHANGES NEEDED)
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

