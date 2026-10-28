// Jembatan komunikasi ke Google Apps Script
function callBackend(fn, ...args) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(err => reject(err.message || err))
      [fn](...args);
  });
}

function renderError(msg) {
  document.getElementById('content').innerHTML = `<div class="error"><b>Error:</b> ${msg}</div>`;
}

// --- RENDER HALAMAN DASHBOARD ---
async function loadDashboard() {
  document.getElementById('pageTitle').textContent = 'Dashboard';
  document.getElementById('content').innerHTML = '<div class="loader">Menghitung data aktual...</div>';
  try {
    document.getElementById('content').innerHTML = `
      <div class="cards-grid">
        <div class="card"><div class="stat-value">0</div><div class="stat-label">Total Kendaraan</div></div>
        <div class="card"><div class="stat-value">0</div><div class="stat-label">Kendaraan Aktif</div></div>
        <div class="card"><div class="stat-value">0</div><div class="stat-label">Sedang Servis</div></div>
        <div class="card"><div class="stat-value">0</div><div class="stat-label">STNK Jatuh Tempo</div></div>
        <div class="card"><div class="stat-value">0</div><div class="stat-label">Total Aset</div></div>
        <div class="card"><div class="stat-value">0</div><div class="stat-label">Aset Rusak</div></div>
      </div>
      <div class="card">
        <h3>Selamat Datang di SINO GA System</h3>
        <p>Gunakan menu di sebelah kiri untuk mengakses modul.</p>
      </div>
    `;
  } catch (e) { renderError(e); }
}

// --- PLACEHOLDER UNTUK MENU LAIN ---
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

// --- ROUTER ---
function showPage(page, title) {
  if (page === 'dashboard') loadDashboard();
  else loadPlaceholder(title);
}

// --- INISIALISASI ---
function init() {
  google.script.run
    .withSuccessHandler(u => {
      const badge = document.getElementById('userBadge');
      badge.textContent = u ? `${u.Email} (${u.Role})` : 'Guest';
      if(u.Role === 'GUEST') {
        renderError('Email Anda belum terdaftar sebagai pengguna sistem. Silakan hubungi Admin.');
      }
    })
    .getCurrentUserEmailForUI();

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav a').forEach(el => el.classList.remove('active'));
      link.classList.add('active');
      const page = link.dataset.page;
      const title = link.innerText.trim(); 
      showPage(page, title);
    });
  });

  showPage('dashboard', 'Dashboard');
}

window.onload = init;
