// owner-dashboard.js - UPDATED
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let ownerId, associationId, currentUser;
let map, vehicleMarkers = {};

document.addEventListener('DOMContentLoaded', async () => {
  // Authentication check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.log('No authenticated user, redirecting to login');
    location.href = 'index.html';
    return;
  }

  currentUser = user;
  
  // Get owner profile from members table (NEW SCHEMA)
  const { data: owner, error } = await supabase
    .from('members')
    .select('*')
    .eq('auth_id', user.id)
    .eq('role', 'owner')
    .single();

  if (error || !owner) {
    console.error('Owner not found or access denied:', error);
    location.href = 'index.html';
    return;
  }

  ownerId = owner.id;
  associationId = owner.association_id;

  // Update UI with owner info
  updateOwnerHeader(owner);
  
  initMap();
  initModals();
  loadDashboard();
  subscribeRealtime();
});

function updateOwnerHeader(ownerData) {
  const userNameElement = document.getElementById('user-name');
  if (userNameElement) {
    userNameElement.textContent = ownerData.member_name || ownerData.member_email.split('@')[0];
  }
}

async function loadDashboard() {
  try {
    const [driversResponse, vehiclesResponse, txnsResponse] = await Promise.all([
      supabase.from('drivers').select('*').eq('owner_id', ownerId),
      supabase.from('vehicles').select('*').eq('owner_id', ownerId),
      supabase.from('transactions').select('*').eq('owner_id', ownerId)
    ]);

    const drivers = driversResponse.data || [];
    const vehicles = vehiclesResponse.data || [];
    const txns = txnsResponse.data || [];

    renderList('driver-list', drivers, 'driver');
    renderList('vehicle-list', vehicles, 'vehicle');

    document.getElementById('stat-drivers').textContent = drivers.length;
    document.getElementById('stat-vehicles').textContent = vehicles.length;

    const total = txns.reduce((s, t) => s + Number(t.amount || 0), 0);
    const net = total - (0.5 * txns.length);
    document.getElementById('stat-earnings').textContent = `R${total.toFixed(2)}`;
    document.getElementById('stat-balance').textContent = `R${net.toFixed(2)}`;

    updateMap(vehicles);
    
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showNotification('Failed to load dashboard data', 'error');
  }
}

