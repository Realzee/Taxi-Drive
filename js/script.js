// Wait for DOM to be fully loaded before setting up event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('TaxiDrive application loaded successfully');

    // Initialize all functionality
    initializeApplication();
});

function initializeApplication() {
    // Get DOM elements
    const loginForm = document.getElementById('login-form');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');

    // Check if elements exist
    if (!loginForm) {
        console.error('Login form not found!');
        return;
    }

    console.log('Initializing TaxiDrive application...');

    // Toggle between Login and Signup tabs
    if (signupTab) {
        signupTab.addEventListener('click', () => {
            if (loginForm) loginForm.style.display = 'none';
            showModal('signup-role-modal');
        });
    }

    if (loginTab) {
        loginTab.addEventListener('click', () => {
            if (loginForm) loginForm.style.display = 'block';
            closeAllModals();
        });
    }

    // Role selection buttons
    const roleButtons = document.querySelectorAll('.signup-role-btn');
    roleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const role = button.getAttribute('data-role');
            const modalMap = {
                'passenger': 'signup-passenger-modal',
                'driver': 'signup-driver-modal',
                'owner': 'signup-owner-modal',
                'association': 'signup-association-modal'
            };
            if (modalMap[role]) {
                showModal(modalMap[role]);
            }
        });
    });

    // Close buttons
    const closeButtons = document.querySelectorAll('.modal-close-btn, #signup-role-cancel, #modal-close-btn');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-modal') || button.id === 'signup-role-cancel' ? 'signup-role-modal' : 'signup-modal';
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = 'none';
            if (loginForm) loginForm.style.display = 'block';
        });
    });

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email')?.value;
        const password = document.getElementById('login-password')?.value;
        const role = document.getElementById('login-role')?.value;

        if (!email || !password || !role) {
            showError('login-error-message', 'Please fill in all fields');
            return;
        }

        try {
            const user = await login(email, password, role);
            if (user) {
                // Store user role in localStorage for dashboard access
                localStorage.setItem('userRole', role);
                localStorage.setItem('userEmail', email);
                
                // Redirect based on role
                if (role === 'association') {
                    window.location.href = 'association-dashboard.html';
                } else if (role === 'owner') {
                    window.location.href = 'owner-dashboard.html';
                } else if (role === 'driver') {
                    window.location.href = 'driver-dashboard.html';
                } else if (role === 'passenger') {
                    window.location.href = 'passenger-dashboard.html';
                } else {
                    // Default fallback
                    window.location.href = 'dashboard.html';
                }
            }
        } catch (error) {
            showError('login-error-message', error.message || 'Login failed');
        }
    });

    // Passenger signup
    const passengerForm = document.getElementById('signup-passenger');
    if (passengerForm) {
        passengerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('passenger-email')?.value;
            const password = document.getElementById('passenger-password')?.value;

            try {
                await signupSimple('passenger', { email, password });
                showSuccess('Passenger account created successfully');
                passengerForm.reset();
            } catch (error) {
                showError('signup-passenger-error-message', error.message || 'Registration failed');
            }
        });
    }

    // Driver signup
    const driverForm = document.getElementById('signup-driver');
    if (driverForm) {
        driverForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('driver-email')?.value;
            const password = document.getElementById('driver-password')?.value;
            const licenseNumber = document.getElementById('driver-license-number')?.value;

            try {
                await signupSimple('driver', { email, password, license_number: licenseNumber });
                showSuccess('Driver account created successfully');
                driverForm.reset();
            } catch (error) {
                showError('signup-driver-error-message', error.message || 'Registration failed');
            }
        });
    }

    // Owner signup
    const ownerForm = document.getElementById('signup-owner');
    if (ownerForm) {
        ownerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('owner-email')?.value;
            const password = document.getElementById('owner-password')?.value;
            const companyName = document.getElementById('owner-company-name')?.value;

            try {
                await signupSimple('owner', { email, password, company_name: companyName });
                showSuccess('Owner account created successfully');
                ownerForm.reset();
            } catch (error) {
                showError('signup-owner-error-message', error.message || 'Registration failed');
            }
        });
    }

    // Association signup
    const associationForm = document.getElementById('signup-association');
    if (associationForm) {
        associationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                name: document.getElementById('association-name')?.value,
                email: document.getElementById('association-email')?.value,
                phone: document.getElementById('association-phone')?.value,
                registrationNumber: document.getElementById('association-registration-number')?.value,
                address: document.getElementById('association-address')?.value,
                description: document.getElementById('association-description')?.value,
                logo: document.getElementById('association-logo')?.files[0],
                adminEmail: document.getElementById('admin-email')?.value,
                adminPassword: document.getElementById('admin-password')?.value,
                adminName: document.getElementById('admin-name')?.value,
                adminPhone: document.getElementById('admin-phone')?.value,
                adminIdNumber: document.getElementById('admin-id-number')?.value,
                termsAccepted: document.getElementById('terms-accepted')?.checked
            };

            if (!formData.termsAccepted) {
                showError('signup-association-error-message', 'You must accept the terms and conditions');
                return;
            }

            const progressBar = document.getElementById('signup-progress-bar');
            const progressText = document.getElementById('signup-progress-text');
            const progressDiv = document.getElementById('signup-progress');

            if (progressBar && progressText && progressDiv) {
                progressDiv.style.display = 'block';
                progressText.textContent = 'Registering association...';
                progressBar.style.width = '10%';
            }

            try {
                await signupAssociation(formData);
                if (progressBar && progressText) {
                    progressBar.style.width = '100%';
                    progressText.textContent = 'Registration complete!';
                }
                showSuccess('Association created successfully', `Login with: ${formData.adminEmail}`);
                associationForm.reset();
            } catch (error) {
                showError('signup-association-error-message', error.message || 'Registration failed');
                if (progressDiv) progressDiv.style.display = 'none';
            }
        });
    }

    // Logo preview for association form
    const logoInput = document.getElementById('association-logo');
    const logoPreviewContainer = document.getElementById('logo-preview-container');
    const logoPreviewImg = document.getElementById('logo-preview-img');
    const removeLogoBtn = document.getElementById('remove-logo-btn');

    if (logoInput && logoPreviewContainer && logoPreviewImg && removeLogoBtn) {
        logoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    logoPreviewImg.src = e.target.result;
                    logoPreviewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });

        removeLogoBtn.addEventListener('click', () => {
            logoInput.value = '';
            logoPreviewContainer.style.display = 'none';
            logoPreviewImg.src = '';
        });
    }

    console.log('TaxiDrive application initialized successfully');
}

