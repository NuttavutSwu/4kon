// ===== USER MENU TOGGLE =====
function toggleMenu() {
  const menu = document.getElementById('userMenu');
  if (menu) menu.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('userMenu');
  if (menu && !e.target.closest('.nav-user-wrap')) {
    menu.classList.remove('show');
  }
});

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type !== 'success' ? type : ''}`;
  el.innerHTML = `<span>${icons[type] || '✅'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// Show toast from query param (e.g. after redirect)
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success')) showToast(decodeURIComponent(params.get('success')));
  if (params.get('error'))   showToast(decodeURIComponent(params.get('error')), 'error');
})();

// ===== CONFIRM DELETES (extra safety) =====
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.dataset.confirm) {
    if (!confirm(form.dataset.confirm)) e.preventDefault();
  }
});
