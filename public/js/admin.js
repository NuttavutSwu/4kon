// Sidebar toggle (mobile)
function toggleSidebar() {
  document.querySelector('.admin-sidebar').classList.toggle('open');
}

// Live clock in topbar
function updateClock() {
  const el = document.getElementById('topbarDate');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('th-TH', {
    weekday: 'short', year: 'numeric',
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
updateClock();
setInterval(updateClock, 60000);

// Animate platform bars on load
window.addEventListener('load', () => {
  document.querySelectorAll('.platform-bar-fill[data-width]').forEach(bar => {
    setTimeout(() => {
      bar.style.width = bar.dataset.width + '%';
    }, 200);
  });
  document.querySelectorAll('.price-bin[data-height]').forEach(bin => {
    setTimeout(() => {
      bin.style.height = bin.dataset.height + 'px';
    }, 300);
  });
});

// Close sidebar when clicking outside on mobile
document.addEventListener('click', e => {
  const sidebar = document.querySelector('.admin-sidebar');
  if (sidebar && sidebar.classList.contains('open')) {
    if (!e.target.closest('.admin-sidebar') && !e.target.closest('.admin-sidebar-toggle')) {
      sidebar.classList.remove('open');
    }
  }
});
