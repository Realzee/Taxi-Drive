const SUPABASE_URL = 'https://kgyiwowwdwxrxsuydwii.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let ownerId, associationId;
let map, vehicleMarkers = {};

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return (location.href = 'index.html');

  const { data: owner } = await supabase.from('owners').select('*').eq('admin_id', user.id).single();
  if (!owner) return (location.href = 'index.html');

  ownerId = owner.id;
  associationId = owner.association_id;

  initMap();
  initModals();
  loadDashboard();
  subscribeRealtime();
});

async function loadDashboard() {
  const { data: drivers } = await supabase.from('drivers').select('*').eq('owner_id', ownerId);
  const { data: vehicles } = await supabase.from('vehicles').select('*').eq('owner_id', ownerId);
  const { data: txns } = await supabase.from('transactions').select('*').eq('owner_id', ownerId);

  renderList('driver-list', drivers, 'driver');
  renderList('vehicle-list', vehicles, 'vehicle');

  document.getElementById('stat-drivers').textContent = drivers.length;
  document.getElementById('stat-vehicles').textContent = vehicles.length;

  const total = txns.reduce((s, t) => s + Number(t.amount), 0);
  const net = total - (0.5 * txns.length);
  document.getElementById('stat-earnings').textContent = `R${total.toFixed(2)}`;
  document.getElementById('stat-balance').textContent = `R${net.toFixed(2)}`;

  updateMap(vehicles);
}

function renderList(id, items, type) {
  const container = document.getElementById(id);
  if (!items.length) return container.innerHTML = `<div class="empty-state"><i class="fas fa-${type === 'driver' ? 'users' : 'car-side'}"></i><h3>No ${type}s Yet</h3></div>`;
  container.innerHTML = items.map(i => `
    <div class="list-item">
      <div><i class="fas fa-${type === 'driver' ? 'user' : 'car'}"></i>
      <h4>${i.name || i.model}</h4><p>${i.status || ''}</p></div>
      <div>
        <button class="btn btn-sm btn-secondary" onclick="edit${capitalize(type)}('${i.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="delete${capitalize(type)}('${i.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

/* Map */
function initMap() {
  map = L.map('fleet-map').setView([-28.1, 32.1], 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
}

function updateMap(vehicles) {
  vehicles.forEach(v => {
    if (!v.live_lat || !v.live_lng) return;
    const pos = [v.live_lat, v.live_lng];
    if (vehicleMarkers[v.id]) {
      vehicleMarkers[v.id].setLatLng(pos);
    } else {
      vehicleMarkers[v.id] = L.marker(pos).addTo(map).bindPopup(v.model);
    }
  });
}

/* CRUD */
async function editDriver(id) {
  const { data } = await supabase.from('drivers').select('*').eq('id', id).single();
  openDriverModal(data);
}
async function editVehicle(id) {
  const { data } = await supabase.from('vehicles').select('*').eq('id', id).single();
  openVehicleModal(data);
}

async function deleteDriver(id) {
  if (confirm('Delete this driver?')) {
    await supabase.from('drivers').delete().eq('id', id);
    loadDashboard();
  }
}
async function deleteVehicle(id) {
  if (confirm('Delete this vehicle?')) {
    await supabase.from('vehicles').delete().eq('id', id);
    loadDashboard();
  }
}

/* Modals */
function initModals() {
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(m => m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; }));
  document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => modals.forEach(m => m.style.display = 'none')));
  document.getElementById('add-driver-btn').onclick = () => openDriverModal();
  document.getElementById('add-vehicle-btn').onclick = () => openVehicleModal();

  document.getElementById('driver-form').onsubmit = saveDriver;
  document.getElementById('vehicle-form').onsubmit = saveVehicle;
}

function openDriverModal(d = null) {
  document.getElementById('driver-modal').style.display = 'flex';
  document.getElementById('driver-modal-title').textContent = d ? 'Edit Driver' : 'Add Driver';
  ['driver-id','driver-name','driver-surname','driver-idnum','driver-license','driver-license-exp','driver-prdp','driver-prdp-exp'].forEach(f => document.getElementById(f).value = '');
  if (d) {
    document.getElementById('driver-id').value = d.id;
    document.getElementById('driver-name').value = d.name;
    document.getElementById('driver-surname').value = d.surname;
    document.getElementById('driver-idnum').value = d.id_number;
    document.getElementById('driver-license').value = d.license_type;
    document.getElementById('driver-license-exp').value = d.license_expiry || '';
    document.getElementById('driver-prdp').value = d.prdp;
    document.getElementById('driver-prdp-exp').value = d.prdp_expiry || '';
  }
}

async function saveDriver(e) {
  e.preventDefault();
  const id = document.getElementById('driver-id').value;
  const data = {
    owner_id: ownerId,
    association_id: associationId,
    name: document.getElementById('driver-name').value,
    surname: document.getElementById('driver-surname').value,
    id_number: document.getElementById('driver-idnum').value,
    license_type: document.getElementById('driver-license').value,
    license_expiry: document.getElementById('driver-license-exp').value,
    prdp: document.getElementById('driver-prdp').value === 'true',
    prdp_expiry: document.getElementById('driver-prdp-exp').value
  };
  if (id) await supabase.from('drivers').update(data).eq('id', id);
  else await supabase.from('drivers').insert([data]);
  document.getElementById('driver-modal').style.display = 'none';
  loadDashboard();
}

function openVehicleModal(v = null) {
  document.getElementById('vehicle-modal').style.display = 'flex';
  document.getElementById('vehicle-modal-title').textContent = v ? 'Edit Vehicle' : 'Add Vehicle';
  ['vehicle-id','vehicle-model','vehicle-reg','vehicle-status'].forEach(f => document.getElementById(f).value = '');
  if (v) {
    document.getElementById('vehicle-id').value = v.id;
    document.getElementById('vehicle-model').value = v.model;
    document.getElementById('vehicle-reg').value = v.reg_no;
    document.getElementById('vehicle-status').value = v.status;
  }
}

async function saveVehicle(e) {
  e.preventDefault();
  const id = document.getElementById('vehicle-id').value;
  const data = {
    owner_id: ownerId,
    association_id: associationId,
    model: document.getElementById('vehicle-model').value,
    reg_no: document.getElementById('vehicle-reg').value,
    status: document.getElementById('vehicle-status').value
  };
  if (id) await supabase.from('vehicles').update(data).eq('id', id);
  else await supabase.from('vehicles').insert([data]);
  document.getElementById('vehicle-modal').style.display = 'none';
  loadDashboard();
}

/* Realtime Sync */
function subscribeRealtime() {
  supabase.channel('owner-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, payload => {
      if (payload.new?.owner_id === ownerId) loadDashboard();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, payload => {
      if (payload.new?.owner_id === ownerId) loadDashboard();
    })
    .subscribe();
}

function capitalize(str){ return str.charAt(0).toUpperCase()+str.slice(1); }
