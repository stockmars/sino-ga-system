// Konfigurasi URL Apps Script Anda
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyM84uBmebFTGQEX7a4-8pqtj7l_20jNPWsIvXhP7wh96IvNtjlSxggJaUi4lXC71Y9RQ/exec";
const isInsideAppsScript = typeof google !== 'undefined' && google.script && google.script.run;

// Jembatan Komunikasi Universal
async function callBackend(fn, ...args) {
  if (isInsideAppsScript) {
    return new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(err => reject(err.message || err))[fn](...args);
    });
  } else {
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ functionName: fn, args: args })
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      return result.data;
    } catch (err) {
      throw new Error("Koneksi backend gagal. " + err.message);
    }
  }
}

function renderError(msg) {
  document.getElementById('content').innerHTML = `<div class="error"><b>Error:</b> ${msg}</div>`;
}

// --- DASHBOARD ---
async function loadDashboard() {
  document.getElementById('pageTitle').textContent = 'Dashboard';
  document.getElementById('content').innerHTML = '<div class="loader">Menghitung data aktual...</div>';
  try {
    const data = await callBackend('getDashboardData');
    document.getElementById('content').innerHTML = `
      <div class="cards-grid">
        <div class="card"><div class="stat-value">${data.totalVehicles || 0}</div><div class="stat-label">Total Kendaraan</div></div>
        <div class="card"><div class="stat-value">${data.activeVehicles || 0}</div><div class="stat-label">Kendaraan Aktif</div></div>
        <div class="card"><div class="stat-value">${data.inService || 0}</div><div class="stat-label">Sedang Servis</div></div>
        <div class="card"><div class="stat-value">${data.totalAssets || 0}</div><div class="stat-label">Total Aset</div></div>
      </div>
    `;
  } catch (e) { renderError(e); }
}

// --- VEHICLE MANAGEMENT ---
async function loadVehicles() {
  document.getElementById('pageTitle').textContent = 'Vehicle Management - Data Kendaraan';
  document.getElementById('content').innerHTML = '<div class="loader">Memuat data kendaraan...</div>';
  
  try {
    const list = await callBackend('listVehicles');
    
    let rows = list.map(v => `
      <tr>
        <td>${v.VehicleID}</td>
        <td>${v.NomorPolisi}</td>
        <td>${v.Merek} ${v.Model}</td>
        <td>${v.StatusOperasional}</td>
        <td>${v.KilometerTerakhir ? v.KilometerTerakhir + ' km' : '-'}</td>
        <td>${v.FotoURL ? `<a href="${v.FotoURL}" target="_blank">Lihat</a>` : '-'}</td>
        <td><button class="btn-danger" data-del="${v.VehicleID}">Hapus</button></td>
      </tr>
    `).join('');
    
    document.getElementById('content').innerHTML = `
      <div class="card">
        <h3>Tambah Kendaraan Baru</h3>
        <form id="vehicleForm">
          <div class="form-grid">
            <div class="form-row"><label>Nomor Polisi</label><input name="NomorPolisi" placeholder="B 1234 XYZ" required></div>
            <div class="form-row"><label>Merek</label><input name="Merek" placeholder="Toyota" required></div>
            <div class="form-row"><label>Model</label><input name="Model" placeholder="Avanza" required></div>
            <div class="form-row"><label>Tahun</label><input name="Tahun" type="number" placeholder="2023"></div>
            <div class="form-row"><label>Kilometer</label><input name="KilometerTerakhir" type="number" placeholder="15000"></div>
            <div class="form-row">
              <label>Status</label>
              <select name="StatusOperasional">
                <option value="Aktif">Aktif</option>
                <option value="Servis">Servis</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>
            <div class="form-row" style="grid-column: span 2;">
              <label>Foto (Maks 5MB)</label>
              <input type="file" id="fileFoto" accept="image/*">
            </div>
          </div>
          <button class="btn-primary" type="submit" id="btnSimpan">Simpan</button>
        </form>
      </div>
      <div class="card">
        <h3>Daftar Kendaraan</h3>
        <table>
          <thead><tr><th>ID</th><th>Nopol</th><th>Merek/Model</th><th>Status</th><th>KM</th><th>Foto</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" style="text-align:center;">Belum ada data</td></tr>'}</tbody>
        </table>
      </div>
    `;
    
    document.getElementById('vehicleForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSimpan');
      btn.textContent = 'Menyimpan...'; btn.disabled = true;
      
      try {
        const payload = Object.fromEntries(new FormData(e.target).entries());
        const fileInput = document.getElementById('fileFoto');
        
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          if (file.size > 5 * 1024 * 1024) throw new Error('File terlalu besar (Max 5MB)');
          
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
          });
          
          payload.fileData = base64;
          payload.fileName = file.name;
          payload.fileType = file.type;
        }

        await callBackend('saveVehicle', payload);
        alert('Data berhasil disimpan!');
        loadVehicles();
      } catch (err) { 
        alert("Gagal: " + err); 
        btn.textContent = 'Simpan'; btn.disabled = false;
      }
    };
    
    document.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Hapus kendaraan ini?')) return;
        await callBackend('deleteVehicle', btn.dataset.del);
        loadVehicles();
      };
    });
  } catch (e) { renderError(e); }
}

// --- PLACEHOLDER & ROUTER ---
function loadPlaceholder(title) {
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('content').innerHTML = `
    <div class="card" style="text-align:center; padding: 60px 20px;">
      <i class="fa-solid fa-person-digging" style="font-size: 40px; color: #ccc; margin-bottom: 20px;"></i>
      <h2 style="color: var(--text-muted); margin:0;">Modul ${title}</h2>
      <p style="color: #999;">Modul ini sedang dalam tahap pengembangan.</p>
    </div>
  `;
}

function showPage(page, title) {
  if (page === 'dashboard') loadDashboard();
  else if (page === 'vehicles') loadVehicles();
  else loadPlaceholder(title);
}

// --- INIT ---
function init() {
  callBackend('getCurrentUserEmailForUI')
    .then(u => {
      document.getElementById('userBadge').textContent = u ? `${u.Email} (${u.Role})` : 'Guest';
    })
    .catch(() => {
      document.getElementById('userBadge').textContent = 'Preview Mode';
    });

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav a').forEach(el => el.classList.remove('active'));
      link.classList.add('active');
      showPage(link.dataset.page, link.innerText.trim());
    });
  });
  showPage('dashboard', 'Dashboard');
}
window.onload = init;
