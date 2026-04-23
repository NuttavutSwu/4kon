const express = require('express');
const request = require('supertest');

jest.mock('../utils/supabase', () => {
  const deleteEq = jest.fn(async () => ({ error: null }));
  const deleteBuilder = {
    eq: deleteEq
  };

  function makeSelectQuery(rows) {
    const filters = [];
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn((field, value) => {
        filters.push({ field, value });
        return query;
      }),
      single: jest.fn(async () => {
        let data = rows;
        for (const filter of filters) {
          data = data.filter((row) => row[filter.field] === filter.value);
        }
        return { data: data[0] || null, error: null };
      })
    };
    return query;
  }

  return {
    __deleteEq: deleteEq,
    from: jest.fn((table) => {
      if (table !== 'categories') {
        return {
          select: jest.fn(() => makeSelectQuery([])),
          delete: jest.fn(() => deleteBuilder)
        };
      }

      return {
        select: jest.fn(() => makeSelectQuery([
          { id: 'c1', name: 'tech', createdBy: 'u1' },
          { id: 'c2', name: 'home', createdBy: 'u2' }
        ])),
        delete: jest.fn(() => deleteBuilder),
        insert: jest.fn(async () => ({ error: null }))
      };
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

  test('user can delete their own category and returns back to product form', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/categories/delete/c1?from=%2Fproducts%2Fadd')
      .set('x-test-user', JSON.stringify({ id: 'u1', role: 'user' }));

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/products/add');
    expect(supabase.__deleteEq).toHaveBeenCalledWith('id', 'c1');
  });
});
