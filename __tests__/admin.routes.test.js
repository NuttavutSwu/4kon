const express = require('express');
const request = require('supertest');

jest.mock('../utils/db', () => ({
  read: jest.fn(),
  remove: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  requireAdmin: (req, res, next) => {
    if (!req.session || req.session.user?.role !== 'admin') {
      return res.status(403).render('error', { message: 'forbidden' });
    }
    return next();
  }
}));

const db = require('../utils/db');
const adminRouter = require('../routes/admin');

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
  app.use('/admin', adminRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  db.read.mockImplementation(async (table) => {
    if (table === 'products') {
      return [
        { id: 'p1', price: 100, platform: 'shopee', isPromo: true },
        { id: 'p2', price: 250, platform: 'lazada', isPromo: false },
        { id: 'p3', price: 150, platform: 'shopee', isPromo: false }
      ];
    }
    if (table === 'users') {
      return [{ id: 'u1' }, { id: 'u2' }];
    }
    if (table === 'categories') {
      return [{ id: 'c1' }];
    }
    if (table === 'logs') {
      return Array.from({ length: 60 }, (_, index) => ({ id: String(index) }));
    }
    return [];
  });
  db.remove.mockResolvedValue();
});

describe('routes/admin', () => {
  test('GET /admin returns 403 when not admin', async () => {
    const res = await request(makeApp({ id: 'u1', role: 'user' })).get('/admin');
    expect(res.status).toBe(403);
  });

  test('GET /admin renders dashboard stats for admins', async () => {
    const res = await request(makeApp({ id: 'admin-1', role: 'admin' })).get('/admin');

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('admin');
    expect(res.body.stats).toEqual(expect.objectContaining({
      total: 3,
      totalValue: 500,
      shopeeCount: 2,
      lazadaCount: 1,
      promoCount: 1,
      userCount: 2
    }));
    expect(res.body.logs).toHaveLength(50);
  });

  test('POST /admin/users/delete/:id blocks deleting self', async () => {
    const res = await request(makeApp({ id: 'admin-1', role: 'admin' }))
      .post('/admin/users/delete/admin-1');

    expect(db.remove).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('POST /admin/users/delete/:id deletes other users', async () => {
    const res = await request(makeApp({ id: 'admin-1', role: 'admin' }))
      .post('/admin/users/delete/u2');

    expect(db.remove).toHaveBeenCalledWith('users', 'u2');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });
});
