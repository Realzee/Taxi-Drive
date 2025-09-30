// setup-database.js - Run this once to create required tables
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';

async function setupDatabase() {
    try {
        const { createClient } = window.supabase;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        console.log('Setting up database tables...');

        // Note: You'll need to create these tables in your Supabase dashboard
        // This script just provides the SQL structure
        
        const tablesSQL = `
        -- Create associations table
        CREATE TABLE IF NOT EXISTS associations (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            association_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            admin_id UUID NOT NULL REFERENCES auth.users(id),
            admin_name TEXT,
            admin_phone TEXT,
            description TEXT,
            logo_url TEXT,
            wallet_balance DECIMAL(10,2) DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create members table
        CREATE TABLE IF NOT EXISTS members (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            association_id UUID NOT NULL REFERENCES associations(id),
            member_name TEXT NOT NULL,
            member_email TEXT NOT NULL,
            phone TEXT,
            role TEXT NOT NULL DEFAULT 'member',
            is_verified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create routes table
        CREATE TABLE IF NOT EXISTS routes (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            association_id UUID NOT NULL REFERENCES associations(id),
            route_name TEXT NOT NULL,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            schedule TEXT NOT NULL,
            waypoints TEXT,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create vehicles table
        CREATE TABLE IF NOT EXISTS vehicles (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            association_id UUID NOT NULL REFERENCES associations(id),
            vehicle_reg TEXT NOT NULL,
            driver_name TEXT,
            last_location TEXT,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create panic_alerts table
        CREATE TABLE IF NOT EXISTS panic_alerts (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            association_id UUID NOT NULL REFERENCES associations(id),
            lat DECIMAL(10,6),
            lng DECIMAL(10,6),
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Enable Row Level Security (RLS)
        ALTER TABLE associations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE members ENABLE ROW LEVEL SECURITY;
        ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE panic_alerts ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY "Associations can only access their own data" ON associations
            FOR ALL USING (auth.uid() = admin_id);

        CREATE POLICY "Members can only be accessed by their association" ON members
            FOR ALL USING (association_id IN (SELECT id FROM associations WHERE admin_id = auth.uid()));

        CREATE POLICY "Routes can only be accessed by their association" ON routes
            FOR ALL USING (association_id IN (SELECT id FROM associations WHERE admin_id = auth.uid()));

        CREATE POLICY "Vehicles can only be accessed by their association" ON vehicles
            FOR ALL USING (association_id IN (SELECT id FROM associations WHERE admin_id = auth.uid()));

        CREATE POLICY "Alerts can only be accessed by their association" ON panic_alerts
            FOR ALL USING (association_id IN (SELECT id FROM associations WHERE admin_id = auth.uid()));
        `;

        console.log('Please run the following SQL in your Supabase SQL editor:');
        console.log(tablesSQL);
        
        showNotification('Database setup instructions logged to console. Please create tables in Supabase.', 'info');

    } catch (error) {
        console.error('Database setup error:', error);
        showNotification('Database setup failed. Check console for details.', 'error');
    }
}

// Uncomment to run setup (run this once)
// setupDatabase();