const express = require('express');
const request = require('supertest');

jest.mock('../utils/db', () => ({
  read: jest.fn(async () => [
    { id: 'p1', name: 'Phone', price: 100, platform: 'shopee', isPromo: false },
    { id: 'p2', name: 'Tablet', price: 200, platform: 'lazada', isPromo: true }
  ]),
  insert: jest.fn(async () => ({ success: true }))
}));

const pagesRouter = require('../routes/pages');

function makeApp(user = null) {
  const app = express();
  app.use((req, _res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(200).json({ view, ...locals });
    next();
  });
  app.use('/', pagesRouter);
  return app;
}

describe('routes/pages', () => {
  test('GET / renders home with products', async () => {
    const app = makeApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('home');
  });

  test('GET /wishlist renders with query params', async () => {
    const app = makeApp();
    const res = await request(app).get('/wishlist?category=tech&platform=shopee');
    expect(res.status).toBe(200);
  });

  test('GET /product/:id renders product detail', async () => {
    const app = makeApp();
    const res = await request(app).get('/product/p1');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('product_detail');
  });

  test('GET /about renders about page', async () => {
    const app = makeApp();
    const res = await request(app).get('/about');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('about');
  });

  test('GET /login redirects if logged in', async () => {
    const app = makeApp({ id: 'u1', role: 'user' });
    const res = await request(app).get('/login');
    expect(res.status).toBe(302);
  });

  test('GET /login renders login page', async () => {
    const app = makeApp();
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('login');
  });

  test('GET /register redirects if logged in', async () => {
    const app = makeApp({ id: 'u1', role: 'user' });
    const res = await request(app).get('/register');
    expect(res.status).toBe(302);
  });

  test('GET /register renders register page', async () => {
    const app = makeApp();
    const res = await request(app).get('/register');
    expect(res.status).toBe(200);
    expect(res.body.view).toBe('register');
  });

  test('GET /forgot-password renders page', async () => {
    const app = makeApp();
    const res = await request(app).get('/forgot-password');
    expect(res.status).toBe(200);
  });
});
