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
  console.log("กำลังตรวจสอบสถานะการเข้าสู่ระบบ...");
  
  // ตรวจสอบว่า Supabase มองเห็น User ไหม
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.log("ไม่พบ User หรือ Session หมดอายุ");
  }

  if (user) {
    console.log("พบ User ใน Supabase:", user.email);
    
    // Sync ข้อมูลกับ Server
    try {
      const response = await fetch('/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.name
        })
      });
      
      if (response.ok) {
        console.log("Sync User กับ Server สำเร็จ");
      }
    } catch (err) {
      console.error("Sync Error:", err);
    }

    // จัดการ Redirect หน้า Login
    if (window.location.pathname === '/login') {
      window.location.href = '/wishlist';
    }
  } else {
    // ถ้าไม่มี User และพยายามเข้าหน้าหวงห้าม
    if (window.location.pathname === '/wishlist' || window.location.pathname === '/admin') {
      console.log("ไม่มีสิทธิ์เข้าถึงหน้าเพจนี้ กรุณา Login");
      window.location.href = '/login';
    }
  }
}
handleAuth();