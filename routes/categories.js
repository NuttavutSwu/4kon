const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const db = require('../utils/db'); // ✅ ใช้ db ไม่ใช่ supabase ตรง ๆ

// POST Add category (admin only)
router.post('/add', requireAdmin, async (req, res) => {
  const { name } = req.body;

  if (!name) return res.redirect('/admin');

  const categories = await db.read('categories');

  // เช็คว่าซ้ำไหม
  const exists = categories.find(c => c.name === name.trim());

  if (!exists) {
    await db.insert('categories', {
      id: uuidv4(),
      name: name.trim()
    });
  }

  res.redirect('/admin');
});


// POST Delete category (admin only)
router.post('/delete/:id', requireAdmin, async (req, res) => {
  const categoryId = req.params.id;

  await db.remove('categories', categoryId);

  res.redirect('/admin');
});

module.exports = router;
