const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireLogin } = require('../middleware/auth');
const supabase = require('../utils/supabase');

function getReturnTo(req) {
  const candidate = typeof req.query.from === 'string' && req.query.from.startsWith('/')
    ? req.query.from
    : null;
  return candidate || req.get('referer') || '/wishlist';
}

function normalizeName(name) {
  return String(name || '').trim();
}

function wantsJson(req) {
  const accept = String(req.get('accept') || '').toLowerCase();
  return req.query.format === 'json' || accept.includes('application/json');
}

router.post('/add', requireLogin, async (req, res) => {
  const returnTo = getReturnTo(req);
  const name = normalizeName(req.body.name);

  if (!name) {
    if (wantsJson(req)) {
      return res.status(400).json({ error: 'Category name required' });
    }
    return res.redirect(returnTo);
  }

  let query = supabase.from('categories').select('*');
  if (req.session.user.role !== 'admin') {
    query = query.eq('createdBy', req.session.user.id);
  }

  const { data: categories } = await query;
  const exists = (categories || []).find(c => c.name === name);
  let savedCategory = exists || null;

  if (!exists) {
    const payload = {
      id: uuidv4(),
      name
    };

    if (req.session.user.role !== 'admin') {
      payload.createdBy = req.session.user.id;
    }

    await supabase.from('categories').insert([payload]);
    savedCategory = payload;
  }

  if (wantsJson(req)) {
    return res.json({
      ok: true,
      category: savedCategory,
      created: !exists
    });
  }

  res.redirect(returnTo);
});

router.post('/delete/:id', requireLogin, async (req, res) => {
  const returnTo = getReturnTo(req);
  const categoryId = req.params.id;

  let query = supabase
    .from('categories')
    .select('*')
    .eq('id', categoryId);

  if (req.session.user.role !== 'admin') {
    query = query.eq('createdBy', req.session.user.id);
  }

  const { data: category } = await query.single();

  if (!category) {
    return res.redirect(returnTo);
  }

  await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId);

  // Strip the deleted category name from all products that reference it
  const deletedName = category.name;

  let productsQuery = supabase
    .from('products')
    .select('id, category');

  if (req.session.user.role !== 'admin') {
    productsQuery = productsQuery.eq('createdBy', req.session.user.id);
  }

  const { data: allProducts } = await productsQuery;

  if (allProducts && allProducts.length > 0) {
    const toUpdate = allProducts.filter(p => {
      const tags = String(p.category || '').split(',').map(t => t.trim()).filter(Boolean);
      return tags.includes(deletedName);
    });

    for (const p of toUpdate) {
      const newTags = String(p.category || '')
        .split(',')
        .map(t => t.trim())
        .filter(t => t && t !== deletedName)
        .join(',');

      await supabase
        .from('products')
        .update({ category: newTags })
        .eq('id', p.id);
    }
  }

  res.redirect(returnTo);
});

module.exports = router;