// Utility to close all modals
function closeAllModals() {
    const modals = [
        'signup-role-modal',
        'signup-passenger-modal',
        'signup-driver-modal',
        'signup-owner-modal',
        'signup-association-modal',
        'signup-modal'
    ];
    modals.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    });
}

// Utility to show a modal
function showModal(modalId) {
    console.log(`Showing modal: ${modalId}`);
    closeAllModals(); // Close other modals first
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        console.error(`Modal ${modalId} not found`);
    }
}

function closeAllModals() {
    console.log('Closing all modals');
    const modals = [
        'signup-role-modal',
        'signup-passenger-modal',
        'signup-driver-modal',
        'signup-owner-modal',
        'signup-association-modal',
        'signup-modal'
    ];
    modals.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'none';
        }
    });
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.style.display = 'block';
    document.body.style.overflow = 'auto';
}
// Utility to show error message
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Utility to show success message
function showSuccess(message, loginDetails = '') {
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalLoginDetails = document.getElementById('modal-login-details');
    if (modalTitle && modalMessage && modalLoginDetails) {
        modalTitle.textContent = 'Success!';
        modalMessage.textContent = message;
        modalLoginDetails.textContent = loginDetails;
        showModal('signup-modal');
    }
}

// In script.js, add this function to update the welcome section
function updateWelcomeSection(userData) {
    console.log('Updating welcome section with user data:', userData);
    const welcomeSection = document.getElementById('welcome-section');
    const associationNameDisplay = document.getElementById('association-name-display');
    const associationLogoDisplay = document.getElementById('association-logo-display');

    if (welcomeSection && associationNameDisplay && associationLogoDisplay) {
        if (userData.role === 'association' && userData.association) {
            welcomeSection.style.display = 'block';
            associationNameDisplay.textContent = userData.association.name || 'Unknown Association';
            if (userData.association.logo_url) {
                associationLogoDisplay.src = userData.association.logo_url;
                associationLogoDisplay.style.display = 'block';
            } else {
                associationLogoDisplay.style.display = 'none';
            }
        } else {
            welcomeSection.style.display = 'none';
        }
    } else {
        console.error('Welcome section elements not found');
    }
}

// Modify the login event listener to call updateWelcomeSection
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.getElementById('login-role').value;
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMessage = document.getElementById('login-error-message');

    try {
        const userData = await login(email, password, role);
        console.log('Login successful:', userData);
        errorMessage.textContent = '';
        updateWelcomeSection(userData); // Update welcome section after login
        // Redirect to dashboard or show welcome section
        if (role === 'association') {
            window.location.href = './association-dashboard.html';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = error.message || 'Login failed. Please try again.';
    }
});
