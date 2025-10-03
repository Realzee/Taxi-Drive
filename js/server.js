javascript
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({
    origin: '*', // Replace with your client app's domain (e.g., 'https://your-client-app.com') for production
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg4NTIzNSwiZXhwIjoyMDc0NDYxMjM1fQ.o3rsjF8vkPO5KHce8DiKxFa2h1lbZAkXf7_IQaAMlaA'; // Replace with your service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Manage member authentication (create or update auth user)
app.post('/api/manage-member-auth', async (req, res) => {
    const { email, password, memberId } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        if (memberId) {
            // Update existing user's password
            const { data, error } = await supabase.auth.admin.updateUserById(memberId, { password });
            if (error) {
                console.error('Error updating auth user:', error);
                return res.status(500).json({ error: 'Failed to update member password: ' + error.message });
            }
            console.log('Auth user updated:', memberId);
            return res.json({ memberId });
        } else {
            // Create new auth user
            const { data, error } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });
            if (error) {
                console.error('Error creating auth user:', error);
                return res.status(500).json({ error: 'Failed to create auth user: ' + error.message });
            }
            console.log('Auth user created:', data.user.id);
            return res.json({ memberId: data.user.id });
        }
    } catch (error) {
        console.error('Unexpected error in manage-member-auth:', error);
        res.status(500).json({ error: 'Unexpected error: ' + error.message });
    }
});

// Delete auth user
app.post('/api/delete-user', async (req, res) => {
    const { userId } = req.body;
    try {
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) {
            console.error('Error deleting auth user:', error);
            return res.status(500).json({ error: 'Failed to delete auth user: ' + error.message });
        }

        console.log('Auth user deleted:', userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Unexpected error in delete-user:', error);
        res.status(500).json({ error: 'Unexpected error: ' + error.message });
    }
});

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});