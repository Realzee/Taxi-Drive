// server.js
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');

const app = express();

// Supabase configuration
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Loaded from Vercel environment variables
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Explicit CORS configuration
app.use(cors({
    origin: ['https://realzee.github.io', 'http://localhost:3000'], // Allow GitHub Pages and local dev
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false // Set to true if cookies/auth tokens are needed
}));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors()); // Ensure CORS headers for all preflight requests

app.use(express.json());

// Manage member authentication
app.post('/manage-member-auth', async (req, res) => {
    console.log('Received /manage-member-auth request:', req.body);
    const { email, password, memberId } = req.body;
    try {
        let user;
        if (memberId) {
            // Update existing user
            user = await supabase.auth.admin.updateUserById(memberId, { email, password });
        } else {
            // Create new user
            user = await supabase.auth.signUp({ email, password });
        }
        if (user.error) {
            console.error('Supabase error:', user.error);
            throw user.error;
        }
        console.log('User processed:', user.data.user.id);
        res.json({ memberId: user.data.user.id });
    } catch (error) {
        console.error('Server error in manage-member-auth:', error.message);
        res.status(500).json({ error: error.message || 'Failed to manage member authentication' });
    }
});

// Delete user
app.post('/delete-user', async (req, res) => {
    console.log('Received /delete-user request:', req.body);
    const { userId } = req.body;
    try {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) throw error;
        console.log('User deleted:', userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Server error in delete-user:', error.message);
        res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));