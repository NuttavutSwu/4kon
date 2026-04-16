const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireAdmin } = require('../middleware/auth');
const supabase = require('../utils/supabase'); // ✅ เปลี่ยนตรงนี้

// POST Add category (admin only)
router.post('/add', requireAdmin, async (req, res) => {
  const { name } = req.body;

  if (!name) return res.redirect('/admin');

  const { data: categories } = await supabase
    .from('categories')
    .select('*');

  // เช็คว่าซ้ำไหม
  const exists = categories.find(c => c.name === name.trim());

  if (!exists) {
    await supabase.from('categories').insert([
      {
        id: uuidv4(),
        name: name.trim()
      }
    ]);
  }

  res.redirect('/admin');
});


// POST Delete category (admin only)
router.post('/delete/:id', requireAdmin, async (req, res) => {
  const categoryId = req.params.id;

  await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId);

  res.redirect('/admin');
});

module.exports = router;
