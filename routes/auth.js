const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../utils/supabase');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin1234';


// 🔹 USER LOGIN
router.post('/login', async (req, res) => {
  return res.render('login', {
    error: 'ผู้ใช้ทั่วไปต้องเข้าสู่ระบบด้วย Google เท่านั้น',
    redirect: '/wishlist'
  });
});


// 🔹 ADMIN LOGIN
router.post('/admin-login', (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.render('admin-login', {
      error: 'Admin username/password ไม่ถูกต้อง'
    });
  }

  req.session.user = {
    id: 'admin-hardcoded',
    username: ADMIN_USERNAME,
    email: 'admin@local',
    role: 'admin'
  };

  return res.redirect('/admin');
});



// 🔹 GOOGLE LOGIN 
router.get('/google', async (req, res) => {
  try {
    const isLocal = req.get('host').includes('localhost');

    const redirectTo = isLocal
      ? 'http://localhost:3000'
      : 'https://fourkon.onrender.com';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' }
      }
    });

    if (error || !data?.url) {
      console.error(error);
      return res.render('login', {
        error: 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้',
        redirect: '/wishlist'
      });
    }

    return res.redirect(data.url);

  } catch (err) {
    console.error(err);
    return res.render('login', {
      error: 'เกิดข้อผิดพลาด',
      redirect: '/wishlist'
    });
  }
});


// 🔹 SYNC USER (NEW)
router.post('/sync-user', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'No email' });
    }

    const { data: users } = await supabase.from('users').select('*');

    let existingUser = users?.find(
      u => (u.email || '').toLowerCase() === email.toLowerCase()
    );

    if (!existingUser) {
      const baseUsername = name || email.split('@')[0];

      const username = users?.some(u => u.username === baseUsername)
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

      const { error: insertError } = await supabase
        .from('users')
        .insert([newUser]);

      if (insertError) {
        console.error(insertError);
        return res.status(500).json({ error: 'สร้าง user ไม่สำเร็จ' });
      }

      existingUser = newUser;
    }

    req.session.user = existingUser;

    return res.json({ user: existingUser });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});



// 🔹 LOGOUT
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});


module.exports = router;
