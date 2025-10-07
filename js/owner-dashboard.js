// TaxiDrive Owner Dashboard - Full Integration with Supabase + Live Map
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentOwner = null;
let currentOwnerId = null;
let currentAssociationId = null;
let map, fleetMarkers = {};

document.addEventListener('DOMContentLoaded', initializeDashboard);

async function initializeDashboard() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('No authenticated user, redirecting to login. Error:', authError?.message || 'No user found');
      window.location.href = 'index.html';
      return;
    }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || !profile || profile.role !== 'owner') {
      console.log(`Role mismatch or error. Expected: owner, Got: ${profile?.role}`);
      window.location.href = 'index.html';
      return;
    }

    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
      userNameElement.textContent = `Welcome, ${user.email}`;
    } else {
      console.warn('Element with id="user-name" not found');
    }
    currentUser = user;

    const { data: owner, error: ownerError } = await supabase.from('owners').select('*').eq('admin_id', user.id).maybeSingle();
    if (ownerError) {
      console.error('Error fetching owner:', ownerError);
      showNotification('Failed to load owner data.', 'error');
      return;
    }
    if (owner) {
      currentOwner = owner;
      currentOwnerId = owner.id;
      currentAssociationId = owner.association_id;
    }

    await loadDrivers();
    await loadVehicles();
    await loadFinancials();

    setupEventListeners();
    listenRealtime();
    showNotification('Dashboard loaded successfully!', 'success');
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    showNotification('Failed to initialize dashboard. Please try refreshing.', 'error');
  }
}

// === LOADERS ===
async function loadDrivers() {
  try {
    const { data: drivers, error } = await supabase.from('drivers').select('*').eq('owner_id', currentOwnerId);
    if (error) throw error;

    const tbody = document.querySelector('#driver-table tbody');
    tbody.innerHTML = '';

    if (!drivers?.length) {
      tbody.innerHTML = '<tr><td colspan="7">No drivers yet</td></tr>';
      return;
    }

    document.getElementById('drivers-count').textContent = drivers.length;
    drivers.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.name} ${d.surname}</td>
        <td>${d.id_number}</td>
        <td>${d.license_type}</td>
        <td>${d.license_expiry || '-'}</td>
        <td>${d.prdp ? 'Yes' : 'No'}</td>
        <td>${d.is_on_duty ? '🟢 On Duty' : '⚪ Off Duty'}</td>
        <td>
          <button class="btn btn-sm" onclick="editDriver('${d.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteDriver('${d.id}')">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error loading drivers:', error);
    showNotification('Failed to load drivers.', 'error');
  }
}

async function loadVehicles() {
  try {
    const { data: vehicles, error } = await supabase.from('vehicles').select('*').eq('owner_id', currentOwnerId);
    if (error) throw error;

    const tbody = document.querySelector('#vehicle-table tbody');
    tbody.innerHTML = '';

    if (!vehicles?.length) {
      tbody.innerHTML = '<tr><td colspan="4">No vehicles yet</td></tr>';
      return;
    }

    document.getElementById('vehicles-count').textContent = vehicles.length;
    vehicles.forEach(v => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${v.model}</td>
        <td>${v.reg_no}</td>
        <td>${v.status}</td>
        <td>
          <button class="btn btn-sm" onclick="editVehicle('${v.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteVehicle('${v.id}')">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });

    renderMapMarkers(vehicles);
  } catch (error) {
    console.error('Error loading vehicles:', error);
    showNotification('Failed to load vehicles.', 'error');
  }
}

async function loadFinancials() {
  try {
    const { data: txns, error } = await supabase.from('transactions').select('*').eq('owner_id', currentOwnerId);
    if (error) throw error;

    const total = txns?.reduce((sum, t) => sum + t.amount, 0) || 0;
    const net = total - (0.5 * (txns?.length || 0));
    document.getElementById('earnings-balance').textContent = `R${total.toFixed(2)}`;
    document.getElementById('current-balance').textContent = `R${net.toFixed(2)}`;
  } catch (error) {
    console.error('Error loading financials:', error);
    showNotification('Failed to load financial data.', 'error');
  }
}

