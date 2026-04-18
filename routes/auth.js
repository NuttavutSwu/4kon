const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../utils/supabase'); // ✅ เปลี่ยนตรงนี้

// POST Login
router.post('/login', async (req, res) => {
  const { username, password, redirect } = req.body;

  const { data: users } = await supabase
    .from('users')
    .select('*');

  const user = users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', {
      error: 'Username หรือ Password ไม่ถูกต้อง',
      redirect: redirect || '/wishlist'
    });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role_id === 1 ? 'admin' : 'user'
  };

  if (user.role_id === 1) {
  return res.redirect('/admin'); // ✅ admin ไป dashboard
} else {
  return res.redirect('/wishlist'); // ✅ user ไป wishlist
}
});


// POST Register
router.post('/register', async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.render('register', { error: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  const { data: users } = await supabase
    .from('users')
    .select('*');

  if (users.find(u => u.username === username)) {
    return res.render('register', { error: 'Username นี้ถูกใช้งานแล้ว' });
  }

  if (users.find(u => u.email === email)) {
    return res.render('register', { error: 'Email นี้ถูกใช้งานแล้ว' });
  }

  const newUser = {
    id: uuidv4(),
    username: username.trim(),
    email: email.trim(),
    password: bcrypt.hashSync(password, 10),
    role_id: 2,
    created_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('users')
    .insert([newUser]);

  if (error) {
    console.error(error);
    return res.render('register', { error: 'สมัครไม่สำเร็จ' });
  }

  req.session.user = {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    role: 'user'
  };

  res.redirect('/wishlist');
});


// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
