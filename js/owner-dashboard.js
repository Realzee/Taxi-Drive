// TaxiDrive Owner Dashboard - Full Integration with Supabase + Live Map
const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtneWl3b3d3ZHd4cnhzdXlkd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODUyMzUsImV4cCI6MjA3NDQ2MTIzNX0.CYWfAs4xaBf7WwJthiBGHw4iBtiY1wwYvghHcXQnVEc';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentOwner = null;
let currentOwnerId = null;
let currentAssociationId = null;
let map, fleetMarkers = {};

document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (location.href = 'index.html');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'owner') return (location.href = 'index.html');

  document.getElementById('user-name').textContent = `Welcome, ${user.email}`;
  currentUser = user;

  const { data: owner } = await supabase.from('owners').select('*').eq('admin_id', user.id).maybeSingle();
  if (owner) {
    currentOwner = owner;
    currentOwnerId = owner.id;
    currentAssociationId = owner.association_id;
  }

  await loadDrivers();
  await loadVehicles();
  await loadFinancials();

  initMap();
  listenRealtime();
}

// === LOADERS ===
async function loadDrivers() {
  const { data: drivers } = await supabase.from('drivers').select('*').eq('owner_id', currentOwnerId);
  const tbody = document.querySelector('#driver-table tbody');
  tbody.innerHTML = '';

  if (!drivers?.length) return (tbody.innerHTML = '<tr><td colspan="7">No drivers yet</td></tr>');

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
        <button onclick="editDriver('${d.id}')">✏️</button>
        <button onclick="deleteDriver('${d.id}')">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function loadVehicles() {
  const { data: vehicles } = await supabase.from('vehicles').select('*').eq('owner_id', currentOwnerId);
  const tbody = document.querySelector('#vehicle-table tbody');
  tbody.innerHTML = '';

  if (!vehicles?.length) return (tbody.innerHTML = '<tr><td colspan="4">No vehicles yet</td></tr>');

  document.getElementById('vehicles-count').textContent = vehicles.length;
  vehicles.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${v.model}</td>
      <td>${v.reg_no}</td>
      <td>${v.status}</td>
      <td>
        <button onclick="editVehicle('${v.id}')">✏️</button>
        <button onclick="deleteVehicle('${v.id}')">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });

  renderMapMarkers(vehicles);
}

async function loadFinancials() {
  const { data: txns } = await supabase.from('transactions').select('*').eq('owner_id', currentOwnerId);
  const total = txns?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const net = total - (0.5 * (txns?.length || 0));
  document.getElementById('earnings-balance').textContent = `R${total.toFixed(2)}`;
  document.getElementById('current-balance').textContent = `R${net.toFixed(2)}`;
}

// === MODALS ===
function openModal(type) {
  const modal = document.getElementById('modal');
  const content = document.getElementById('modal-content');
  modal.style.display = 'flex';

  content.innerHTML = type === 'driver' ? `
    <h3>Add Driver</h3>
    <input id="d-name" placeholder="Name">
    <input id="d-surname" placeholder="Surname">
    <input id="d-id" placeholder="ID Number">
    <input id="d-license" placeholder="License Type">
    <input type="date" id="d-license-exp">
    <select id="d-prdp">
      <option value="true">PrDP: Yes</option>
      <option value="false">PrDP: No</option>
    </select>
    <button onclick="saveDriver()">Save</button>
    <button onclick="closeModal()">Cancel</button>` : `
    <h3>Add Vehicle</h3>
    <input id="v-model" placeholder="Model">
    <input id="v-reg" placeholder="Registration No">
    <select id="v-status">
      <option value="Active">Active</option>
      <option value="Inactive">Inactive</option>
      <option value="Maintenance">Maintenance</option>
    </select>
    <button onclick="saveVehicle()">Save</button>
    <button onclick="closeModal()">Cancel</button>`;
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-content').innerHTML = '';
}

// === SAVE ===
async function saveDriver() {
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
  await supabase.from('drivers').insert([driver]);
  closeModal(); loadDrivers();
}

async function saveVehicle() {
  const vehicle = {
    owner_id: currentOwnerId,
    association_id: currentAssociationId,
    model: document.getElementById('v-model').value,
    reg_no: document.getElementById('v-reg').value,
    status: document.getElementById('v-status').value
  };
  await supabase.from('vehicles').insert([vehicle]);
  closeModal(); loadVehicles();
}

// === DELETE ===
async function deleteDriver(id) {
  await supabase.from('drivers').delete().eq('id', id);
  loadDrivers();
}

async function deleteVehicle(id) {
  await supabase.from('vehicles').delete().eq('id', id);
  loadVehicles();
}

// === MAP ===
function initMap() {
  map = L.map('fleet-map').setView([-28.214, 32.043], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
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

// === REALTIME UPDATES ===
function listenRealtime() {
  supabase.channel('realtime-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' },
      payload => { if (payload.new?.owner_id === currentOwnerId) loadVehicles(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' },
      payload => { if (payload.new?.owner_id === currentOwnerId) loadDrivers(); })
    .subscribe();
}

