// This file can be empty or contain additional functionality
// All main functionality is now in supabase-services.js
console.log('TaxiDrive application loaded successfully');

// In the login form submission handler
try {
    await login(email, password, role);
    
    if (role === 'association') {
        window.location.href = 'association-dashboard.html';
    } else {
        window.location.href = '/dashboard.html';
    }
} catch (error) {
    showError('login-error-message', error.message || 'Login failed');
}