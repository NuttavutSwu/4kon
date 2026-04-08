const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireLogin } = require('../middleware/auth');
const db = require('../utils/db');

// POST Add product
router.post('/add', requireLogin, (req, res) => {
  const { name, price, platform, category, link, description, imgUrl, isPromo } = req.body;

  if (!name || !price) {
    return res.redirect('/wishlist?error=missing');
  }

  const products = db.read('products');
  const newProduct = {
    id: uuidv4(),
    name: name.trim(),
    price: Number(price),
    platform: platform || 'other',
    category: category ? category.trim() : '',
    link: link ? link.trim() : '',
    description: description ? description.trim() : '',
    imgUrl: imgUrl ? imgUrl.trim() : '',
    isPromo: isPromo === 'on',
    createdBy: req.session.user.id,
    createdAt: new Date().toISOString()
  };

  products.unshift(newProduct);
  db.write('products', products);

  // Add category if new
  if (newProduct.category) {
    const categories = db.read('categories');
    if (!categories.find(c => c.name === newProduct.category)) {
      categories.push({ id: uuidv4(), name: newProduct.category });
      db.write('categories', categories);
    }
  }

  res.redirect('/product/' + newProduct.id);
});

// POST Edit product
router.post('/edit/:id', requireLogin, (req, res) => {
  const { name, price, platform, category, link, description, imgUrl, isPromo } = req.body;
  const products = db.read('products');
  const idx = products.findIndex(p => p.id === req.params.id);

  if (idx === -1) return res.status(404).render('error', { message: 'ไม่พบสินค้า' });

  // Only owner or admin can edit
  if (products[idx].createdBy !== req.session.user.id && req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'ไม่มีสิทธิ์แก้ไขสินค้านี้' });
  }

  products[idx] = {
    ...products[idx],
    name: name.trim(),
    price: Number(price),
    platform: platform || 'other',
    category: category ? category.trim() : '',
    link: link ? link.trim() : '',
    description: description ? description.trim() : '',
    imgUrl: imgUrl ? imgUrl.trim() : '',
    isPromo: isPromo === 'on',
    updatedAt: new Date().toISOString()
  };

  db.write('products', products);

  // Add category if new
  if (products[idx].category) {
    const categories = db.read('categories');
    if (!categories.find(c => c.name === products[idx].category)) {
      categories.push({ id: uuidv4(), name: products[idx].category });
      db.write('categories', categories);
    }
  }

  res.redirect('/product/' + req.params.id);
});

// POST Delete product
router.post('/delete/:id', requireLogin, (req, res) => {
  const products = db.read('products');
  const product = products.find(p => p.id === req.params.id);

  if (!product) return res.status(404).render('error', { message: 'ไม่พบสินค้า' });

  if (product.createdBy !== req.session.user.id && req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'ไม่มีสิทธิ์ลบสินค้านี้' });
  }

  db.write('products', products.filter(p => p.id !== req.params.id));
  res.redirect('/wishlist');
});

// GET Edit form
router.get('/edit/:id', requireLogin, (req, res) => {
  const products = db.read('products');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).render('error', { message: 'ไม่พบสินค้า' });

  const categories = db.read('categories');
  res.render('product_form', { product, categories, mode: 'edit' });
});

// GET Add form
router.get('/add', requireLogin, (req, res) => {
  const categories = db.read('categories');
  res.render('product_form', { product: null, categories, mode: 'add' });
});

module.exports = router;
