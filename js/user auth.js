const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');

// POST Register
router.post('/register', (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.render('register', { error: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  const users = db.read('users');
  if (users.find(u => u.username === username)) {
    return res.render('register', { error: 'Username นี้ถูกใช้งานแล้ว' });
  }
  if (users.find(u => u.email === email)) {
    return res.render('register', { error: 'Email นี้ถูกใช้งานแล้ว' });
  }

  const newUser = {
    id: uuidv4(),
    username,
    email,
    password: bcrypt.hashSync(password, 10),
    role: 'user',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  db.write('users', users);

  req.session.user = { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role };
  res.redirect('/wishlist');
});

// POST Login
router.post('/login', (req, res) => {
  const { username, password, redirect } = req.body;
  const users = db.read('users');
  const user = users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', {
      error: 'Username หรือ Password ไม่ถูกต้อง',
      redirect: redirect || '/wishlist'
    });
  }

  req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
  res.redirect(redirect || '/wishlist');
});