const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const db = require('../utils/db'); // << ใช้ db ตัวใหม่ (ที่มี read/insert/etc)

// GET Admin dashboard
router.get('/', requireAdmin, async (req, res) => {
  const products = await db.read('products');
  const users = await db.read('users');
  const categories = await db.read('categories');
  const logs = await db.read('logs');

  const totalValue = products.reduce((sum, p) => sum + Number(p.price || 0), 0);
  const shopeeCount = products.filter(p => p.platform === 'shopee').length;
  const lazadaCount = products.filter(p => p.platform === 'lazada').length;
  const promoCount = products.filter(p => p.isPromo).length;

  res.render('admin', {
    products,
    users,
    categories,
    logs: logs.slice(0, 50),
    stats: {
      total: products.length,
      totalValue,
      shopeeCount,
      lazadaCount,
      promoCount,
      userCount: users.length
    }
  });
});


// POST Delete user (admin only)
router.post('/users/delete/:id', requireAdmin, async (req, res) => {
  const userId = req.params.id;

  // ❗ กันลบตัวเอง
  if (userId === req.session.user.id) {
    return res.redirect('/admin');
  }

  await db.remove('users', userId);

  res.redirect('/admin');
});

module.exports = router;
