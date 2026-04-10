const express = require('express');
const router = express.Router();
const db = require('../utils/db'); // ✅ ใช้ db

// Home
router.get('/', async (req, res) => {
  const products = await db.read('products');

  const totalValue = products.reduce((sum, p) => sum + Number(p.price || 0), 0);
  const promoCount = products.filter(p => p.isPromo).length;

  res.render('home', {
    products: products.slice(0, 4),
    stats: { total: products.length, totalValue, promoCount }
  });
});


// Wishlist / Products listing
router.get('/wishlist', async (req, res) => {
  let products = await db.read('products');
  const categories = await db.read('categories');

  const { search, platform, sort, category } = req.query;

  if (category && category !== 'all') {
    products = products.filter(p => p.category === category);
  }

  if (platform) {
    products = products.filter(p => p.platform === platform);
  }

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }

  if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  if (sort === 'name-asc') products.sort((a, b) => a.name.localeCompare(b.name, 'th'));

  res.render('wishlist', {
    products,
    categories,
    query: req.query
  });
});


// Product detail
router.get('/product/:id', async (req, res) => {
  const products = await db.read('products');
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).render('error', { message: 'ไม่พบสินค้านี้' });
  }

  res.render('product_detail', { product });
});


// Log buy click
router.post('/product/:id/buy', async (req, res) => {
  const products = await db.read('products');
  const product = products.find(p => p.id === req.params.id);

  if (product) {
    await db.insert('logs', {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      user: req.session.user ? req.session.user.username : 'guest',
      time: new Date().toISOString()
    });
  }

  res.json({ ok: true, link: product ? product.link : '#' });
});


// About
router.get('/about', (req, res) => {
  res.render('about');
});


// Login / Register pages
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/wishlist');
  res.render('login', { error: null, redirect: req.query.redirect || '/wishlist' });
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/wishlist');
  res.render('register', { error: null });
});

router.get('/forgot-password', (req, res) => {
  res.render('forgot_password', { sent: false });
});

module.exports = router;
