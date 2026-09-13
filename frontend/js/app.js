/* ============================================================
   APP.JS — Auth guard, Router, API helpers, Utilities
   ============================================================ */

function formatApiEndpoint(url) {
  if (!url) return '';
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api')) clean += '/api';
  return clean;
}

function getApiUrl() {
  const DEFAULT_RENDER_API = 'https://my-diary-ksur.onrender.com/api';
  const customUrl = localStorage.getItem('diary_api_url');
  if (customUrl && customUrl.trim()) return formatApiEndpoint(customUrl);

  if (window.RENDER_API_URL || window.MYDIARY_API_URL) {
    return formatApiEndpoint(window.RENDER_API_URL || window.MYDIARY_API_URL);
  }

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhost) {
    return `${window.location.protocol}//${window.location.hostname}:3000/api`;
  }

  if (window.Capacitor || window.location.protocol === 'file:') {
    return DEFAULT_RENDER_API;
  }

  return DEFAULT_RENDER_API;
}
const API = getApiUrl();

function configureApiServer() {
  const current = localStorage.getItem('diary_api_url') || API;
  const input = prompt('Enter backend API Server URL (e.g., https://mydairy-backend.onrender.com):', current);
  if (input !== null) {
    if (input.trim() === '') {
      localStorage.removeItem('diary_api_url');
    } else {
      localStorage.setItem('diary_api_url', formatApiEndpoint(input));
    }
    window.location.reload();
  }
}

/* ──────────────────────────────────────────────────────────
   AUTH GUARD — redirect to login if not authenticated
   ────────────────────────────────────────────────────────── */
const _token = localStorage.getItem('diary_token');
const _user  = (() => {
  try { return JSON.parse(localStorage.getItem('diary_user')); } catch { return null; }
})();

if (!_token || !_user) {
  window.location.href = 'index.html';
}

/* ──────────────────────────────────────────────────────────
   CURRENT USER
   ────────────────────────────────────────────────────────── */
window.currentUser = _user;

// Populate sidebar + topbar with user info
function populateUserUI() {
  const u = window.currentUser;
  if (!u) return;

  // Generate initials from name (e.g. "Riya Sharma" → "RS")
  const initials = (u.name || 'U')
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  document.getElementById('sidebarAvatar').textContent  = initials;
  document.getElementById('sidebarName').textContent    = u.name  || 'User';
  document.getElementById('sidebarEmail').textContent   = u.email || '';
  document.getElementById('topbarAvatar').textContent   = initials;
  document.getElementById('topbarGreeting').textContent = `Hi, ${u.name.split(' ')[0]}!`;
}

/* ──────────────────────────────────────────────────────────
   LOGOUT
   ────────────────────────────────────────────────────────── */
function handleLogout() {
  showConfirm('Logout', 'Are you sure you want to logout?', () => {
    localStorage.removeItem('diary_token');
    localStorage.removeItem('diary_user');
    window.location.href = 'index.html';
  }, 'Logout', 'btn-danger');
}

/* ──────────────────────────────────────────────────────────
   APP STATE
   ────────────────────────────────────────────────────────── */
window.AppState = {
  page: 'home',
  editingNoteId: null,
  editingScheduleId: null,
  viewingScheduleId: null,
  noteFilter: 'all',
  scheduleTypeFilter: 'all',
  scheduleStatusFilter: 'all',
  selectedNoteColor: '#6366f1',
  selectedScheduleColor: '#8b5cf6',
  selectedDays: [],
  selectedDates: [],
  confirmCallback: null
};

/* ──────────────────────────────────────────────────────────
   API HELPERS — always attaches JWT
   ────────────────────────────────────────────────────────── */
function getToken() {
  return localStorage.getItem('diary_token');
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (res.status === 401 || res.status === 403) {
      // Token expired or invalid — force logout
      localStorage.removeItem('diary_token');
      localStorage.removeItem('diary_user');
      window.location.href = 'index.html';
      return;
    }
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (err) {
    throw err;
  }
}