// === MODALS ===
function openModal(type) {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modal-content');
  modal.style.display = 'flex';

  content.innerHTML = type === 'driver' ? `
    <div class="modal-header">
      <h3>Add Driver</h3>
      <button class="modal-close" onclick="closeModal('modal')">&times;</button>
    </div>
    <form id="add-driver-form">
      <div class="form-group">
        <label for="d-name">Name</label>
        <input id="d-name" class="form-input" placeholder="Name" required>
      </div>
      <div class="form-group">
        <label for="d-surname">Surname</label>
        <input id="d-surname" class="form-input" placeholder="Surname" required>
      </div>
      <div class="form-group">
        <label for="d-id">ID Number</label>
        <input id="d-id" class="form-input" placeholder="ID Number" required>
      </div>
      <div class="form-group">
        <label for="d-license">License Type</label>
        <input id="d-license" class="form-input" placeholder="License Type" required>
      </div>
      <div class="form-group">
        <label for="d-license-exp">License Expiry</label>
        <input type="date" id="d-license-exp" class="form-input">
      </div>
      <div class="form-group">
        <label for="d-prdp">PrDP</label>
        <select id="d-prdp" class="form-input">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" class="btn btn-cancel" onclick="closeModal('modal')">Cancel</button>
      </div>
    </form>` : `
    <div class="modal-header">
      <h3>Add Vehicle</h3>
      <button class="modal-close" onclick="closeModal('modal')">&times;</button>
    </div>
    <form id="add-vehicle-form">
      <div class="form-group">
        <label for="v-model">Model</label>
        <input id="v-model" class="form-input" placeholder="Model" required>
      </div>
      <div class="form-group">
        <label for="v-reg">Registration No</label>
        <input id="v-reg" class="form-input" placeholder="Registration No" required>
      </div>
      <div class="form-group">
        <label for="v-status">Status</label>
        <select id="v-status" class="form-input">
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Maintenance">Maintenance</option>
        </select>
      </div>
      <div class="modal-footer">
        <button type="submit" class="btn btn-primary">Save</button>
        <button type="button" class="btn btn-cancel" onclick="closeModal('modal')">Cancel</button>
      </div>
    </form>`;

  const form = content.querySelector('form');
  if (form) {
    form.addEventListener('submit', type === 'driver' ? saveDriver : saveVehicle);
  }
}

function showModal(modalId) {
  console.log(`Showing modal: ${modalId}`);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } else {
    console.error(`Modal ${modalId} not found`);
  }
}

function closeModal(modalId) {
  console.log(`Closing modal: ${modalId}`);
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

function closeMapModal() {
  closeModal('map-modal');
  if (map) {
    map.invalidateSize();
  }
}

// === SAVE ===
async function saveDriver(e) {
  e.preventDefault();
  try {
    const driver = {
      owner_id: currentOwnerId,
      association_id: currentAssociationId,
      name: document.getElementById('d-name').value,
      surname: document.getElementById('d-surname').value,
      id_number: document.getElementById('d-id').value,
      license_type: document.getElementById('d-license').value,
      license_expiry: document.getElementById('d-license-exp').value,
      prdp: document.getElementById('d-prdp').value === 'true',
      is_on_duty: false
    };
    const { error } = await supabase.from('drivers').insert([driver]);
    if (error) throw error;
    showNotification('Driver added successfully!', 'success');
    closeModal('modal');
    loadDrivers();
  } catch (error) {
    console.error('Error saving driver:', error);
    showNotification('Failed to save driver.', 'error');
  }
}

async function saveVehicle(e) {
  e.preventDefault();
  try {
    const vehicle = {
      owner_id: currentOwnerId,
      association_id: currentAssociationId,
      model: document.getElementById('v-model').value,
      reg_no: document.getElementById('v-reg').value,
      status: document.getElementById('v-status').value
    };
    const { error } = await supabase.from('vehicles').insert([vehicle]);
    if (error) throw error;
    showNotification('Vehicle added successfully!', 'success');
    closeModal('modal');
    loadVehicles();
  } catch (error) {
    console.error('Error saving vehicle:', error);
    showNotification('Failed to save vehicle.', 'error');
  }
}

// === DELETE ===
async function deleteDriver(id) {
  try {
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) throw error;
    showNotification('Driver deleted successfully!', 'success');
    loadDrivers();
  } catch (error) {
    console.error('Error deleting driver:', error);
    showNotification('Failed to delete driver.', 'error');
  }
}

async function deleteVehicle(id) {
  try {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;
    showNotification('Vehicle deleted successfully!', 'success');
    loadVehicles();
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    showNotification('Failed to delete vehicle.', 'error');
  }
}

// === EDIT ===
async function editDriver(id) {
  try {
    const { data: driver, error } = await supabase.from('drivers').select('*').eq('id', id).single();
    if (error) throw error;
    if (!driver) return;

    openModal('driver');
    const form = document.getElementById('add-driver-form');
    document.querySelector('#modal .modal-header h3').textContent = 'Edit Driver';
    document.getElementById('d-name').value = driver.name;
    document.getElementById('d-surname').value = driver.surname;
    document.getElementById('d-id').value = driver.id_number;
    document.getElementById('d-license').value = driver.license_type;
    document.getElementById('d-license-exp').value = driver.license_expiry || '';
    document.getElementById('d-prdp').value = driver.prdp ? 'true' : 'false';

    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const updatedDriver = {
          name: document.getElementById('d-name').value,
          surname: document.getElementById('d-surname').value,
          id_number: document.getElementById('d-id').value,
          license_type: document.getElementById('d-license').value,
          license_expiry: document.getElementById('d-license-exp').value,
          prdp: document.getElementById('d-prdp').value === 'true'
        };
        const { error } = await supabase.from('drivers').update(updatedDriver).eq('id', id);
        if (error) throw error;
        showNotification('Driver updated successfully!', 'success');
        closeModal('modal');
        loadDrivers();
      } catch (error) {
        console.error('Error updating driver:', error);
        showNotification('Failed to update driver.', 'error');
      }
    };
  } catch (error) {
    console.error('Error fetching driver:', error);
    showNotification('Failed to load driver data.', 'error');
  }
}

