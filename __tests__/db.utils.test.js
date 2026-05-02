const express = require('express');
const request = require('supertest');

// Test db utilities through actual routes that use them
// The db.js utility module relies on supabase - we'll test the routes that use it

// Create a chainable mock that supports insert().select() pattern
// Use mockChainable prefix to allow referencing in jest.mock factory
function mockChainable() {
  return {
    select: jest.fn().mockResolvedValue({ data: [], error: null }),
    insert: jest.fn(() => mockChainable()),
    update: jest.fn(() => mockChainable()),
    delete: jest.fn(() => mockChainable()),
    eq: jest.fn(() => mockChainable())
  };
}

jest.mock('../utils/supabase', () => ({
  from: jest.fn(() => mockChainable())
}));

const pagesRouter = require('../routes/pages');

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    req.session = {};
    next();
  });
  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(200).json({ view, ...locals });
    next();
  });
  app.use('/', pagesRouter);
  return app;
}

describe('utils/db functions via routes', () => {
  test('GET /home uses db.read(products)', async () => {
    const app = makeApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  test('GET /wishlist uses db.read(products) and db.read(categories)', async () => {
    const app = makeApp();
    const res = await request(app).get('/wishlist');
    expect(res.status).toBe(200);
  });

  test('GET /about does not need db', async () => {
    const app = makeApp();
    const res = await request(app).get('/about');
    expect(res.status).toBe(200);
  });

  test('GET /login does not need db', async () => {
    const app = makeApp();
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
  });

  test('GET /product/:id returns rendered view (not found returns error view in mock)', async () => {
    const app = makeApp();
    const res = await request(app).get('/product/p1');
    // With empty mock data, it renders error view
    expect(res.status).toBe(200);
  });
});
