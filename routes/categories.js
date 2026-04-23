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

router.post('/add', requireLogin, async (req, res) => {
  const returnTo = getReturnTo(req);
  const name = normalizeName(req.body.name);

  if (!name) return res.redirect(returnTo);

  let query = supabase.from('categories').select('*');
  if (req.session.user.role !== 'admin') {
    query = query.eq('createdBy', req.session.user.id);
  }

  const { data: categories } = await query;
  const exists = (categories || []).find(c => c.name === name);

  if (!exists) {
    const payload = {
      id: uuidv4(),
      name
    };

    if (req.session.user.role !== 'admin') {
      payload.createdBy = req.session.user.id;
    }

    await supabase.from('categories').insert([payload]);
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

  res.redirect(returnTo);
});

module.exports = router;
