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

var supabase = window.supabaseClient;

async function handleLogout(e) {
  if (e) e.preventDefault();
  console.log("กำลังออกจากระบบ...");
  
  try {
    // 1. ล้าง session ใน Supabase (LocalStorage)
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    console.log("Supabase SignOut สำเร็จ");
    
    // 2. ส่งไปที่ Server เพื่อล้าง Express Session
    // ใช้ window.location.replace เพื่อไม่ให้ผู้ใช้กด back กลับมาได้
    window.location.replace('/auth/logout'); 
  } catch (err) {
    console.error("Logout Error:", err);
    window.location.replace('/auth/logout');
  }
}

async function handleAuth() {
  const overlay = document.getElementById('auth-loading-overlay');
  
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // 1. รอให้การ Sync กับ Server เสร็จสมบูรณ์
      const response = await fetch('/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.name
        })
      });

      // 2. ถ้าอยู่หน้า Login ให้ไปหน้า Wishlist (หน้าจอยังคงบังอยู่)
      if (window.location.pathname === '/login') {
        window.location.href = '/wishlist';
        return; // ไม่ต้องปิด overlay เพราะกำลังจะเปลี่ยนหน้า
      }
      
      // 3. ถ้าอยู่หน้า Home และเพิ่ง Sync เสร็จ ให้ Refresh 1 ครั้งเพื่อให้ Header อัปเดต
      // ตรวจสอบว่าใน Session ของ Browser มีการระบุว่า "เพิ่ง Login" หรือไม่ เพื่อป้องกัน Refresh วนลูป
      if (!sessionStorage.getItem('wasSynced')) {
        sessionStorage.setItem('wasSynced', 'true');
        window.location.reload(); 
        return;
      }

    } else {
      // ถ้าไม่มี User และพยายามเข้าหน้า Wishlist
      if (window.location.pathname === '/wishlist') {
        window.location.href = '/login';
        return;
      }
      // ล้างสถานะ sync เมื่อไม่มี user
      sessionStorage.removeItem('wasSynced');
    }
  } catch (err) {
    console.error("Auth error:", err);
  } finally {
    // ปิดหน้าจอ Loading เมื่อทุกอย่างเสร็จสิ้น
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
  }
}
handleAuth();