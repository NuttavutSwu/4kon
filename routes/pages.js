const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { requireLogin } = require('../middleware/auth');

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
    const { search, platform, sort, category } = req.query;

    let queryBuilder = supabase
      .from('products')
      .select('*')
      .eq('createdBy', req.session.user.id);

    if (category && category !== 'all') {
      queryBuilder = queryBuilder.eq('category', category);
    }

    if (platform) {
      queryBuilder = queryBuilder.eq('platform', platform);
    }

    const { data: products, error } = await queryBuilder;

    if (error) {
      console.error(error);
    }

    
    let filteredProducts = (products || []).filter(
      p => p.createdBy === req.session.user.id
    );

    // search
    if (search) {
      const q = search.toLowerCase();
      filteredProducts = filteredProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }

    // sort
    if (sort === 'price-asc') filteredProducts.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') filteredProducts.sort((a, b) => b.price - a.price);
    if (sort === 'name-asc') filteredProducts.sort((a, b) => a.name.localeCompare(b.name, 'th'));

    const { data: categories } = await supabase
      .from('categories')
      .select('*');

    res.render('wishlist', {
      products: filteredProducts,
      categories: categories || [],
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

router.get('/admin-login', (req, res) => {
  if (req.session.user?.role === 'admin') return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/wishlist');
  res.render('register', { error: null });
});

router.get('/forgot-password', (req, res) => {
  res.render('forgot_password', { sent: false });
});

module.exports = router;
