const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireLogin } = require('../middleware/auth');
const supabase = require('../utils/supabase');

function normalizeTags(rawCategory) {
  if (!rawCategory) return [];
  return String(rawCategory)
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx);
}

function mergeCategories(savedCategories, products, userId) {
  const existing = savedCategories || [];
  const existingNames = new Set(existing.map(category => category.name));
  const derivedNames = Array.from(new Set(
    (products || [])
      .flatMap(product => String(product.category || '').split(','))
      .map(name => name.trim())
      .filter(Boolean)
  ));

  const derived = derivedNames
    .filter(name => !existingNames.has(name))
    .map((name, index) => ({
      id: `derived-${userId || 'user'}-${index}-${name}`,
      name,
      derived: true
    }));

  return [...existing, ...derived].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

// ================== ADD ==================
router.post('/add', requireLogin, async (req, res) => {
  const { name, price, platform, category, link, description, imgUrl, isPromo } = req.body;
  const tags = normalizeTags(category);

  if (!name || !price) {
    return res.redirect('/wishlist?error=missing');
  }

  const newProduct = {
    id: uuidv4(),
    name: name.trim(),
    price: Number(price),
    platform: platform || 'other',
    category: tags.join(','),
    link: link ? link.trim() : '',
    description: description ? description.trim() : '',
    imgUrl: imgUrl ? imgUrl.trim() : '',
    isPromo: isPromo === 'on',
    createdBy: req.session.user.id,
    createdAt: new Date().toISOString()
  };

  const { error } = await supabase.from('products').insert([newProduct]);
  if (error) {
    console.error(error);
    return res.status(500).send('Error adding product');
  }

  if (tags.length > 0) {
    let query = supabase.from('categories').select('*');

    if (req.session.user.role !== 'admin') {
      query = query.eq('createdBy', req.session.user.id);
    }

    const { data: categories } = await query;
    const knownTagNames = (categories || []).map(c => c.name);
    const missingTags = tags.filter(tag => !knownTagNames.includes(tag));

    if (missingTags.length > 0) {
      await supabase.from('categories').insert(
        missingTags.map(tag => ({
          id: uuidv4(),
          name: tag,
          createdBy: req.session.user.id
        }))
      );
    }
  }

  res.redirect('/product/' + newProduct.id);
});


// ================== EDIT ==================
router.post('/edit/:id', requireLogin, async (req, res) => {
  const { name, price, platform, category, link, description, imgUrl, isPromo } = req.body;
  const tags = normalizeTags(category);

  let query = supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id);

  if (req.session.user.role !== 'admin') {
    query = query.eq('createdBy', req.session.user.id);
  }

  const { data: product } = await query.single();

  if (!product) {
    return res.status(404).render('error', { message: 'ไม่พบสินค้า' });
  }

  const updatedProduct = {
    name: name.trim(),
    price: Number(price),
    platform: platform || 'other',
    category: tags.join(','),
    link: link ? link.trim() : '',
    description: description ? description.trim() : '',
    imgUrl: imgUrl ? imgUrl.trim() : '',
    isPromo: isPromo === 'on'
  };

  const { error } = await supabase
    .from('products')
    .update(updatedProduct)
    .eq('id', req.params.id);

  if (error) {
    console.error(error);
    return res.status(500).send('Error updating product');
  }

  if (tags.length > 0) {
    let queryCategories = supabase.from('categories').select('*');
    if (req.session.user.role !== 'admin') {
      queryCategories = queryCategories.eq('createdBy', req.session.user.id);
    }

    const { data: categories } = await queryCategories;
    const knownTagNames = (categories || []).map(c => c.name);
    const missingTags = tags.filter(tag => !knownTagNames.includes(tag));

    if (missingTags.length > 0) {
      await supabase.from('categories').insert(
        missingTags.map(tag => ({
          id: uuidv4(),
          name: tag,
          createdBy: req.session.user.id
        }))
      );
    }
  }

  res.redirect('/product/' + req.params.id);
});


// ================== DELETE ==================
router.post('/delete/:id', requireLogin, async (req, res) => {

  let query = supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id);

  if (req.session.user.role !== 'admin') {
    query = query.eq('createdBy', req.session.user.id);
  }

  const { data: product } = await query.single();

  if (!product) {
    return res.status(404).render('error', { message: 'ไม่พบสินค้า' });
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


// ================== GET EDIT FORM ==================
router.get('/edit/:id', requireLogin, async (req, res) => {

  let query = supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id);

  if (req.session.user.role !== 'admin') {
    query = query.eq('createdBy', req.session.user.id);
  }

  const { data: product } = await query.single();

  if (!product) {
    return res.status(404).render('error', { message: 'ไม่พบสินค้า' });
  }

  
  let catQuery = supabase.from('categories').select('*');
  let productCategoriesQuery = supabase.from('products').select('*');

  if (req.session.user.role !== 'admin') {
    catQuery = catQuery.eq('createdBy', req.session.user.id);
    productCategoriesQuery = productCategoriesQuery.eq('createdBy', req.session.user.id);
  }

  const { data: categories } = await catQuery;
  const { data: userProducts } = await productCategoriesQuery;
  const mergedCategories = mergeCategories(categories, userProducts, req.session.user.id);

  res.render('product_form', {
    product,
    categories: mergedCategories,
    mode: 'edit'
  });
});


// ================== GET ADD FORM ==================
router.get('/add', requireLogin, async (req, res) => {

  
  let catQuery = supabase.from('categories').select('*');
  let productCategoriesQuery = supabase.from('products').select('*');

  if (req.session.user.role !== 'admin') {
    catQuery = catQuery.eq('createdBy', req.session.user.id);
    productCategoriesQuery = productCategoriesQuery.eq('createdBy', req.session.user.id);
  }

  const { data: categories } = await catQuery;
  const { data: userProducts } = await productCategoriesQuery;
  const mergedCategories = mergeCategories(categories, userProducts, req.session.user.id);

  res.render('product_form', {
    product: null,
    categories: mergedCategories,
    mode: 'add'
  });
});

module.exports = router;
