const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const db = require('../utils/db');

// POST Add category (admin only)
router.post('/add', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.redirect('/admin');
  const categories = db.read('categories');
  if (!categories.find(c => c.name === name.trim())) {
    categories.push({ id: uuidv4(), name: name.trim() });
    db.write('categories', categories);
  }
  res.redirect('/admin');
});

// POST Delete category (admin only)
router.post('/delete/:id', requireAdmin, (req, res) => {
  const categories = db.read('categories');
  db.write('categories', categories.filter(c => c.id !== req.params.id));
  res.redirect('/admin');
});

module.exports = router;
