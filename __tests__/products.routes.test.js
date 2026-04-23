const express = require('express');
const request = require('supertest');

jest.mock('../utils/supabase', () => {
  const state = {
    insertError: null,
    updateError: null,
    deleteError: null
  };
  const tables = {
    products: [],
    categories: []
  };

  const insert = jest.fn(async (rows) => {
    const list = Array.isArray(rows) ? rows : [rows];
    list.forEach((row) => tables.__active.push(row));
    return { error: null };
  });

  const update = jest.fn(async () => ({ error: null }));
  const del = jest.fn(async () => ({ error: null }));

  function makeQuery(tableName) {
    const filters = [];
    let selected = '*';

    const query = {
      select: jest.fn((fields = '*') => {
        selected = fields;
        return query;
      }),
      eq: jest.fn((field, value) => {
        filters.push({ field, value });
        return query;
      }),
      single: jest.fn(async () => {
        let data = (tables[tableName] || []).slice();
        for (const f of filters) data = data.filter((row) => row[f.field] === f.value);
        return { data: data[0] || null, error: null };
      }),
      insert: jest.fn(async (rows) => {
        if (state.insertError && tableName === 'products') return { error: state.insertError };
        const list = Array.isArray(rows) ? rows : [rows];
        list.forEach((row) => tables[tableName].push(row));
        return { error: null };
      }),
      update: jest.fn(() => ({
        eq: jest.fn(async () => ({ error: state.updateError }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(async () => ({ error: state.deleteError }))
      }))
    };

    query.then = (resolve, reject) => {
      try {
        let data = (tables[tableName] || []).slice();
        for (const f of filters) data = data.filter((row) => row[f.field] === f.value);
        if (selected !== '*' && typeof selected === 'string') {
          const fields = selected.split(',').map((s) => s.trim()).filter(Boolean);
          data = data.map((row) => {
            const slim = {};
            fields.forEach((k) => { slim[k] = row[k]; });
            return slim;
          });
        }
        return Promise.resolve(resolve({ data, error: null }));
      } catch (err) {
        if (reject) return Promise.resolve(reject(err));
        throw err;
      }
    };

    return query;
  }

  return {
    __state: state,
    __tables: tables,
    from: jest.fn((table) => makeQuery(table))
  };
});

const supabase = require('../utils/supabase');
const productsRouter = require('../routes/products');

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Fake session for tests. If header not present, session is empty.
  app.use((req, _res, next) => {
    const raw = req.get('x-test-user');
    req.session = raw ? { user: JSON.parse(raw) } : {};
    next();
  });

  // Prevent EJS rendering from crashing tests if a route calls res.render.
  app.use((req, res, next) => {
    res.render = (_view, locals) => res.status(res.statusCode || 200).json(locals || {});
    next();
  });

  app.use('/products', productsRouter);
  return app;
}

describe('routes/products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.__state.insertError = null;
    supabase.__state.updateError = null;
    supabase.__state.deleteError = null;
    supabase.__tables.products.length = 0;
    supabase.__tables.categories.length = 0;
  });

  test('POST /products/add redirects to login when not logged in', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/products/add')
      .type('form')
      .send({ name: 'x', price: '10' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?redirect=' + encodeURIComponent('/products/add'));
  });

  test('POST /products/add redirects with error when missing fields', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: '', price: '' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist?error=missing');
  });

  test('POST /products/add inserts product and redirects to /product/:id', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({
        name: 'Phone',
        price: '123',
        platform: 'shopee',
        category: 'tech, gadget, tech',
        link: ' https://example.com ',
        description: ' hello ',
        imgUrl: ' https://img ',
        isPromo: 'on'
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/product\//);
    expect(supabase.from).toHaveBeenCalledWith('products');

    expect(supabase.__tables.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Phone',
          price: 123,
          platform: 'shopee',
          category: 'tech,gadget',
          link: 'https://example.com',
          description: 'hello',
          imgUrl: 'https://img',
          isPromo: true,
          createdBy: 'u1'
        })
      ])
    );
  });

  test('POST /products/add returns 500 when insert fails', async () => {
    supabase.__state.insertError = { message: 'insert fail' };
    const app = makeApp();
    const res = await request(app)
      .post('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'Phone', price: '123' });

    expect(res.status).toBe(500);
    expect(res.text).toContain('Error adding product');
  });

  test('POST /products/add with admin role succeeds without createdBy category filter', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'admin-id', role: 'admin' }))
      .type('form')
      .send({ name: 'Admin Item', price: '50', category: 'global' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/product\//);
  });

  test('POST /products/add handles empty tags path', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'NoTag', price: '10', category: '' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/product\//);
  });

  test('GET /products/add renders product_form with tagSuggestions from all categories', async () => {
    supabase.__tables.categories.push(
      { id: 'c1', name: 'aa', createdBy: 'u1' },
      { id: 'c2', name: 'cc', createdBy: 'u2' }
    );
    supabase.__tables.products.push(
      { id: 'p1', createdBy: 'u1', category: 'mobile,aa' }
    );

    const app = makeApp();
    const res = await request(app)
      .get('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('add');
    expect(res.body.tagSuggestions).toEqual(expect.arrayContaining(['aa', 'cc']));
  });

  test('GET /products/edit/:id renders 404 when product missing', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/products/edit/p404')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(404);
  });

  test('POST /products/delete/:id returns 404 when product missing', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/products/delete/p404')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(404);
  });

  test('POST /products/edit/:id updates product and redirects', async () => {
    supabase.__tables.products.push({
      id: 'p1',
      name: 'Old',
      price: 100,
      platform: 'other',
      category: 'aa',
      createdBy: 'u1'
    });

    const app = makeApp();
    const res = await request(app)
      .post('/products/edit/p1')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({
        name: 'New Name',
        price: '200',
        platform: 'lazada',
        category: 'aa,bb',
        link: ' https://example.com/new ',
        description: ' desc ',
        imgUrl: ' https://img/new ',
        isPromo: 'on'
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/product/p1');
  });

  test('POST /products/edit/:id returns 500 when update fails', async () => {
    supabase.__state.updateError = { message: 'update fail' };
    supabase.__tables.products.push({ id: 'p1', name: 'x', price: 1, createdBy: 'u1', category: 'aa' });
    const app = makeApp();
    const res = await request(app)
      .post('/products/edit/p1')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'New', price: '2', category: 'aa' });

    expect(res.status).toBe(500);
    expect(res.text).toContain('Error updating product');
  });

  test('POST /products/edit/:id supports admin role edit path', async () => {
    supabase.__tables.products.push({ id: 'p5', name: 'x', price: 1, createdBy: 'u2', category: 'aa' });
    const app = makeApp();
    const res = await request(app)
      .post('/products/edit/p5')
      .set('x-test-user', JSON.stringify({ id: 'admin-id', role: 'admin' }))
      .type('form')
      .send({ name: 'AdminEdit', price: '2', category: 'aa' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/product/p5');
  });

  test('POST /products/edit/:id with empty tags still updates', async () => {
    supabase.__tables.products.push({ id: 'p6', name: 'x', price: 1, createdBy: 'u1', category: 'aa' });
    const app = makeApp();
    const res = await request(app)
      .post('/products/edit/p6')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'NoTags', price: '3', category: '' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/product/p6');
  });

  test('POST /products/delete/:id redirects to wishlist when success', async () => {
    supabase.__tables.products.push({
      id: 'p2',
      name: 'Item',
      price: 20,
      createdBy: 'u1',
      category: 'aa'
    });

    const app = makeApp();
    const res = await request(app)
      .post('/products/delete/p2')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });

  test('POST /products/delete/:id returns 500 when delete fails', async () => {
    supabase.__state.deleteError = { message: 'delete fail' };
    supabase.__tables.products.push({ id: 'p2', name: 'Item', price: 20, createdBy: 'u1', category: 'aa' });
    const app = makeApp();
    const res = await request(app)
      .post('/products/delete/p2')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(500);
    expect(res.text).toContain('Error deleting product');
  });

  test('GET /products/edit/:id renders edit form when product exists', async () => {
    supabase.__tables.products.push({
      id: 'p3',
      name: 'Edit me',
      price: 50,
      createdBy: 'u1',
      category: 'aa,bb',
      platform: 'other'
    });
    supabase.__tables.categories.push(
      { id: 'c1', name: 'aa', createdBy: 'u1' },
      { id: 'c2', name: 'global-tag', createdBy: 'u2' }
    );

    const app = makeApp();
    const res = await request(app)
      .get('/products/edit/p3')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('edit');
    expect(res.body.product).toEqual(expect.objectContaining({ id: 'p3' }));
    expect(res.body.tagSuggestions).toEqual(expect.arrayContaining(['aa', 'global-tag']));
  });

  test('GET /products/add works for admin path', async () => {
    supabase.__tables.categories.push({ id: 'c9', name: 'admin-cat', createdBy: 'u2' });
    const app = makeApp();
    const res = await request(app)
      .get('/products/add')
      .set('x-test-user', JSON.stringify({ id: 'admin-id', role: 'admin' }));

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('add');
    expect(res.body.tagSuggestions).toEqual(expect.arrayContaining(['admin-cat']));
  });

  test('POST /products/delete/:id supports admin role path', async () => {
    supabase.__tables.products.push({ id: 'p9', name: 'admin item', price: 10, createdBy: 'u2', category: 'aa' });
    const app = makeApp();
    const res = await request(app)
      .post('/products/delete/p9')
      .set('x-test-user', JSON.stringify({ id: 'admin-id', role: 'admin' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });
});

