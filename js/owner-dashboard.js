const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
let supabase = null;
async function initializeSupabase() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 5;
    const checkSupabase = () => {
      if (window.supabase?.createClient) {
        try {
          supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          console.log('Supabase client initialized');
          resolve();
        } catch (error) {
          console.error('Supabase init failed:', error);
          showNotification('Failed to connect to backend. Please check your network.', 'error');
          reject(error);
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        console.log(`Waiting for Supabase library to load... Attempt ${attempts}`);
        setTimeout(checkSupabase, 500);
      } else {
        console.error('Supabase library failed to load after max attempts');
        showNotification('Failed to load backend services. Please refresh the page.', 'error');
        reject(new Error('Supabase library not loaded'));
      }
    };
    checkSupabase();
  });
}
let currentUser = null;
let currentOwner = null;
let currentOwnerId = null;
let currentAssociationId = null;
let map = null;
let fleetMarkers = {};
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initializeSupabase();
    initMap();
    const logos = document.querySelectorAll('.association-logo, #main-logo');
    logos.forEach(logo => {
      logo.onerror = () => { logo.src = './assets/placeholder-logo.png'; };
    });
    initializeDashboard();
  } catch (error) {
    console.error('Error during initialization:', error);
    showNotification('Failed to initialize application.', 'error');
  }
});
async function initializeDashboard() {
  if (!supabase) {
    showNotification('Backend services not loaded. Please try again.', 'error');
    return;
  }
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      showNotification('No authenticated user. Redirecting to login.', 'error');
      window.location.href = 'index.html';
      return;
    }
    console.log('Authenticated user:', user.id, user.email);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile || profile.role !== 'owner') {
      console.error('Profile error or not owner:', profileError);
      showNotification('Access denied. You are not an owner.', 'error');
      window.location.href = 'index.html';
      return;
    }
    currentUser = user;
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) userNameElement.textContent = `Welcome, ${user.email}`;
    const { data: owner, error: ownerError } = await supabase
      .from('members')
      .select('*')
      .eq('auth_id', user.id)
      .eq('role', 'owner')
      .maybeSingle();
    if (ownerError) {
      console.error('Error fetching owner:', ownerError);
      showNotification('Failed to load owner data.', 'error');
      return;
    }
    if (!owner) {
      console.error('No owner record found for user:', user.id);
      showNotification('No owner profile found or account not verified.', 'error');
      if (userNameElement) userNameElement.textContent = `Welcome (Pending) - ${user.email}`;
      return;
    }
    if (!owner.is_verified) {
      console.warn('Owner not verified:', owner.id);
      showNotification('Account pending verification. Limited access.', 'warning');
    }
    currentOwner = owner;
    currentOwnerId = owner.id;
    currentAssociationId = owner.association_id;
    console.log('Owner data:', { id: currentOwnerId, association_id: currentAssociationId, is_verified: owner.is_verified });
    const verificationElement = document.getElementById('verification-status');
    if (verificationElement) {
      verificationElement.style.display = 'block';
      verificationElement.innerHTML = owner.is_verified
        ? '<span class="status-verified">✓ Verified Owner</span>'
        : '<span class="status-pending">⏳ Pending Verification</span>';
    }
    await loadDrivers();
    await loadVehicles();
    await loadFinancials();
    setupEventListeners();
    listenRealtime();
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    showNotification('Failed to initialize dashboard.', 'error');
  }
}
async function loadDrivers() {
  if (!supabase || !currentOwnerId) {
    console.warn('Cannot load drivers: supabase or currentOwnerId is null');
    showNotification('Unable to load drivers.', 'error');
    return;
  }
  try {
    const { data: drivers, error } = await supabase
      .from('members')
      .select('*')
      .eq('owner_id', currentOwnerId)
      .eq('role', 'driver');
    if (error) throw error;
    const tbody = document.querySelector('#driver-table tbody');
    if (!tbody) return;
    tbody.innerHTML = drivers?.length
      ? drivers.map(d => `
        <tr>
          <td>${d.name}</td>
          <td>${d.id_number || '-'}</td>
          <td>${d.license_type || '-'}</td>
          <td>${d.license_expiry || '-'}</td>
          <td>${d.prdp ? 'Yes' : 'No'}</td>
          <td>${d.is_on_duty ? '🟢 On Duty' : '⚪ Off Duty'}</td>
          <td>
            <button class="btn btn-sm" onclick="editDriver('${d.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteDriver('${d.id}')">🗑️</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="7">No drivers yet</td></tr>';
    document.getElementById('drivers-count').textContent = drivers?.length || 0;
  } catch (error) {
    console.error('Error loading drivers:', error);
    showNotification('Failed to load drivers.', 'error');
  }
}
async function loadVehicles() {
  if (!supabase || !currentOwnerId) {
    console.warn('Cannot load vehicles: supabase or currentOwnerId is null');
    showNotification('Unable to load vehicles.', 'error');
    renderMapMarkers([]);
    return;
  }
  try {
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('owner_id', currentOwnerId);
    if (error) throw error;
    const tbody = document.querySelector('#vehicle-table tbody');
    if (!tbody) return;
    tbody.innerHTML = vehicles?.length
      ? vehicles.map(v => `
        <tr>
          <td>${v.model}</td>
          <td>${v.reg_no}</td>
          <td>${v.status}</td>
          <td>
            <button class="btn btn-sm" onclick="editVehicle('${v.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteVehicle('${v.id}')">🗑️</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="4">No vehicles yet</td></tr>';
    document.getElementById('vehicles-count').textContent = vehicles?.length || 0;
    renderMapMarkers(vehicles);
  } catch (error) {
    console.error('Error loading vehicles:', error);
    showNotification('Failed to load vehicles.', 'error');
  }
}
async function loadFinancials() {
  if (!supabase) return;
  try {
    const { data: financials } = await supabase
      .from('financials')
      .select('balance, earnings')
      .eq('owner_id', currentOwnerId)
      .single();
    document.getElementById('earnings-balance').textContent = `R ${(financials?.earnings || 0).toFixed(2)}`;
    document.getElementById('current-balance').textContent = `R ${(financials?.balance || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Error loading financials:', error);
    showNotification('Failed to load financials.', 'error');
  }
}
function initMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;
  map = L.map('map').setView([-28.214, 32.043], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}
function renderMapMarkers(vehicles) {
  if (!map) return;
  Object.values(fleetMarkers).forEach(marker => marker.remove());
  fleetMarkers = {};
  vehicles?.forEach(vehicle => {
    if (vehicle.latitude && vehicle.longitude) {
      fleetMarkers[vehicle.id] = L.marker([vehicle.latitude, vehicle.longitude])
        .addTo(map)
        .bindPopup(`${vehicle.model} - ${vehicle.reg_no}`);
    }
  });
}
function openMapModal() {
  showModal('map-modal');
  setTimeout(() => {
    if (map) map.invalidateSize();
    loadVehicles();
  }, 100);
}
function listenRealtime() {
  if (!supabase || !currentOwnerId) {
    console.warn('Cannot set up realtime: supabase or currentOwnerId is null');
    showNotification('Realtime updates unavailable.', 'error');
    return;
  }
  try {
    supabase.channel('realtime-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vehicles',
        filter: `owner_id=eq.${currentOwnerId}`
      }, payload => {
        console.log('Vehicle update:', payload);
        loadVehicles();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'members',
        filter: `owner_id=eq.${currentOwnerId}`
      }, payload => {
        console.log('Driver update:', payload);
        loadDrivers();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'members',
        filter: `auth_id=eq.${currentUser.id}`
      }, payload => {
        console.log('Owner profile update:', payload);
        if (payload.new && payload.new.auth_id === currentUser.id) {
          currentOwner = payload.new;
          currentOwnerId = payload.new.id;
          currentAssociationId = payload.new.association_id;
          if (payload.new.is_verified && !payload.old?.is_verified) {
            showNotification('Your account has been verified!', 'success');
            window.location.reload();
          }
        }
      })
      .subscribe((status) => {
        console.log('Realtime status:', status);
      }, (error) => {
        console.error('Realtime subscription error:', error);
        showNotification('Realtime updates failed.', 'error');
      });
  } catch (error) {
    console.error('Realtime setup error:', error);
    showNotification('Failed to set up realtime updates.', 'error');
  }
}
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
}
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 1rem; border-radius: 8px; z-index: 5000; background: #fff; color: #052438;';
  notification.innerHTML = `<span>${message}</span>`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 5000);
}
async function handleLogout() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Failed to log out.', 'error');
  }
}
function setupEventListeners() {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  const addDriverForm = document.getElementById('add-driver-form');
  if (addDriverForm) {
    addDriverForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!addDriverForm.checkValidity()) {
        showNotification('Please fill all required fields.', 'error');
        return;
      }
    });
  }
  const addVehicleForm = document.getElementById('add-vehicle-form');
  if (addVehicleForm) {
    addVehicleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!addVehicleForm.checkValidity()) {
        showNotification('Please fill all required fields.', 'error');
        return;
      }
    });
  }
}
function editDriver(id) {
  console.log('Edit driver:', id);
  showModal('edit-driver-modal');
}
function deleteDriver(id) {
  console.log('Delete driver:', id);
}
function editVehicle(id) {
  console.log('Edit vehicle:', id);
  showModal('edit-vehicle-modal');
}
function deleteVehicle(id) {
  console.log('Delete vehicle:', id);
}
window.editDriver = editDriver;
window.deleteDriver = deleteDriver;
window.editVehicle = editVehicle;
window.deleteVehicle = deleteVehicle;
window.closeModal = closeModal;
window.openMapModal = openMapModal;
window.handleLogout = handleLogout;
