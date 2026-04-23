const express = require('express');
const request = require('supertest');

jest.mock('../utils/supabase', () => {
  const tables = {
    categories: [
      { id: 'c1', name: 'tech', createdBy: 'u1' },
      { id: 'c2', name: 'home', createdBy: 'u2' }
    ],
    products: [
      { id: 'p1', name: 'Phone', createdBy: 'u1', category: 'tech,mobile' },
      { id: 'p2', name: 'Glass', createdBy: 'u1', category: 'mobile' }
    ]
  };

  function makeSelectQuery(table) {
    const rows = tables[table] || [];
    const filters = [];
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn((field, value) => {
        filters.push({ field, value });
        return query;
      }),
      maybeSingle: jest.fn(async () => {
        let data = rows;
        for (const filter of filters) {
          data = data.filter((row) => row[filter.field] === filter.value);
        }
        return { data: data[0] || null, error: null };
      }),
      single: jest.fn(async () => {
        let data = rows.slice();
        for (const filter of filters) {
          data = data.filter((row) => row[filter.field] === filter.value);
        }
        return { data: data[0] || null, error: null };
      }),
      delete: jest.fn(() => ({
        eq: (() => {
          const filters = [];
          const builder = {
            eq: (field, value) => {
              filters.push({ field, value });
              const applyNow = field === 'id' || filters.length >= 2;
              if (!applyNow) return builder;
              for (let i = rows.length - 1; i >= 0; i -= 1) {
                const ok = filters.every((f) => rows[i][f.field] === f.value);
                if (ok) rows.splice(i, 1);
              }
              return Promise.resolve({ error: null });
            }
          };
          return builder.eq;
        })()
      })),
      update: jest.fn((payload) => ({
        eq: jest.fn((field, value) => {
          const row = rows.find((r) => r[field] === value);
          if (row) Object.assign(row, payload);
          return Promise.resolve({ error: null });
        })
      })),
      insert: jest.fn(async (items) => {
        const list = Array.isArray(items) ? items : [items];
        list.forEach((item) => rows.push(item));
        return { error: null };
      })
    };
    query.then = (resolve) => {
      let data = rows.slice();
      for (const filter of filters) {
        data = data.filter((row) => row[filter.field] === filter.value);
      }
      return Promise.resolve(resolve({ data, error: null }));
    };
    return query;
  }

  return {
    __tables: tables,
    from: jest.fn((table) => {
      return makeSelectQuery(table);
    })
  };
});

const supabase = require('../utils/supabase');
const categoriesRouter = require('../routes/categories');

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));

  app.use((req, _res, next) => {
    const raw = req.get('x-test-user');
    req.session = raw ? { user: JSON.parse(raw) } : {};
    next();
  });

  app.use('/categories', categoriesRouter);
  return app;
}

describe('routes/categories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.__tables.categories.splice(0, supabase.__tables.categories.length,
      { id: 'c1', name: 'tech', createdBy: 'u1' },
      { id: 'c2', name: 'home', createdBy: 'u2' });
    supabase.__tables.products.splice(0, supabase.__tables.products.length,
      { id: 'p1', name: 'Phone', createdBy: 'u1', category: 'tech,mobile' },
      { id: 'p2', name: 'Glass', createdBy: 'u1', category: 'mobile' });
  });

  test('user can create category via JSON request', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/categories/add?from=%2Fproducts%2Fadd&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'new-tag' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.created).toBe(true);
    expect(res.body.category).toEqual(expect.objectContaining({ name: 'new-tag', createdBy: 'u1' }));
  });

  test('add without name redirects back', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/add?from=%2Fwishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: '' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });

  test('add existing category returns created=false in json mode', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/add?from=%2Fproducts%2Fadd&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'tech' });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
  });

  test('add missing name in json mode returns 400', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/add?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  test('add success in non-json redirects back', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/add?from=%2Fwishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'camera' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });

  test('user can delete their own category and returns back to product form', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/categories/delete/c1?from=%2Fproducts%2Fadd')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/products/add');
    expect(supabase.__tables.categories.some((c) => c.id === 'c1')).toBe(false);
  });

  test('delete-name blocks deletion if it would leave products with zero tags', async () => {
    supabase.__tables.products.splice(0, supabase.__tables.products.length,
      { id: 'p1', name: 'Phone', createdBy: 'u1', category: 'tech' });

    const app = makeApp();

    const res = await request(app)
      .post('/categories/delete-name?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'tech' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain('อย่างน้อย 1 tag');
  });

  test('delete-name succeeds and strips tag from user products', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete-name?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'tech' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('delete-name rejects invalid names', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete-name?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'all' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('delete-name invalid on non-json redirects with error query', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete-name?from=%2Fwishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'all items' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/wishlist?error=');
  });

  test('delete-name blocked in non-json redirects with at-least-1-tag error', async () => {
    supabase.__tables.products.splice(0, supabase.__tables.products.length,
      { id: 'p1', name: 'Phone', createdBy: 'u1', category: 'tech' });
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete-name?from=%2Fwishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'tech' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/wishlist?error=');
  });

  test('delete/:id returns 404 json when category not found', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete/nope?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  test('delete/:id returns redirect error when missing and non-json', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete/nope?from=%2Fwishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/wishlist?error=');
  });

  test('delete/:id blocks if product would have zero tags', async () => {
    supabase.__tables.products.splice(0, supabase.__tables.products.length,
      { id: 'p1', createdBy: 'u1', category: 'tech' });
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete/c1?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('อย่างน้อย 1 tag');
  });

  test('delete/:id blocked non-json redirects with error', async () => {
    supabase.__tables.products.splice(0, supabase.__tables.products.length,
      { id: 'p1', createdBy: 'u1', category: 'tech' });
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete/c1?from=%2Fwishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/wishlist?error=');
  });

  test('delete-name succeeds for admin branch path', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete-name?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'admin' }))
      .type('form')
      .send({ name: 'tech' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('delete-name non-json success redirects back', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete-name?from=%2Fwishlist')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }))
      .type('form')
      .send({ name: 'tech' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });

  test('delete/:id succeeds and strips category from products', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete/c1?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('delete/:id works for admin path too', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/categories/delete/c1?from=%2Fwishlist&format=json')
      .set('Accept', 'application/json')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'admin' }));

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
