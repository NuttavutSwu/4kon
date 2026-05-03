const express = require('express');
const request = require('supertest');

jest.mock('../utils/db', () => ({
  read: jest.fn(),
  insert: jest.fn()
}));

const db = require('../utils/db');
const pagesRouter = require('../routes/pages');

const products = [
  { id: 'p1', name: 'Phone Pro', description: 'Great phone', price: 300, platform: 'shopee', category: 'tech', isPromo: true, link: 'https://example.com/1' },
  { id: 'p2', name: 'Tablet Air', description: 'Fast tablet', price: 200, platform: 'lazada', category: 'gadget', isPromo: false, link: 'https://example.com/2' },
  { id: 'p3', name: 'Cable', description: 'usb cable', price: 50, platform: 'shopee', category: 'tech', isPromo: false, link: 'https://example.com/3' },
  { id: 'p4', name: 'Camera', description: 'photo gear', price: 500, platform: 'shopee', category: 'camera', isPromo: false, link: 'https://example.com/4' },
  { id: 'p5', name: 'Mouse', description: 'wireless mouse', price: 150, platform: 'lazada', category: 'tech', isPromo: false, link: 'https://example.com/5' }
];

function makeApp(user = null) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(res.statusCode || 200).json({ view, ...locals });
    next();
  });
  app.use('/', pagesRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  db.read.mockImplementation(async (table) => {
    if (table === 'products') return products;
    if (table === 'categories') return [{ id: 'c1', name: 'tech' }, { id: 'c2', name: 'gadget' }];
    if (table === 'logs') return [];
    return [];
  });
  db.insert.mockResolvedValue({ success: true });
});

describe('routes/pages', () => {
  test('GET / renders home with stats and first four products', async () => {
    const res = await request(makeApp()).get('/');

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('home');
    expect(res.body.products).toHaveLength(4);
    expect(res.body.stats).toEqual(expect.objectContaining({
      total: 5,
      totalValue: 1200,
      promoCount: 1
    }));
  });

  test('GET /wishlist filters, searches, and sorts products', async () => {
    const res = await request(makeApp()).get('/wishlist?category=tech&platform=shopee&search=phone&sort=price-desc');

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('wishlist');
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].id).toBe('p1');
  });

  test('GET /product/:id renders product detail when found', async () => {
    const res = await request(makeApp()).get('/product/p1');

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('product_detail');
    expect(res.body.product.id).toBe('p1');
  });

  test('GET /product/:id returns 404 when missing', async () => {
    const res = await request(makeApp()).get('/product/missing');

    expect(res.status).toBe(404);
    expect(res.body.view).toBe('error');
  });

  test('POST /product/:id/buy logs a click and returns link', async () => {
    const res = await request(makeApp({ id: 'u1', username: 'alice' })).post('/product/p1/buy');

    expect(db.insert).toHaveBeenCalledWith('logs', expect.objectContaining({
      productId: 'p1',
      productName: 'Phone Pro',
      user: 'alice'
    }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ ok: true, link: 'https://example.com/1' }));
  });

  test('POST /product/:id/buy returns fallback link when product is missing', async () => {
    db.read.mockResolvedValueOnce([]);

    const res = await request(makeApp()).post('/product/missing/buy');

    expect(db.insert).not.toHaveBeenCalled();
    expect(res.body.link).toBe('#');
  });

  test('GET /login and /register redirect when already signed in', async () => {
    const app = makeApp({ id: 'u1', role: 'user' });
    const loginRes = await request(app).get('/login');
    const registerRes = await request(app).get('/register');
    expect(loginRes.status).toBe(302);
    expect(registerRes.status).toBe(302);
  });

  test('GET /forgot-password renders the page', async () => {
    const res = await request(makeApp()).get('/forgot-password');

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('forgot-password');
  });
});
