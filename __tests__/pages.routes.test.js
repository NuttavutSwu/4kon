const express = require('express');
const request = require('supertest');

jest.mock('../utils/supabase', () => {
  const state = {
    logInsertError: null,
    productsError: null,
    throwProductsFrom: false
  };
  const tables = {
    products: [
      { id: 'p1', name: 'Cheap', price: 1, createdBy: 'u1', platform: 'other', description: '', category: 'tech', link: '/a' },
      { id: 'p2', name: 'Mid', price: 50, createdBy: 'u1', platform: 'shopee', description: 'desc', category: 'tech,mobile', link: '/b' },
      { id: 'p3', name: 'Other user', price: 999, createdBy: 'u2', platform: 'other', description: '', category: 'x', link: '/c' }
    ],
    categories: [{ id: 'c1', name: 'tech', createdBy: 'u1' }],
    logs: []
  };

  function makeQuery(table) {
    const rows = tables[table] || [];
    const filters = [];
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn((field, value) => {
        filters.push({ field, value });
        return query;
      }),
      single: jest.fn(async () => {
        let data = rows.slice();
        for (const filter of filters) {
          data = data.filter((row) => row[filter.field] === filter.value);
        }
        return { data: data[0] || null, error: null };
      }),
      insert: jest.fn(async (payload) => {
        const list = Array.isArray(payload) ? payload : [payload];
        list.forEach((item) => rows.push(item));
        if (table === 'logs' && state.logInsertError) return { error: state.logInsertError };
        return { error: null };
      }),
      then: (resolve, reject) => {
        try {
          let data = rows;
          for (const filter of filters) {
            data = data.filter((row) => row[filter.field] === filter.value);
          }
          if (table === 'products' && state.productsError) {
            return Promise.resolve(resolve({ data, error: state.productsError }));
          }
          return Promise.resolve(resolve({ data, error: null }));
        } catch (err) {
          if (reject) return Promise.resolve(reject(err));
          throw err;
        }
      }
    };
    return query;
  }

  return {
    __state: state,
    __tables: tables,
    from: jest.fn((table) => {
      if (table === 'products' && state.throwProductsFrom) {
        throw new Error('products query throw');
      }
      return makeQuery(table);
    })
  };
});

const supabase = require('../utils/supabase');
const pagesRouter = require('../routes/pages');

function makeApp() {
  const app = express();

  app.use((req, res, next) => {
    const raw = req.get('x-test-user');
    req.session = raw ? { user: JSON.parse(raw) } : {};
    next();
  });

  app.use((req, res, next) => {
    res.render = (_view, locals) => res.status(res.statusCode || 200).json(locals || {});
    next();
  });

  app.use('/', pagesRouter);
  return app;
}

describe('routes/pages wishlist filters', () => {
  beforeEach(() => {
    supabase.__tables.logs.length = 0;
    supabase.__state.logInsertError = null;
    supabase.__state.productsError = null;
    supabase.__state.throwProductsFrom = false;
  });

  test('GET / returns guest view payload when not logged in', async () => {
    const app = makeApp();

    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body.guest).toBe(true);
    expect(res.body.products).toEqual([]);
    expect(res.body.stats).toEqual(expect.objectContaining({ total: 0 }));
  });

  test('GET /login redirects home when already logged in', async () => {
    const app = makeApp();

    const res = await request(app)
      .get('/login')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('GET /login renders login view when guest', async () => {
    const app = makeApp();
    const res = await request(app).get('/login?redirect=%2Fwishlist');

    expect(res.status).toBe(200);
    expect(res.body.redirect).toBe('/wishlist');
  });

  test('GET /wishlist applies maxPrice and minPrice filters', async () => {
    const app = makeApp();

    const res = await request(app)
      .get('/wishlist?minPrice=1&maxPrice=1')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0]).toEqual(expect.objectContaining({ id: 'p1', price: 1 }));
  });

  test('GET /wishlist handles product query error but still responds', async () => {
    supabase.__state.productsError = { message: 'wishlist products fail' };
    const app = makeApp();
    const res = await request(app)
      .get('/wishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  test('GET / returns dashboard stats for logged-in user', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual(expect.objectContaining({ total: 2, promoCount: 0 }));
  });

  test('GET / handles products query error with safe fallback list', async () => {
    supabase.__state.productsError = { message: 'products fail' };
    const app = makeApp();
    const res = await request(app)
      .get('/')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.stats).toEqual(expect.objectContaining({ total: 2 }));
  });

  test('GET /wishlist filters by category and platform', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/wishlist?category=mobile&platform=shopee')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe('p2');
  });

  test('GET /product/:id returns 404 when not owned', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/product/p3')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(404);
  });

  test('GET /product/:id returns detail when owned', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/product/p1')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.product).toEqual(expect.objectContaining({ id: 'p1' }));
  });

  test('POST /product/:id/buy returns link and logs event', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/product/p1/buy')
      .set('x-test-user', JSON.stringify({ id: 'u1', username: 'tester', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.link).toBe('/a');
    expect(supabase.__tables.logs.length).toBeGreaterThan(0);
  });

  test('POST /product/:id/buy still returns success when log insert fails', async () => {
    supabase.__state.logInsertError = { message: 'log fail' };
    const app = makeApp();
    const res = await request(app)
      .post('/product/p1/buy')
      .set('x-test-user', JSON.stringify({ id: 'u1', username: 'tester', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.link).toBe('/a');
  });

  test('POST /product/:id/buy returns fallback when product missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/product/notfound/buy');

    expect(res.status).toBe(200);
    expect(res.body.link).toBe('#');
  });

  test('static pages render', async () => {
    const app = makeApp();
    const [about, register, forgot] = await Promise.all([
      request(app).get('/about'),
      request(app).get('/register'),
      request(app).get('/forgot-password')
    ]);

    expect(about.status).toBe(200);
    expect(register.status).toBe(200);
    expect(forgot.status).toBe(200);
  });

  test('GET /wishlist applies search and sort', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/wishlist?search=mid&sort=name-asc')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Mid');
  });

  test('GET /wishlist search also matches description branch', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/wishlist?search=desc')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe('p2');
  });

  test('GET /wishlist handles sort price-desc branch', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/wishlist?sort=price-desc')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.products[0].price).toBeGreaterThanOrEqual(res.body.products[1].price);
  });

  test('GET /admin-login redirects admins to /admin', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/admin-login')
      .set('x-test-user', JSON.stringify({ id: 'a1', role: 'admin' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('GET /admin-login renders page for non-admin users', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/admin-login')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.error).toBe(null);
  });

  test('GET /register redirects logged-in users to wishlist', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/register')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });

  test('GET /wishlist returns 500 when query throws in try/catch', async () => {
    supabase.__state.throwProductsFrom = true;
    const app = makeApp();
    const res = await request(app)
      .get('/wishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(500);
    expect(res.text).toContain('Server Error');
  });
});
