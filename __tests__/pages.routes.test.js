const express = require('express');
const request = require('supertest');

jest.mock('../utils/supabase', () => {
  const products = [
    { id: 'p1', name: 'Cheap', price: 1, createdBy: 'u1', platform: 'other', description: '' },
    { id: 'p2', name: 'Mid', price: 50, createdBy: 'u1', platform: 'shopee', description: '' },
    { id: 'p3', name: 'Other user', price: 999, createdBy: 'u2', platform: 'other', description: '' }
  ];

  const categories = [
    { id: 'c1', name: 'tech' }
  ];

  function makeQuery(rows) {
    const filters = [];
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn((field, value) => {
        filters.push({ field, value });
        return query;
      }),
      then: (resolve, reject) => {
        try {
          let data = rows;
          for (const filter of filters) {
            data = data.filter((row) => row[filter.field] === filter.value);
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
    from: jest.fn((table) => {
      if (table === 'products') return makeQuery(products);
      if (table === 'categories') return makeQuery(categories);
      return makeQuery([]);
    })
  };
});

const pagesRouter = require('../routes/pages');

function makeApp() {
  const app = express();

  app.use((req, res, next) => {
    const raw = req.get('x-test-user');
    req.session = raw ? { user: JSON.parse(raw) } : {};
    next();
  });

  app.use((req, res, next) => {
    res.render = (_view, locals) => res.status(200).json(locals || {});
    next();
  });

  app.use('/', pagesRouter);
  return app;
}

describe('routes/pages wishlist filters', () => {
  test('GET /wishlist applies maxPrice and minPrice filters', async () => {
    const app = makeApp();

    const res = await request(app)
      .get('/wishlist?minPrice=1&maxPrice=1')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0]).toEqual(expect.objectContaining({ id: 'p1', price: 1 }));
  });
});
