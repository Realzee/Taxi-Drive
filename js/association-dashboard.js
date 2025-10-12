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
let currentAssociation = null;
let currentAssociationId = null;
let mapInstance = null;
let userLocationMarker = null;
let userAccuracyCircle = null;
let userLocationWatcher = null;
let authListenerRegistered = false;
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initializeSupabase();
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
      .select('role, name')
      .eq('id', user.id)
      .single();
    if (profileError || !profile || profile.role !== 'association') {
      console.error('Profile error or not association:', profileError);
      showNotification('Access denied. You are not an association.', 'error');
      window.location.href = 'index.html';
      return;
    }
    currentUser = { ...user, ...profile };
    await loadAssociationData(user.id);
    initializeMap();
    setupEventListeners();
    loadStats();
    loadRecentMembers();
    loadRecentRoutes();
    loadAlerts();
    loadWallet();
    listenToRealtimeUpdates();
    if (!authListenerRegistered) {
      authListenerRegistered = true;
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed in association dashboard:', { event, userId: session?.user?.id });
        if (event === 'SIGNED_OUT') {
          showNotification('Session expired. Redirecting to login.', 'warning');
          window.location.href = 'index.html';
        }
      });
    }
  } catch (error) {
    console.error('Error initializing dashboard:', error);
    showNotification('Failed to initialize dashboard.', 'error');
  }
}
async function loadAssociationData(userId) {
  try {
    const { data, error } = await supabase
      .from('associations')
      .select('id, association_name, email, phone, address, description, admin_name, admin_phone, logo_url, wallet_balance')
      .eq('id', userId)
      .single();
    if (error || !data) {
      console.error('Error fetching association:', error);
      showNotification('No association found. Please contact support.', 'error');
      return;
    }
    currentAssociation = data;
    currentAssociationId = data.id;
    updateAssociationProfileUI(data);
  } catch (error) {
    console.error('Error in loadAssociationData:', error);
    showNotification('Failed to load association data.', 'error');
  }
}
function updateAssociationProfileUI(associationData) {
  const fields = {
    'profile-association-name': associationData.association_name || '',
    'profile-association-email': associationData.email || '',
    'profile-association-phone': associationData.phone || '',
    'profile-association-address': associationData.address || '',
    'profile-association-description': associationData.description || '',
    'profile-admin-name': associationData.admin_name || '',
    'profile-admin-phone': associationData.admin_phone || ''
  };
  Object.keys(fields).forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = fields[id];
  });
  const walletBalanceElement = document.getElementById('wallet-balance');
  if (walletBalanceElement) {
    walletBalanceElement.textContent = `R ${(associationData.wallet_balance || 0).toFixed(2)}`;
  }
  const logo = document.getElementById('edit-logo-preview-img');
  if (logo && associationData.logo_url) {
    logo.src = associationData.logo_url;
    logo.style.display = 'block';
    document.getElementById('edit-logo-preview-container').style.display = 'block';
  }
}
async function loadStats() {
  if (!supabase) return;
  try {
    const { data: vehicles } = await supabase.from('vehicles').select('id').eq('association_id', currentAssociationId);
    document.getElementById('stat-vehicles').textContent = vehicles?.length || 0;
    const { data: members } = await supabase.from('members').select('id').eq('association_id', currentAssociationId);
    document.getElementById('stat-members').textContent = members?.length || 0;
    const { data: routes } = await supabase.from('routes').select('id').eq('association_id', currentAssociationId);
    document.getElementById('stat-routes').textContent = routes?.length || 0;
    const { data: alarms } = await supabase.from('alarms').select('id').eq('association_id', currentAssociationId);
    document.getElementById('stat-alarms').textContent = alarms?.length || 0;
  } catch (error) {
    console.error('Error loading stats:', error);
    showNotification('Failed to load stats.', 'error');
  }
}
async function loadRecentMembers() {
  if (!supabase) return;
  try {
    const { data: members } = await supabase
      .from('members')
      .select('id, name, role')
      .eq('association_id', currentAssociationId)
      .limit(5)
      .order('created_at', { ascending: false });
    const content = document.getElementById('recent-members-content');
    if (!content) return;
    content.innerHTML = members?.length
      ? members.map(m => `<div class="list-item">${m.name} (${m.role})</div>`).join('')
      : '<div class="empty-state"><i class="fas fa-users"></i><h3>No Members Yet</h3><p>Add owners or drivers to your association.</p></div>';
  } catch (error) {
    console.error('Error loading members:', error);
    showNotification('Failed to load members.', 'error');
  }
}
async function loadRecentRoutes() {
  if (!supabase) return;
  try {
    const { data: routes } = await supabase
      .from('routes')
      .select('id, name')
      .eq('association_id', currentAssociationId)
      .limit(5)
      .order('created_at', { ascending: false });
    const content = document.getElementById('recent-routes-content');
    if (!content) return;
    content.innerHTML = routes?.length
      ? routes.map(r => `<div class="list-item">${r.name}</div>`).join('')
      : '<div class="empty-state"><i class="fas fa-route"></i><h3>No Routes Yet</h3><p>Add routes to your association.</p></div>';
  } catch (error) {
    console.error('Error loading routes:', error);
    showNotification('Failed to load routes.', 'error');
  }
}
async function loadAlerts() {
  if (!supabase) return;
  try {
    const { data: alerts } = await supabase
      .from('alarms')
      .select('id, message')
      .eq('association_id', currentAssociationId)
      .limit(5);
    const content = document.getElementById('alerts-modal-content');
    if (!content) return;
    content.innerHTML = alerts?.length
      ? alerts.map(a => `<div class="list-item">${a.message}</div>`).join('')
      : '<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>No Active Alerts</h3><p>All clear!</p></div>';
  } catch (error) {
    console.error('Error loading alerts:', error);
    showNotification('Failed to load alerts.', 'error');
  }
}
async function loadWallet() {
  if (!supabase) return;
  try {
    const { data: wallet } = await supabase
      .from('associations')
      .select('wallet_balance')
      .eq('id', currentAssociationId)
      .single();
    const balanceElement = document.getElementById('wallet-balance');
    if (balanceElement) {
      balanceElement.textContent = `R ${(wallet?.wallet_balance || 0).toFixed(2)}`;
    }
  } catch (error) {
    console.error('Error loading wallet:', error);
    showNotification('Failed to load wallet balance.', 'error');
  }
}
function initializeMap() {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;
  mapInstance = L.map('map').setView([-28.214, 32.043], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);
}
function openMapModal() {
  showModal('map-modal');
  setTimeout(() => {
    if (mapInstance) {
      mapInstance.invalidateSize();
      centerOnUserLocation();
    } else {
      initializeMap();
    }
  }, 200);
}
function closeMapModal() {
  closeModal('map-modal');
  if (userLocationWatcher) {
    navigator.geolocation.clearWatch(userLocationWatcher);
    userLocationWatcher = null;
  }
}
function centerOnUserLocation() {
  if (!navigator.geolocation) {
    showNotification('Geolocation not supported by your browser.', 'error');
    return;
  }
  if (!userLocationWatcher) {
    userLocationWatcher = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        mapInstance.setView([latitude, longitude], 13);
        if (userLocationMarker) {
          userLocationMarker.setLatLng([latitude, longitude]);
        } else {
          userLocationMarker = L.marker([latitude, longitude])
            .addTo(mapInstance)
            .bindPopup('Your Location');
        }
        if (userAccuracyCircle) {
          userAccuracyCircle.setLatLng([latitude, longitude]).setRadius(accuracy);
        } else {
          userAccuracyCircle = L.circle([latitude, longitude], { radius: accuracy })
            .addTo(mapInstance);
        }
      },
      error => {
        console.error('Geolocation error:', error);
        showNotification('Unable to access location.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
}
function setupEventListeners() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  const addMemberForm = document.getElementById('add-member-form');
  if (addMemberForm) {
    addMemberForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!addMemberForm.checkValidity()) {
        showNotification('Please fill all required fields.', 'error');
        return;
      }
    });
  }
}
function listenToRealtimeUpdates() {
  if (!supabase || !currentAssociationId) {
    console.warn('Cannot set up realtime: supabase or currentAssociationId is null');
    return;
  }
  try {
    supabase.channel('association-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'members',
        filter: `association_id=eq.${currentAssociationId}`
      }, () => loadRecentMembers())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'routes',
        filter: `association_id=eq.${currentAssociationId}`
      }, () => loadRecentRoutes())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'alarms',
        filter: `association_id=eq.${currentAssociationId}`
      }, () => loadAlerts())
      .subscribe((status) => {
        console.log('Realtime status:', status);
      }, (error) => {
        console.error('Realtime subscription error:', error);
        showNotification('Realtime updates failed. Refresh page.', 'error');
      });
  } catch (error) {
    console.error('Realtime setup error:', error);
  }
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
window.closeModal = closeModal;
window.openMapModal = openMapModal;
window.handleLogout = handleLogout;