function renderList(id, items, type) {
  const container = document.getElementById(id);
  if (!items || !items.length) {
    return container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-${type === 'driver' ? 'users' : 'car-side'}"></i>
        <h3>No ${type}s Yet</h3>
        <p>Add your first ${type} to get started.</p>
      </div>
    `;
  }
  
  container.innerHTML = items.map(item => `
    <div class="list-item">
      <div class="item-details">
        <div class="item-icon">
          <i class="fas fa-${type === 'driver' ? 'user' : 'car'}"></i>
        </div>
        <div>
          <h4>${item.name || item.model || 'Unnamed'}</h4>
          <p>${type === 'driver' ? (item.license_type || 'Driver') : (item.reg_no || 'Vehicle')}</p>
          <p class="status-indicator ${item.status === 'Active' ? 'status-active' : 'status-pending'}">
            ${item.status || 'Active'}
          </p>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn btn-secondary btn-sm" onclick="edit${capitalize(type)}('${item.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="delete${capitalize(type)}('${item.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

/* Map Functions */
function initMap() {
  map = L.map('fleet-map').setView([-26.2041, 28.0473], 10); // Johannesburg center
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19 
  }).addTo(map);
}

function updateMap(vehicles) {
  // Clear existing markers
  Object.values(vehicleMarkers).forEach(marker => map.removeLayer(marker));
  vehicleMarkers = {};

  // Add new markers
  vehicles.forEach(vehicle => {
    if (!vehicle.live_lat || !vehicle.live_lng) return;
    
    const pos = [vehicle.live_lat, vehicle.live_lng];
    vehicleMarkers[vehicle.id] = L.marker(pos)
      .addTo(map)
      .bindPopup(`
        <strong>${vehicle.model || 'Vehicle'}</strong><br>
        ${vehicle.reg_no || 'No registration'}<br>
        Status: ${vehicle.status || 'Unknown'}
      `);
  });

  // Fit map to show all vehicles
  if (vehicles.length > 0) {
    const vehicleLocations = vehicles
      .filter(v => v.live_lat && v.live_lng)
      .map(v => [v.live_lat, v.live_lng]);
    
    if (vehicleLocations.length > 0) {
      map.fitBounds(vehicleLocations, { padding: [20, 20] });
    }
  }
}

/* CRUD Operations */
async function editDriver(id) {
  const { data, error } = await supabase.from('drivers').select('*').eq('id', id).single();
  if (error) {
    showNotification('Failed to load driver', 'error');
    return;
  }
  openDriverModal(data);
}

async function editVehicle(id) {
  const { data, error } = await supabase.from('vehicles').select('*').eq('id', id).single();
  if (error) {
    showNotification('Failed to load vehicle', 'error');
    return;
  }
  openVehicleModal(data);
}

async function deleteDriver(id) {
  if (!confirm('Are you sure you want to delete this driver?')) return;
  
  const { error } = await supabase.from('drivers').delete().eq('id', id);
  if (error) {
    showNotification('Failed to delete driver', 'error');
    return;
  }
  
  showNotification('Driver deleted successfully', 'success');
  loadDashboard();
}

async function deleteVehicle(id) {
  if (!confirm('Are you sure you want to delete this vehicle?')) return;
  
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) {
    showNotification('Failed to delete vehicle', 'error');
    return;
  }
  
  showNotification('Vehicle deleted successfully', 'success');
  loadDashboard();
}

/* Modal Management */
function initModals() {
  // Modal close functionality
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.style.display = 'none';
        resetForms();
      }
    });
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) {
        modal.style.display = 'none';
        resetForms();
      }
    });
  });

  // Button event listeners
  document.getElementById('add-driver-btn').onclick = () => openDriverModal();
  document.getElementById('add-vehicle-btn').onclick = () => openVehicleModal();
  document.getElementById('withdraw-btn').onclick = openWithdrawModal;
  document.getElementById('earnings-btn').onclick = openEarningsModal;

  // Form submissions
  document.getElementById('driver-form').onsubmit = saveDriver;
  document.getElementById('vehicle-form').onsubmit = saveVehicle;

  // Bottom navigation
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const target = this.getAttribute('data-target');
      navItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
      
      switch(target) {
        case 'home': break;
        case 'map': openMapView(); break;
        case 'wallet': openWalletModal(); break;
        case 'profile': openProfileModal(); break;
      }
    });
  });

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

function openDriverModal(driver = null) {
  const modal = document.getElementById('driver-modal');
  const title = document.getElementById('driver-modal-title');
  
  title.textContent = driver ? 'Edit Driver' : 'Add Driver';
  
  // Reset form
  const form = document.getElementById('driver-form');
  form.reset();
  form.removeAttribute('data-edit-id');
  
  // Populate if editing
  if (driver) {
    form.setAttribute('data-edit-id', driver.id);
    document.getElementById('driver-id').value = driver.id;
    document.getElementById('driver-name').value = driver.name || '';
    document.getElementById('driver-surname').value = driver.surname || '';
    document.getElementById('driver-idnum').value = driver.id_number || '';
    document.getElementById('driver-license').value = driver.license_type || '';
    document.getElementById('driver-license-exp').value = driver.license_expiry || '';
    document.getElementById('driver-prdp').value = driver.prdp ? 'true' : 'false';
    document.getElementById('driver-prdp-exp').value = driver.prdp_expiry || '';
  }
  
  modal.style.display = 'flex';
}

async function saveDriver(e) {
  e.preventDefault();
  
  const form = document.getElementById('driver-form');
  const isEdit = form.hasAttribute('data-edit-id');
  const driverId = form.getAttribute('data-edit-id');
  
  const data = {
    owner_id: ownerId,
    association_id: associationId,
    name: document.getElementById('driver-name').value,
    surname: document.getElementById('driver-surname').value,
    id_number: document.getElementById('driver-idnum').value,
    license_type: document.getElementById('driver-license').value,
    license_expiry: document.getElementById('driver-license-exp').value || null,
    prdp: document.getElementById('driver-prdp').value === 'true',
    prdp_expiry: document.getElementById('driver-prdp-exp').value || null,
    status: 'Active'
  };

  try {
    if (isEdit) {
      const { error } = await supabase.from('drivers').update(data).eq('id', driverId);
      if (error) throw error;
      showNotification('Driver updated successfully!', 'success');
    } else {
      const { error } = await supabase.from('drivers').insert([data]);
      if (error) throw error;
      showNotification('Driver added successfully!', 'success');
    }
    
    document.getElementById('driver-modal').style.display = 'none';
    loadDashboard();
    
  } catch (error) {
    console.error('Error saving driver:', error);
    showNotification('Failed to save driver', 'error');
  }
}

