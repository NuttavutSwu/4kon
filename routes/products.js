const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireLogin } = require('../middleware/auth');
const supabase = require('../utils/supabase');

// POST Add product
router.post('/add', requireLogin, async (req, res) => {
  const { name, price, platform, category, link, description, imgUrl, isPromo } = req.body;

  if (!name || !price) {
    return res.redirect('/wishlist?error=missing');
  }

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

  // 👉 insert product
  const { error } = await supabase.from('products').insert([newProduct]);
  if (error) {
    console.error(error);
    return res.status(500).send('Error adding product');
  }

  // 👉 add category if not exists
  if (newProduct.category) {
    const { data: categories } = await supabase.from('categories').select('*');

    if (!categories.find(c => c.name === newProduct.category)) {
      await supabase.from('categories').insert([
        { id: uuidv4(), name: newProduct.category }
      ]);
    }
  }

  res.redirect('/product/' + newProduct.id);
});

// POST Edit product
router.post('/edit/:id', requireLogin, async (req, res) => {
  const { name, price, platform, category, link, description, imgUrl, isPromo } = req.body;

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!products) {
    return res.status(404).render('error', { message: 'ไม่พบสินค้า' });
  }

  // check permission
  if (
    products.createdBy !== req.session.user.id &&
    req.session.user.role !== 'admin'
  ) {
    return res.status(403).render('error', { message: 'ไม่มีสิทธิ์แก้ไขสินค้านี้' });
  }

  const updatedProduct = {
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

  const { error } = await supabase
    .from('products')
    .update(updatedProduct)
    .eq('id', req.params.id);

  if (error) {
    console.error(error);
    return res.status(500).send('Error updating product');
  }

  // add category if new
  if (updatedProduct.category) {
    const { data: categories } = await supabase.from('categories').select('*');

    if (!categories.find(c => c.name === updatedProduct.category)) {
      await supabase.from('categories').insert([
        { id: uuidv4(), name: updatedProduct.category }
      ]);
    }
  }

  res.redirect('/product/' + req.params.id);
});

// POST Delete product
router.post('/delete/:id', requireLogin, async (req, res) => {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!product) {
    return res.status(404).render('error', { message: 'ไม่พบสินค้า' });
  }

  if (
    product.createdBy !== req.session.user.id &&
    req.session.user.role !== 'admin'
  ) {
    return res.status(403).render('error', { message: 'ไม่มีสิทธิ์ลบสินค้านี้' });
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    console.error(error);
    return res.status(500).send('Error deleting product');
  }

  res.redirect('/wishlist');
});

// GET Edit form
router.get('/edit/:id', requireLogin, async (req, res) => {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!product) {
    return res.status(404).render('error', { message: 'ไม่พบสินค้า' });
  }

  const { data: categories, error } = await supabase
    .from('categories')
    .select('*');

  if (error) {
    console.error(error);
  }

  res.render('product_form', {
    product,
    categories: categories || [], // ✅ แก้ตรงนี้
    mode: 'edit'
  });
});


// GET Add form
router.get('/add', requireLogin, async (req, res) => {
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*');

  if (error) {
    console.error(error);
  }

  res.render('product_form', {
    product: null,
    categories: categories || [], // ✅ แก้ตรงนี้
    mode: 'add'
  });
});

module.exports = router;