async function editVehicle(id) {
  try {
    const { data: vehicle, error } = await supabase.from('vehicles').select('*').eq('id', id).single();
    if (error) throw error;
    if (!vehicle) return;

    openModal('vehicle');
    const form = document.getElementById('add-vehicle-form');
    document.querySelector('#modal .modal-header h3').textContent = 'Edit Vehicle';
    document.getElementById('v-model').value = vehicle.model;
    document.getElementById('v-reg').value = vehicle.reg_no;
    document.getElementById('v-status').value = vehicle.status;

    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const updatedVehicle = {
          model: document.getElementById('v-model').value,
          reg_no: document.getElementById('v-reg').value,
          status: document.getElementById('v-status').value
        };
        const { error } = await supabase.from('vehicles').update(updatedVehicle).eq('id', id);
        if (error) throw error;
        showNotification('Vehicle updated successfully!', 'success');
        closeModal('modal');
        loadVehicles();
      } catch (error) {
        console.error('Error updating vehicle:', error);
        showNotification('Failed to update vehicle.', 'error');
      }
    };
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    showNotification('Failed to load vehicle data.', 'error');
  }
}

// === MAP ===
function initMap() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) {
    console.error('Map container not found');
    return;
  }

  map = L.map('map').setView([-28.214, 32.043], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 100);
}

function renderMapMarkers(vehicles) {
  Object.values(fleetMarkers).forEach(m => map.removeLayer(m));
  fleetMarkers = {};
  vehicles.forEach(v => {
    if (v.live_lat && v.live_lng) {
      const marker = L.marker([v.live_lat, v.live_lng])
        .addTo(map)
        .bindPopup(`<b>${v.model}</b><br>${v.reg_no}<br>${v.status}`);
      fleetMarkers[v.id] = marker;
    }
  });
}

function openMapModal() {
  showModal('map-modal');
  if (!map) {
    initMap();
  } else {
    map.invalidateSize();
  }
}

// === REALTIME UPDATES ===
function listenRealtime() {
  supabase.channel('realtime-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' },
      payload => { if (payload.new?.owner_id === currentOwnerId) loadVehicles(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' },
      payload => { if (payload.new?.owner_id === currentOwnerId) loadDrivers(); })
    .subscribe();
}

// === PROFILE ===
function openProfileModal() {
  showModal('profile-modal');
  const form = document.getElementById('profile-form');
  document.getElementById('owner-name').value = currentUser?.user_metadata?.name || currentUser.email.split('@')[0];
  document.getElementById('owner-email').value = currentUser.email;

  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const name = document.getElementById('owner-name').value;
      const { error } = await supabase.auth.updateUser({
        data: { name }
      });
      if (error) throw error;
      showNotification('Profile updated successfully!', 'success');
      closeModal('profile-modal');
      const userNameElement = document.getElementById('user-name');
      if (userNameElement) {
        userNameElement.textContent = `Welcome, ${name || currentUser.email}`;
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showNotification('Failed to update profile.', 'error');
    }
  };
}

// === WALLET ===
function openWalletModal() {
  showModal('modal');
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div class="modal-header">
      <h3>Wallet</h3>
      <button class="modal-close" onclick="closeModal('modal')">&times;</button>
    </div>
    <div class="form-group">
      <label>Current Balance</label>
      <p id="modal-current-balance">R${document.getElementById('current-balance').textContent}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-cancel" onclick="closeModal('modal')">Close</button>
    </div>`;
}

// === UTILITIES ===
function showNotification(message, type = 'info') {
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

  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });

  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

async function handleLogout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Error logging out:', error);
    showNotification('Error logging out. Please try again.', 'error');
  }
}

function setupEventListeners() {
  // Add any additional event listeners if needed
}

// Make functions globally available
window.editDriver = editDriver;
window.deleteDriver = deleteDriver;
window.editVehicle = editVehicle;
window.deleteVehicle = deleteVehicle;
window.closeModal = closeModal;
window.openMapModal = openMapModal;
window.openProfileModal = openProfileModal;
window.openWalletModal = openWalletModal;
window.handleLogout = handleLogout;
