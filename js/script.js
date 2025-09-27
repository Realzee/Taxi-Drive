// This file can be empty or contain additional functionality
// All main functionality is now in supabase-services.js
console.log('TaxiDrive application loaded successfully');

// In the login form submission handler
// Login form submission
if (loginForm) {
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
}