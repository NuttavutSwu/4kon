const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../utils/supabase');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin1234';

// POST Login
router.post('/login', async (req, res) => {
  return res.render('login', {
    error: 'ผู้ใช้ทั่วไปต้องเข้าสู่ระบบด้วย Google เท่านั้น',
    redirect: '/wishlist'
  });
});


router.post('/admin-login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.render('admin-login', { error: 'Admin username/password ไม่ถูกต้อง' });
  }
  req.session.user = {
    id: 'admin-hardcoded',
    username: ADMIN_USERNAME,
    email: 'admin@local',
    role: 'admin'
  };
  return res.redirect('/admin');
});

router.get('/google', async (req, res) => {
  const redirectTo = `${req.protocol}://${req.get('host')}/auth/google/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });

  if (error || !data?.url) {
    console.error(error);
    return res.render('login', { error: 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้', redirect: '/wishlist' });
  }
  return res.redirect(data.url);
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.render('login', { error: 'ไม่พบข้อมูลยืนยันจาก Google', redirect: '/wishlist' });
  }

  const { data: authData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !authData?.user?.email) {
    console.error(exchangeError);
    return res.render('login', { error: 'ยืนยันตัวตน Google ไม่สำเร็จ', redirect: '/wishlist' });
  }

  const email = authData.user.email.trim().toLowerCase();
  const { data: users } = await supabase.from('users').select('*');
  let existingUser = (users || []).find(u => (u.email || '').toLowerCase() === email);

  if (!existingUser) {
    const baseUsername = authData.user.user_metadata?.name || authData.user.user_metadata?.full_name || email.split('@')[0];
    const username = ((users || []).some(u => u.username === baseUsername))
      ? `${baseUsername}${Date.now().toString().slice(-4)}`
      : baseUsername;

    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: bcrypt.hashSync(uuidv4(), 10),
      role: 'user',
      role_id: 2,
      created_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase.from('users').insert([newUser]);
    if (insertError) {
      console.error(insertError);
      return res.render('login', { error: 'สร้างบัญชีผู้ใช้จาก Google ไม่สำเร็จ', redirect: '/wishlist' });
    }
    existingUser = newUser;
  }

  req.session.user = {
    id: existingUser.id,
    username: existingUser.username,
    email: existingUser.email,
    role: 'user'
  };
  return res.redirect('/wishlist');
});


// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
