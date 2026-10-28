/**
 * SINO GA Frontend App
 * Jika dijalankan via Google Apps Script (doGet), objek `google.script.run` tersedia.
 * Jika dijalankan via GitHub Pages, kita menggunakan `fetch` ke URL Apps Script.
 */

// ⚠️ MASUKKAN URL APPS SCRIPT ANDA DI SINI
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyM84uBmebFTGQEX7a4-8pqtj7l_20jNPWsIvXhP7wh96IvNtjlSxggJaUi4lXC71Y9RQ/exec";

// Deteksi apakah kita berjalan di dalam Google Apps Script atau di GitHub Pages
const isInsideAppsScript = typeof google !== 'undefined' && google.script && google.script.run;

// Jembatan komunikasi universal
async function callBackend(fn, ...args) {
  if (isInsideAppsScript) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(err => reject(err.message || err))
        [fn](...args);
    });
  } else {
    // Mode GitHub Pages Preview: Kirim request POST ke Apps Script
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
      throw new Error("Koneksi ke backend gagal. " + err.message);
    }
  }
}

function renderError(msg) {
  document.getElementById('content').innerHTML = `<div class="error"><b>Error:</b> ${msg}</div>`;
}

// --- HALAMAN DASHBOARD ---
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
      <div class="card">
        <h3>Selamat Datang di SINO GA System</h3>
        <p>Gunakan menu di sebelah kiri untuk mengakses modul.</p>
      </div>
    `;
  } catch (e) { renderError(e); }
}

// --- HALAMAN KENDARAAN ---
async function loadVehicles() {
  document.getElementById('pageTitle').textContent = 'Vehicle Management - Data Kendaraan';
  try {
    const list = await callBackend('listVehicles');
    let rows = list.map(v => `
      <tr>
        <td>${v.VehicleID}</td>
        <td>${v.NomorPolisi}</td>
        <td>${v.Merek} ${v.Model}</td>
        <td>${v.StatusOperasional}</td>
        <td>${v.KilometerTerakhir ? v.KilometerTerakhir + ' km' : '-'}</td>
        <td><button class="btn-danger" data-del="${v.VehicleID}">Hapus</button></td>
      </tr>
    `).join('');
    
    document.getElementById('content').innerHTML = `
      <div class="card">
        <h3 style="margin-top:0;">Tambah Kendaraan Baru</h3>
        <form id="vehicleForm">
          <div class="form-grid">
            <div class="form-row"><label>Nomor Polisi</label><input name="NomorPolisi" required></div>
            <div class="form-row"><label>Merek</label><input name="Merek" required></div>
            <div class="form-row"><label>Model</label><input name="Model" required></div>
            <div class="form-row"><label>Tahun</label><input name="Tahun" type="number"></div>
            <div class="form-row"><label>Kilometer Terakhir</label><input name="KilometerTerakhir" type="number"></div>
            <div class="form-row">
              <label>Status Operasional</label>
              <select name="StatusOperasional">
                <option>Aktif</option><option>Servis</option><option>Nonaktif</option>
              </select>
            </div>
            <div class="form-row" style="grid-column: span 2;">
              <label>Foto Kendaraan (Opsional, Max 5MB)</label>
              <input type="file" id="fileFoto" accept="image/*">
            </div>
          </div>
          <button class="btn-primary" type="submit" id="btnSimpan">Simpan Kendaraan</button>
        </form>
      </div>
      <div class="card">
        <h3 style="margin-top:0;">Daftar Kendaraan</h3>
        <table>
          <thead><tr><th>ID</th><th>Nopol</th><th>Merek/Model</th><th>Status</th><th>KM</th><th>Aksi</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">Belum ada data</td></tr>'}</tbody>
        </table>
      </div>
    `;
    
    // Handler Submit Form
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
        loadVehicles();
      } catch (err) { 
        alert(err); 
        btn.textContent = 'Simpan Kendaraan'; btn.disabled = false;
      }
    };
    
    // Handler Hapus
    document.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Yakin ingin menghapus kendaraan ini?')) return;
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
  // Load info user (jika didukung backend)
  callBackend('getCurrentUserEmailForUI')
    .then(u => {
      const badge = document.getElementById('userBadge');
      badge.textContent = u ? `${u.Email} (${u.Role})` : 'Guest';
    })
    .catch(() => {
      document.getElementById('userBadge').textContent = 'Preview Mode';
    });

  // Setup navigasi
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