/* ──────────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
   ────────────────────────────────────────────────────────── */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span>${message}</span>
    <button class="toast-dismiss" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, duration);
}

/* ──────────────────────────────────────────────────────────
   CONFIRM DIALOG
   ────────────────────────────────────────────────────────── */
function showConfirm(title, message, onConfirm, okText = 'Delete', okClass = 'btn-danger') {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = message;
  const okBtn = document.getElementById('confirmOk');
  okBtn.textContent = okText;
  okBtn.className   = `btn ${okClass}`;
  AppState.confirmCallback = onConfirm;
  openModal('confirmModal');
}

document.getElementById('confirmOk').addEventListener('click', () => {
  if (AppState.confirmCallback) AppState.confirmCallback();
  closeModal('confirmModal');
  AppState.confirmCallback = null;
});
document.getElementById('confirmCancel').addEventListener('click', () => {
  closeModal('confirmModal');
  AppState.confirmCallback = null;
});

/* ──────────────────────────────────────────────────────────
   MODAL HELPERS
   ────────────────────────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  const open = document.querySelectorAll('.modal-backdrop.open');
  if (open.length === 0) document.body.style.overflow = '';
}

// Close on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal(backdrop.id);
  });
});

/* ──────────────────────────────────────────────────────────
   NAVIGATION
   ────────────────────────────────────────────────────────── */
function navigateTo(page) {
  AppState.page = page;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById(`${page}Page`);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');
  const titles = { home: 'Home', notes: 'My Notes', schedules: 'My Schedule' };
  document.getElementById('pageTitle').textContent = titles[page] || 'My Diary';
  if (page === 'home')      { if (window.loadNotes) loadNotes(); if (window.loadSchedules) loadSchedules(); }
  if (page === 'notes')     { if (window.loadNotes) loadNotes(); }
  if (page === 'schedules') { if (window.loadSchedules) loadSchedules(); }
  closeSidebar();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

/* ──────────────────────────────────────────────────────────
   SIDEBAR (MOBILE)
   ────────────────────────────────────────────────────────── */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}
document.getElementById('menuBtn').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('overlay').addEventListener('click', closeSidebar);

/* ──────────────────────────────────────────────────────────
   COLOR PICKERS
   ────────────────────────────────────────────────────────── */
function initColorPicker(pickerId, stateKey) {
  const picker = document.getElementById(pickerId);
  picker.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState[stateKey] = btn.dataset.color;
    });
  });
}
initColorPicker('noteColorPicker', 'selectedNoteColor');
initColorPicker('scheduleColorPicker', 'selectedScheduleColor');

/* ──────────────────────────────────────────────────────────
   DATE HELPERS
   ────────────────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/* ──────────────────────────────────────────────────────────
   CURRENT DATE
   ────────────────────────────────────────────────────────── */
function updateCurrentDate() {
  const now = new Date();
  document.getElementById('currentDate').textContent = now.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  });
}

/* ──────────────────────────────────────────────────────────
   BACKGROUND ANIMATED PARTICLES
   ────────────────────────────────────────────────────────── */
function initBackgroundParticles() {
  let container = document.getElementById('particles');
  if (!container) {
    container = document.createElement('div');
    container.className = 'particles';
    container.id = 'particles';
    document.body.prepend(container);
  }
  container.innerHTML = '';
  const emojis = ['📔','📝','✨','⭐','🌸','📅','💜','🌙'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    const size = Math.random() * 24 + 12;
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${size}px;
      height: ${size}px;
      font-size: ${size * 0.8}px;
      animation-duration: ${Math.random() * 14 + 10}s;
      animation-delay: ${Math.random() * 8}s;
      background: none;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.18;
    `;
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    container.appendChild(p);
  }
}

/* ──────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  populateUserUI();
  updateCurrentDate();
  initBackgroundParticles();
  document.getElementById('scheduleStartDate').value = todayISO();
  navigateTo('home');
});
