// Owner Dashboard - UPDATED FOR OWNER FEATURES
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';

let supabase;
try {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully');
} catch (error) {
    console.error('Failed to initialize Supabase client:', error);
}

let currentUser = null;
let currentOwner = null;
let currentOwnerId = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function checkOwnerAuthentication() {
    try {
        console.log('Starting authentication check...');
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.log('No authenticated user, redirecting to login. Error:', authError?.message || 'No user found');
            window.location.href = 'index.html';
            return null;
        }

        console.log('User found:', user.id, user.email);
        
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Profile query failed:', profileError);
            window.location.href = 'index.html';
            return null;
        }

        if (profileData?.role !== 'owner') {
            console.log(`Role mismatch. Expected: owner, Got: ${profileData.role}`);
            window.location.href = 'index.html';
            return null;
        }

        console.log('Authentication successful:', profileData);
        return { ...user, ...profileData };
    } catch (error) {
        console.error('Authentication check error:', error);
        window.location.href = 'index.html';
        return null;
    }
}

async function initializeDashboard() {
    try {
        const user = await checkOwnerAuthentication();
        if (!user) return;

        currentUser = user;
        console.log('Owner user authenticated:', user.email);

        await loadUserData();
        await loadOwnerData();
        setupEventListeners();
        await loadDashboardData();

        showNotification('Dashboard loaded successfully!', 'success');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Failed to initialize dashboard. Please try refreshing.', 'error');
    }
}

async function loadOwnerData() {
    try {
        console.log('Loading owner data for:', currentUser.id);
        
        const { data, error } = await supabase
            .from('owners')
            .select('*')
            .eq('admin_id', currentUser.id) // Assuming owners are linked to admin/owner ID
            .single();

        if (error) {
            console.error('Error fetching owner data:', error);
            currentOwner = createDemoOwner();
        } else {
            currentOwner = data;
            console.log('Found existing owner:', data);
        }

        currentOwnerId = currentOwner.id;
        updateOwnerProfile(currentOwner);
    } catch (error) {
        console.error('Error loading owner data:', error);
        currentOwner = createDemoOwner();
        currentOwnerId = 'demo-mode';
        updateOwnerProfile(currentOwner);
    }
}

function createDemoOwner() {
    return {
        id: 'demo-mode',
        company_name: 'My Taxi Company',
        email: currentUser.email,
        phone: '+27 12 345 6789',
        address: '123 Main Street, Johannesburg',
        wallet_balance: 12500.50,
        is_demo: true
    };
}

function updateOwnerProfile(ownerData) {
    const ownerNameElement = document.getElementById('owner-name');
    if (ownerNameElement) {
        ownerNameElement.textContent = ownerData.company_name || 'Taxi Owner';
    }
    // Update other elements if needed
}

async function loadDashboardData() {
    await loadVehicles();
    await loadDrivers();
    await loadFinancialData();
}

async function loadVehicles() {
    try {
        const { data: vehicles, error } = await supabase
            .from('vehicles')
            .select('*')
            .eq('owner_id', currentOwnerId);

        if (error) {
            console.error('Error fetching vehicles:', error);
            vehicles = demoData.vehicles || [];
        }

        document.getElementById('vehicles-count').textContent = vehicles.length;
        renderFleetList(vehicles);
    } catch (error) {
        console.error('Error loading vehicles:', error);
    }
}

function renderFleetList(vehicles) {
    const listContainer = document.getElementById('fleet-list');
    listContainer.innerHTML = '';
    vehicles.forEach(vehicle => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-info">
                <h4>${vehicle.model}</h4>
                <p>Registration: ${vehicle.registration}</p>
            </div>
            <div class="item-actions">
                <button class="btn btn-sm btn-primary" onclick="editVehicle('${vehicle.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="removeVehicle('${vehicle.id}')">Remove</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
    if (vehicles.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">No vehicles yet. Add one to get started.</p>';
    }
}

// Similar functions for loadDrivers, renderDriverList

async function loadFinancialData() {
    try {
        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('owner_id', currentOwnerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching transactions:', error);
            transactions = demoData.transactions || [];
        }

        let balance = transactions.reduce((acc, tx) => acc + tx.amount, 0);
        document.getElementById('earnings-balance').textContent = `R ${balance.toFixed(2)}`;
        document.getElementById('current-balance').textContent = `R ${balance.toFixed(2)}`;
        renderTransactionHistory(transactions);
    } catch (error) {
        console.error('Error loading financial data:', error);
    }
}

function renderTransactionHistory(transactions) {
    const listContainer = document.getElementById('transaction-history');
    listContainer.innerHTML = '';
    transactions.forEach(tx => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-info">
                <h4>${tx.description}</h4>
                <p>Date: ${new Date(tx.created_at).toLocaleDateString()}</p>
            </div>
            <div class="item-amount ${tx.amount > 0 ? 'text-success' : 'text-danger'}">
                R ${tx.amount.toFixed(2)}
            </div>
        `;
        listContainer.appendChild(item);
    });
    if (transactions.length === 0) {
        listContainer.innerHTML = '<p class="empty-state">No transactions yet.</p>';
    }
}

// Modal open/close functions
function openAddVehicleModal() {
    showModal('add-vehicle-modal');
}

function openEditVehicleModal(vehicleId) {
    // Fetch vehicle data and populate form
    showModal('edit-vehicle-modal');
}

function openRemoveVehicleModal(vehicleId) {
    showModal('remove-vehicle-modal');
    // Set up confirm button to call delete function with vehicleId
}

// Similar for drivers and withdrawal

// Add event listeners for forms
function setupEventListeners() {
    const addVehicleForm = document.getElementById('add-vehicle-form');
    if (addVehicleForm) {
        addVehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const model = document.getElementById('vehicle-model').value;
            const registration = document.getElementById('vehicle-registration').value;
            await addVehicle({ model, registration });
        });
    }

    // Similar for other forms
}

async function addVehicle(data) {
    try {
        const { error } = await supabase
            .from('vehicles')
            .insert([{ ...data, owner_id: currentOwnerId }]);

        if (error) throw error;
        closeModal('add-vehicle-modal');
        loadDashboardData();
        showNotification('Vehicle added successfully', 'success');
    } catch (error) {
        console.error('Error adding vehicle:', error);
        showNotification('Failed to add vehicle', 'error');
    }
}

// Similar functions for editVehicle, removeVehicle, addDriver, etc.

// Withdrawal
async function withdrawFunds(amount) {
    try {
        const { error } = await supabase
            .from('transactions')
            .insert([{ owner_id: currentOwnerId, amount: -amount, description: 'Withdrawal' }]);

        if (error) throw error;
        closeModal('withdrawal-modal');
        loadFinancialData();
        showNotification('Withdrawal processed', 'success');
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        showNotification('Failed to process withdrawal', 'error');
    }
}

// ... (adapt other functions from association-dashboard.js, remove map-related, add owner-specific)