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

    // Ensure supabase-services.js functions are available
    if (!window.supabase || !window.login || !window.signupSimple || !window.signupAssociation) {
        console.error('Required functions from supabase-services.js are not available');
        return;
    }

    console.log('Initializing TaxiDrive application...');

    // Toggle between Login and Signup tabs
    if (signupTab) {
        signupTab.addEventListener('click', () => {
            loginForm.style.display = 'none';
            window.showModal('signup-role-modal');
            loginTab.classList.remove('active');
            signupTab.classList.add('active');
        });
    }

    if (loginTab) {
        loginTab.addEventListener('click', () => {
            loginForm.style.display = 'block';
            window.closeAllModals();
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
        });
    }

    // Login form submission
    loginForm.removeEventListener('submit', handleLoginSubmission); // Prevent duplicates
    loginForm.addEventListener('submit', handleLoginSubmission);

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
                window.showModal(modalMap[role]);
                window.closeModal('signup-role-modal');
            }
        });
    });

    // Close buttons
    const closeButtons = document.querySelectorAll('.modal-close-btn, #signup-role-cancel, #modal-close-btn');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-modal') || (button.id === 'signup-role-cancel' ? 'signup-role-modal' : 'signup-modal');
            window.closeModal(modalId);
            loginForm.style.display = 'block';
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
        });
    });

    // Passenger signup
    const passengerForm = document.getElementById('signup-passenger');
    if (passengerForm) {
        passengerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('passenger-email')?.value;
            const password = document.getElementById('passenger-password')?.value;

            try {
                await window.signupSimple(email, password, 'passenger', {});
                window.showSuccess('signup-modal', 'Passenger account created successfully');
                passengerForm.reset();
                window.closeModal('signup-passenger-modal');
            } catch (error) {
                window.showError('signup-passenger-error-message', error.message || 'Registration failed');
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
                await window.signupSimple(email, password, 'driver', { licenseNumber });
                window.showSuccess('signup-modal', 'Driver account created successfully');
                driverForm.reset();
                window.closeModal('signup-driver-modal');
            } catch (error) {
                window.showError('signup-driver-error-message', error.message || 'Registration failed');
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
                await window.signupSimple(email, password, 'owner', { companyName });
                window.showSuccess('signup-modal', 'Owner account created successfully');
                ownerForm.reset();
                window.closeModal('signup-owner-modal');
            } catch (error) {
                window.showError('signup-owner-error-message', error.message || 'Registration failed');
            }
        });
    }

    // Association signup
    const associationForm = document.getElementById('signup-association');
    if (associationForm) {
        associationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                association_name: document.getElementById('association-name')?.value,
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
                window.showError('signup-association-error-message', 'You must accept the terms and conditions');
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
                await window.signupAssociation(formData);
                if (progressBar && progressText) {
                    progressBar.style.width = '100%';
                    progressText.textContent = 'Registration complete!';
                }
                window.showSuccess('signup-modal', 'Association account created successfully', `Login with: ${formData.adminEmail}`);
                associationForm.reset();
                window.closeModal('signup-association-modal');
            } catch (error) {
                window.showError('signup-association-error-message', error.message || 'Registration failed');
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
                if (file.size > 2 * 1024 * 1024) {
                    window.showError('signup-association-error-message', 'Logo file size exceeds 2MB limit');
                    logoInput.value = '';
                    return;
                }
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

async function handleLoginSubmission(e) {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;
    const role = document.getElementById('login-role')?.value;

    if (!email || !password || !role) {
        window.showError('login-error-message', 'Please fill in all fields');
        return;
    }

    try {
        const { redirect } = await window.login(email, password, role);
        window.showSuccess('login-success-message', 'Login successful! Redirecting...');
        setTimeout(() => {
            window.location.href = redirect;
        }, 1000);
    } catch (error) {
        console.error('Login error:', error);
        window.showError('login-error-message', error.message || 'Login failed');
    }
}

// Utility to close all modals
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

// Utility to show error message
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        console.error(`Error element ${elementId} not found`);
    }
}

// Utility to show success message
function showSuccess(elementId, message, loginDetails = '') {
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalLoginDetails = document.getElementById('modal-login-details');
    if (modalTitle && modalMessage && modalLoginDetails) {
        modalTitle.textContent = 'Success!';
        modalMessage.textContent = message;
        modalLoginDetails.textContent = loginDetails;
        window.showModal('signup-modal');
    } else {
        const successElement = document.getElementById(elementId);
        if (successElement) {
            successElement.textContent = message;
            successElement.style.display = 'block';
        } else {
            console.error(`Success element ${elementId} not found`);
        }
    }
}

// Make functions globally available
window.showModal = showModal;
window.closeAllModals = closeAllModals;
window.showError = showError;
window.showSuccess = showSuccess;