const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabase');
const { requireLogin } = require('../middleware/auth');

/**
 * Collect unique category names from a list of products.
 *
 * Products store categories as a comma-separated string in `product.category`.
 *
 * @param {{ category?: string }[] | null | undefined} products
 * @returns {string[]}
 */
function collectCategoryNames(products) {
  return Array.from(new Set(
    (products || [])
      .flatMap(product => String(product.category || '').split(','))
      .map(name => name.trim())
      .filter(Boolean)
  ));
}

/**
 * Merge saved categories (from DB) with categories derived from product tags.
 *
 * @param {{ id: string, name: string }[] | null | undefined} savedCategories
 * @param {{ category?: string }[] | null | undefined} products
 * @param {string} userId
 * @returns {{ id: string, name: string, derived?: boolean }[]}
 */
function mergeCategories(savedCategories, products, userId) {
  const existing = savedCategories || [];
  const existingNames = new Set(existing.map(category => category.name));
  const derived = collectCategoryNames(products)
    .filter(name => !existingNames.has(name))
    .map((name, index) => ({
      id: `derived-${userId || 'user'}-${index}-${name}`,
      name,
      derived: true
    }));

  return [...existing, ...derived].sort((a, b) => a.name.localeCompare(b.name, 'en'));
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

    // Fetch ALL user products for building the category sidebar
    const { data: allUserProducts } = await supabase
      .from('products')
      .select('*')
      .eq('createdBy', req.session.user.id);

    let queryBuilder = supabase
      .from('products')
      .select('*')
      .eq('createdBy', req.session.user.id);

    

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

    if (category && category !== 'all') {
      const selected = String(category).trim();
      filteredProducts = filteredProducts.filter((p) => {
        const cats = String(p.category || '')
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean);
        return cats.includes(selected);
      });
    }

    const min = Number(minPrice);
    const max = Number(maxPrice);

    if (!Number.isNaN(min) && minPrice !== '') {
      filteredProducts = filteredProducts.filter(p => Number(p.price || 0) >= min);
    }

    if (!Number.isNaN(max) && maxPrice !== '') {
      filteredProducts = filteredProducts.filter(p => Number(p.price || 0) <= max);
    }

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

    let categoriesQuery = supabase
      .from('categories')
      .select('*');

    if (req.session.user.role !== 'admin') {
      categoriesQuery = categoriesQuery.eq('createdBy', req.session.user.id);
    }

    const { data: categories } = await categoriesQuery;
    const mergedCategories = mergeCategories(categories, allUserProducts || [], req.session.user.id);

    res.render('wishlist', {
      products: filteredProducts,
      categories: mergedCategories,
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
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null, redirect: req.query.redirect || '/' });
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
