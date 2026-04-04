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