function openVehicleModal(vehicle = null) {
  const modal = document.getElementById('vehicle-modal');
  const title = document.getElementById('vehicle-modal-title');
  
  title.textContent = vehicle ? 'Edit Vehicle' : 'Add Vehicle';
  
  // Reset form
  const form = document.getElementById('vehicle-form');
  form.reset();
  form.removeAttribute('data-edit-id');
  
  // Populate if editing
  if (vehicle) {
    form.setAttribute('data-edit-id', vehicle.id);
    document.getElementById('vehicle-id').value = vehicle.id;
    document.getElementById('vehicle-model').value = vehicle.model || '';
    document.getElementById('vehicle-reg').value = vehicle.reg_no || '';
    document.getElementById('vehicle-status').value = vehicle.status || 'Active';
  }
  
  modal.style.display = 'flex';
}

async function saveVehicle(e) {
  e.preventDefault();
  
  const form = document.getElementById('vehicle-form');
  const isEdit = form.hasAttribute('data-edit-id');
  const vehicleId = form.getAttribute('data-edit-id');
  
  const data = {
    owner_id: ownerId,
    association_id: associationId,
    model: document.getElementById('vehicle-model').value,
    reg_no: document.getElementById('vehicle-reg').value,
    status: document.getElementById('vehicle-status').value
  };

  try {
    if (isEdit) {
      const { error } = await supabase.from('vehicles').update(data).eq('id', vehicleId);
      if (error) throw error;
      showNotification('Vehicle updated successfully!', 'success');
    } else {
      const { error } = await supabase.from('vehicles').insert([data]);
      if (error) throw error;
      showNotification('Vehicle added successfully!', 'success');
    }
    
    document.getElementById('vehicle-modal').style.display = 'none';
    loadDashboard();
    
  } catch (error) {
    console.error('Error saving vehicle:', error);
    showNotification('Failed to save vehicle', 'error');
  }
}

/* Additional Modal Functions */
function openWithdrawModal() {
  showNotification('Withdrawal functionality coming soon!', 'info');
}

function openEarningsModal() {
  showNotification('Earnings report functionality coming soon!', 'info');
}

function openMapView() {
  showNotification('Full map view coming soon!', 'info');
}

function openWalletModal() {
  showNotification('Wallet management coming soon!', 'info');
}

function openProfileModal() {
  showNotification('Profile management coming soon!', 'info');
}

function resetForms() {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.reset();
    form.removeAttribute('data-edit-id');
  });
}

/* Realtime Sync */
function subscribeRealtime() {
  supabase.channel('owner-updates')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'drivers' }, 
      payload => {
        if (payload.new?.owner_id === ownerId) {
          console.log('Driver update received:', payload);
          loadDashboard();
        }
      }
    )
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'vehicles' }, 
      payload => {
        if (payload.new?.owner_id === ownerId) {
          console.log('Vehicle update received:', payload);
          loadDashboard();
        }
      }
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      payload => {
        if (payload.new?.owner_id === ownerId) {
          console.log('Transaction update received:', payload);
          loadDashboard();
        }
      }
    )
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });
}

/* Utility Functions */
function capitalize(str) { 
  return str.charAt(0).toUpperCase() + str.slice(1); 
}

async function handleLogout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Error logging out:', error);
    showNotification('Error logging out', 'error');
  }
}

function showNotification(message, type = 'info') {
  // Remove existing notifications
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
window.editDriver = editDriver;
window.editVehicle = editVehicle;
window.deleteDriver = deleteDriver;
window.deleteVehicle = deleteVehicle;
