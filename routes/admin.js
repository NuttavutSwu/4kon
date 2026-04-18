const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const supabase = require('../utils/supabase');

// ===== helper =====
function priceBins(products) {
  const bins = [
    { label: '<500',   min: 0,    max: 500,      count: 0 },
    { label: '500-1K', min: 500,  max: 1000,     count: 0 },
    { label: '1K-3K',  min: 1000, max: 3000,     count: 0 },
    { label: '3K-5K',  min: 3000, max: 5000,     count: 0 },
    { label: '5K+',    min: 5000, max: Infinity, count: 0 },
  ];
  products.forEach(p => {
    const price = Number(p.price);
    const bin = bins.find(b => price >= b.min && price < b.max);
    if (bin) bin.count++;
  });
  return bins;
}

function topCategories(products) {
  const map = {};
  products.forEach(p => {
    const cat = p.category || 'ไม่ระบุ';
    map[cat] = (map[cat] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));
}

// ===== GET Dashboard =====
router.get('/', requireAdmin, async (req, res) => {
  const { data: products } = await supabase.from('products').select('*');
  const { data: users } = await supabase.from('users').select('*');
  const { data: categories } = await supabase.from('categories').select('*');
  const { data: logs } = await supabase.from('logs').select('*');

  const safeProducts = products || [];
  const safeUsers = users || [];
  const safeCategories = categories || [];
  const safeLogs = logs || [];

  const totalValue = safeProducts.reduce((s, p) => s + Number(p.price || 0), 0);
  const avgPrice = safeProducts.length ? Math.round(totalValue / safeProducts.length) : 0;

  const shopeeCount = safeProducts.filter(p => p.platform === 'shopee').length;
  const lazadaCount = safeProducts.filter(p => p.platform === 'lazada').length;
  const otherCount = safeProducts.length - shopeeCount - lazadaCount;
  const promoCount = safeProducts.filter(p => p.isPromo).length;

  const maxPlatform = Math.max(shopeeCount, lazadaCount, otherCount) || 1;

  const topProduct = safeProducts.reduce((best, p) =>
    Number(p.price) > Number(best?.price || 0) ? p : best, null);

  const cheapProduct = safeProducts.length
    ? safeProducts.reduce((low, p) => Number(p.price) < Number(low.price) ? p : low)
    : null;

  const today = new Date().toDateString();
  const logsToday = safeLogs.filter(l =>
    new Date(l.time).toDateString() === today
  ).length;

  const bins = priceBins(safeProducts);
  const maxBin = Math.max(...bins.map(b => b.count)) || 1;

  const catBreakdown = topCategories(safeProducts);
  const dotColors = ['#45B3E0','#4caf86','#f0a050','#7C6FD4','#e06b6b','#f5c842'];

  res.render('admin/dashboard', {
    activePage: 'dashboard',
    title: 'Dashboard',
    products: safeProducts,
    users: safeUsers,
    categories: safeCategories,
    logs: safeLogs.slice(0, 8),
    stats: {
      total: safeProducts.length,
      totalValue,
      avgPrice,
      shopeeCount,
      lazadaCount,
      otherCount,
      promoCount,
      userCount: safeUsers.length,
      categoryCount: safeCategories.length,
      logsToday,
      maxPlatform,
      topProduct,
      cheapProduct
    },
    bins,
    maxBin,
    catBreakdown,
    dotColors
  });
});


// ===== Products =====
router.get('/products', requireAdmin, async (req, res) => {
  const { data: products } = await supabase.from('products').select('*');

  res.render('admin/products', {
    activePage: 'products',
    title: 'จัดการสินค้า',
    products: products || []
  });
});


// ===== Categories =====
router.get('/categories', requireAdmin, async (req, res) => {
  const { data: categories } = await supabase.from('categories').select('*');
  const { data: products } = await supabase.from('products').select('*');

  const safeCategories = categories || [];
  const safeProducts = products || [];

  res.render('admin/categories', {
    activePage: 'categories',
    title: 'จัดการหมวดหมู่',
    categories: safeCategories.map(c => ({
      ...c,
      count: safeProducts.filter(p => p.category === c.name).length
    }))
  });
});


// ===== Users =====
router.get('/users', requireAdmin, async (req, res) => {
  const { data: users } = await supabase.from('users').select('*');

  res.render('admin/users', {
    activePage: 'users',
    title: 'จัดการผู้ใช้งาน',
    users: users || []
  });
});


// ===== Logs =====
router.get('/logs', requireAdmin, async (req, res) => {
  const { data: logs } = await supabase.from('logs').select('*');

  res.render('admin/logs', {
    activePage: 'logs',
    title: 'Purchase Logs',
    logs: logs || []
  });
});


// ===== Delete User =====
router.post('/users/delete/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.session.user.id) {
    return res.redirect('/admin/users');
  }

  await supabase
    .from('users')
    .delete()
    .eq('id', req.params.id);

  res.redirect('/admin/users');
});

module.exports = router;
