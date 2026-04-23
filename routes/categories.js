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

function redirectWithError(res, returnTo, message) {
  const base = returnTo || '/wishlist';
  const joiner = base.includes('?') ? '&' : '?';
  return res.redirect(base + joiner + 'error=' + encodeURIComponent(message));
}

function stripTag(raw, deletedName) {
  const tags = String(raw || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  return tags.filter(t => t !== deletedName).join(',');
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

// Delete by name (works for derived categories too)
router.post('/delete-name', requireLogin, async (req, res) => {
  const returnTo = getReturnTo(req);
  const name = normalizeName(req.body.name || req.query.name);

  if (!name || name.toLowerCase() === 'all' || name.toLowerCase() === 'all items') {
    if (wantsJson(req)) {
      return res.status(400).json({ ok: false, error: 'Invalid category name' });
    }
    return redirectWithError(res, returnTo, 'ลบหมวดหมู่นี้ไม่ได้');
  }

  // Validate: each product must keep at least 1 tag.
  const { data: productsForValidation } = await supabase
    .from('products')
    .select('id, name, category')
    .eq('createdBy', req.session.user.id);

  const wouldBecomeEmpty = (productsForValidation || []).filter((p) => {
    const tags = String(p.category || '').split(',').map(t => t.trim()).filter(Boolean);
    return tags.includes(name) && tags.length === 1;
  });

  if (wouldBecomeEmpty.length > 0) {
    const message = 'ต้องเหลืออย่างน้อย 1 tag ให้สินค้า';
    if (wantsJson(req)) {
      return res.status(400).json({
        ok: false,
        error: message,
        affectedCount: wouldBecomeEmpty.length
      });
    }
    return redirectWithError(res, returnTo, message);
  }

  // Delete saved category row if it exists
  if (req.session.user.role !== 'admin') {
    await supabase
      .from('categories')
      .delete()
      .eq('createdBy', req.session.user.id)
      .eq('name', name);
  } else {
    await supabase
      .from('categories')
      .delete()
      .eq('name', name);
  }

  // Strip the name from products
  let productsQuery = supabase
    .from('products')
    .select('id, category');

  // Keep scope safe: normal users only their own; admin also only their own wishlist.
  productsQuery = productsQuery.eq('createdBy', req.session.user.id);

  const { data: allProducts } = await productsQuery;

  if (allProducts && allProducts.length > 0) {
    const toUpdate = allProducts.filter(p => {
      const tags = String(p.category || '').split(',').map(t => t.trim()).filter(Boolean);
      return tags.includes(name);
    });

    for (const p of toUpdate) {
      const newTags = stripTag(p.category, name);
      await supabase
        .from('products')
        .update({ category: newTags })
        .eq('id', p.id);
    }
  }

  if (wantsJson(req)) {
    return res.json({ ok: true, deletedName: name });
  }

  return res.redirect(returnTo);
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
    if (wantsJson(req)) {
      return res.status(404).json({ ok: false, error: 'Category not found' });
    }
    return redirectWithError(res, returnTo, 'ไม่พบหมวดหมู่');
  }

  // Validate: each product must keep at least 1 tag.
  const { data: productsForValidation } = await supabase
    .from('products')
    .select('id, name, category')
    .eq('createdBy', req.session.user.id);

  const wouldBecomeEmpty = (productsForValidation || []).filter((p) => {
    const tags = String(p.category || '').split(',').map(t => t.trim()).filter(Boolean);
    return tags.includes(category.name) && tags.length === 1;
  });

  if (wouldBecomeEmpty.length > 0) {
    const message = 'ต้องเหลืออย่างน้อย 1 tag ให้สินค้า';
    if (wantsJson(req)) {
      return res.status(400).json({
        ok: false,
        error: message,
        affectedCount: wouldBecomeEmpty.length
      });
    }
    return redirectWithError(res, returnTo, message);
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
      const newTags = stripTag(p.category, deletedName);

      await supabase
        .from('products')
        .update({ category: newTags })
        .eq('id', p.id);
    }
  }

  if (wantsJson(req)) {
    return res.json({ ok: true, deletedId: categoryId, deletedName });
  }

  res.redirect(returnTo);
});

module.exports = router;
