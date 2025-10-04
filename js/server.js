// server.js - UPDATED CORS CONFIGURATION
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');

const app = express();

// Supabase configuration
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Enhanced CORS configuration
app.use(cors({
    origin: [
        'https://realzee.github.io',
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'https://taxidrive-backend.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Manage member authentication - UPDATED WITH ERROR HANDLING
app.post('/manage-member-auth', async (req, res) => {
    console.log('Received /manage-member-auth request:', req.body);
    
    // Add CORS headers to response
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const { email, password, memberId } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        let user;
        if (memberId) {
            // Update existing user
            user = await supabase.auth.admin.updateUserById(memberId, { email, password });
        } else {
            // Create new user
            user = await supabase.auth.admin.createUser({ 
                email, 
                password,
                email_confirm: true 
            });
        }
        
        if (user.error) {
            console.error('Supabase error:', user.error);
            return res.status(400).json({ error: user.error.message });
        }
        
        console.log('User processed:', user.data.user.id);
        res.json({ 
            success: true,
            memberId: user.data.user.id,
            email: user.data.user.email 
        });
        
    } catch (error) {
        console.error('Server error in manage-member-auth:', error.message);
        res.status(500).json({ 
            error: error.message || 'Failed to manage member authentication' 
        });
    }
});

// Delete user - UPDATED
app.post('/delete-user', async (req, res) => {
    console.log('Received /delete-user request:', req.body);
    
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) {
            console.error('Supabase delete error:', error);
            return res.status(400).json({ error: error.message });
        }
        
        console.log('User deleted:', userId);
        res.json({ 
            success: true,
            message: 'User deleted successfully'
        });
        
    } catch (error) {
        console.error('Server error in delete-user:', error.message);
        res.status(500).json({ 
            error: error.message || 'Failed to delete user' 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'TaxiDrive Backend'
    });
});

// Test endpoint for CORS
app.get('/test-cors', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.json({ 
        message: 'CORS is working!',
        origin: req.headers.origin,
        timestamp: new Date().toISOString()
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 CORS enabled for: GitHub Pages, Localhost, Vercel`);
});