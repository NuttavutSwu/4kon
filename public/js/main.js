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
  if (params.get('error')) showToast(decodeURIComponent(params.get('error')), 'error');
})();

// ===== CONFIRM DELETES (extra safety) =====
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.dataset.confirm) {
    if (!confirm(form.dataset.confirm)) e.preventDefault();
  }
});

// กัน declare ซ้ำ
if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(
    'https://bpchdlmfjcbuehrhvkzg.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwY2hkbG1mamNidWVocmh2a3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTA5MTUsImV4cCI6MjA5MDg2NjkxNX0.7qhSHu9xAm9IOVgIln9YtiHwSCafzV_xUgahnLcVDkY'
  );
}

// ===== AUTH WAITING SCREEN =====
function showWaitingScreen() {
  if (document.getElementById('authWaitingScreen')) return;
  const style = document.createElement('style');
  style.innerHTML = `
    #authWaitingScreen {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(255, 255, 255, 0.98);
      z-index: 99999; display: flex; justify-content: center;
      align-items: center; flex-direction: column; text-align: center;
      font-family: 'Sarabun', sans-serif;
    }
    .waiting-content h2 { margin-top: 20px; color: #333; font-weight: 600; font-size: 24px; }
    .waiting-content p { color: #666; margin-top: 8px; font-size: 16px; }
    .spinner {
      width: 50px; height: 50px; margin: 0 auto;
      border: 4px solid #f3f3f3; border-top: 4px solid #ffa07a;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'authWaitingScreen';
  overlay.innerHTML = `
    <div class="waiting-content">
      <div class="spinner"></div>
      <h2>กำลังเข้าสู่ระบบ...</h2>
      <p>กรุณารอสักครู่ กำลังเตรียมข้อมูลของคุณ</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

const supabase = window.supabaseClient;

function handleAuth() {
  // ใช้ onAuthStateChange เพื่อติดตามสถานะ Login อย่างถูกต้อง
  supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user;
    console.log("AUTH EVENT:", event, "USER:", user);

    const isGuestView = !document.querySelector('.nav-user-avatar');

    if (user) {
      const isOnLoginUrl = window.location.pathname === '/login';
      const isOnHomeUrl = window.location.pathname === '/';
      const needsRedirect = (event === 'SIGNED_IN' || isGuestView) && (isOnHomeUrl || isOnLoginUrl);

      // ถ้ามั่นใจว่าเพิ่งล็อกอินเสร็จและกำลังจะเปลี่ยนหน้า ให้โชว์หน้าโหลดรอเลย
      if (needsRedirect) {
        showWaitingScreen();
      }

      // 1) Sync Session (อัปเดต Express Session) ดัก try-catch ป้องกัน error
      try {
        await fetch('/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.user_metadata?.name
          })
        });
      } catch (err) {
        console.error('Session sync error:', err);
      }

      // 2) ถ้าเพิ่งกลับจาก Google (SIGNED_IN) หรือ เป็น Guest View หน้าแรก/หน้าล็อกอิน ให้ไป wishlist
      if (needsRedirect) {
        window.location.href = '/wishlist';
        return;
      }
    } else {
      // 3) ถ้าไม่มี user แต่เข้าหน้า wishlist ให้เด้งกลับไป login
      if (window.location.pathname === '/wishlist') {
        window.location.href = '/login?redirect=/wishlist';
      }
    }
  });
}

handleAuth();

// ===== CLEAR SUPABASE SESSION ON LOGOUT =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href="/auth/logout"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
      }
      window.location.href = '/auth/logout';
    });
  });
});