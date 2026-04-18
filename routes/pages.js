const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { requireLogin } = require('../middleware/auth');

function parseTags(rawCategory) {
  if (!rawCategory) return [];
  return String(rawCategory)
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

// ===== Home =====
router.get('/', async (req, res) => {

  // guest
  if (!req.session.user) {
    return res.render('home', {
      products: [],
      stats: { total: 0, totalValue: 0, promoCount: 0 },
      guest: true
    });
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('createdBy', req.session.user.id);

  if (error) {
    console.error(error);
  }

  const safeProducts = products || [];

  const totalValue = safeProducts.reduce((sum, p) => sum + Number(p.price || 0), 0);
  const promoCount = safeProducts.filter(p => p.isPromo).length;

  res.render('home', {
    products: safeProducts.slice(0, 4),
    stats: {
      total: safeProducts.length,
      totalValue,
      promoCount
    }
  });
});


// ===== Wishlist =====
router.get('/wishlist', requireLogin, async (req, res) => {
  try {
    const { search, platform, sort, category, minPrice, maxPrice } = req.query;
    const min = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : null;
    const max = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : null;

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('createdBy', req.session.user.id);

    if (error) {
      console.error(error);
    }

    const safeProducts = products || [];

    // ✅ กรอง owner ซ้ำอีกรอบกันพลาด
    let ownerProducts = safeProducts.filter(
      p => p.createdBy === req.session.user.id
    );

    // Build category list from products this user has added only.
    const categorySet = new Set();
    ownerProducts.forEach(product => {
      parseTags(product.category).forEach(tag => categorySet.add(tag));
    });
    const categoriesFromProducts = Array.from(categorySet).map(name => ({ name }));

    let filteredProducts = ownerProducts;

    if (category && category !== 'all') {
      filteredProducts = filteredProducts.filter(p => parseTags(p.category).includes(category));
    }

    // 🔍 search
    if (search) {
      const q = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    if (platform) {
      filteredProducts = filteredProducts.filter(p => p.platform === platform);
    }

    // 💸 price range
    if (min !== null && !Number.isNaN(min)) {
      filteredProducts = filteredProducts.filter(p => Number(p.price) >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      filteredProducts = filteredProducts.filter(p => Number(p.price) <= max);
    }

    // 🔃 sort
    if (sort === 'price-asc') filteredProducts.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') filteredProducts.sort((a, b) => b.price - a.price);
    if (sort === 'name-asc') filteredProducts.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    res.render('wishlist', {
      products: filteredProducts,
      categories: categoriesFromProducts,
      query: req.query
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});



// ===== Product Detail (ล็อกเฉพาะเจ้าของ) =====
router.get('/product/:id', requireLogin, async (req, res) => {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .eq('createdBy', req.session.user.id) 
    .single();

  if (error || !product) {
    return res.status(404).render('error', { message: 'ไม่พบสินค้านี้' });
  }

  res.render('product_detail', { product });
});


// ===== Log Buy =====
router.post('/product/:id/buy', async (req, res) => {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (product) {
    const { error } = await supabase.from('logs').insert([
      {
        id: Date.now().toString(),
        productId: product.id,
        productName: product.name,
        user: req.session.user ? req.session.user.username : 'guest',
        time: new Date().toISOString()
      }
    ]);

    if (error) {
      console.error('Log error:', error);
    }
  }

  res.json({ ok: true, link: product ? product.link : '#' });
});


// ===== Static pages =====
router.get('/about', (req, res) => {
  res.render('about');
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/wishlist');
  res.render('login', { error: null, redirect: req.query.redirect || '/wishlist' });
});

router.get('/register', (req, res) => {
  res.redirect('/login');
});

router.get('/admin-login', (req, res) => {
  if (req.session.user?.role === 'admin') return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

router.get('/forgot-password', (req, res) => {
  res.render('forgot_password', { sent: false });
});

module.exports = router;
