const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const db = require('../utils/db');

// GET Admin dashboard
router.get('/', requireAdmin, (req, res) => {
  const products = db.read('products');
  const users = db.read('users');
  const categories = db.read('categories');
  const logs = db.read('logs');

  const totalValue = products.reduce((sum, p) => sum + Number(p.price), 0);
  const shopeeCount = products.filter(p => p.platform === 'shopee').length;
  const lazadaCount = products.filter(p => p.platform === 'lazada').length;
  const promoCount = products.filter(p => p.isPromo).length;

  res.render('admin', {
    products,
    users,
    categories,
    logs: logs.slice(0, 50),
    stats: { total: products.length, totalValue, shopeeCount, lazadaCount, promoCount, userCount: users.length }
  });
});

// POST Delete user (admin only)
router.post('/users/delete/:id', requireAdmin, (req, res) => {
  const users = db.read('users');
  // Prevent deleting self
  if (req.params.id === req.session.user.id) return res.redirect('/admin');
  db.write('users', users.filter(u => u.id !== req.params.id));
  res.redirect('/admin');
});

module.exports = router;
