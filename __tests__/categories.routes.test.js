const express = require('express');
const request = require('supertest');

jest.mock('../utils/db', () => ({
  read: jest.fn(),
  insert: jest.fn(),
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
const categoriesRouter = require('../routes/categories');

function makeApp(user = null) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = user ? { user } : {};
    next();
  });
  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(res.statusCode || 200).json({ view, ...locals });
    next();
  });
  app.use('/admin/categories', categoriesRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  db.read.mockResolvedValue([
    { id: 'c1', name: 'tech' },
    { id: 'c2', name: 'gadget' }
  ]);
  db.insert.mockResolvedValue({ success: true });
  db.remove.mockResolvedValue();
});

describe('routes/categories', () => {
  test('POST /admin/categories/add returns 403 when not admin', async () => {
    const res = await request(makeApp()).post('/admin/categories/add').send({ name: 'new-category' });
    expect(res.status).toBe(403);
  });

  test('POST /admin/categories/add redirects without reading when name is missing', async () => {
    const res = await request(makeApp({ id: 'admin-id', role: 'admin' }))
      .post('/admin/categories/add')
      .send({ name: '' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
    expect(db.read).not.toHaveBeenCalled();
  });

  test('POST /admin/categories/add inserts new category once', async () => {
    const res = await request(makeApp({ id: 'admin-id', role: 'admin' }))
      .post('/admin/categories/add')
      .send({ name: 'new-category' });

    expect(db.insert).toHaveBeenCalledWith('categories', expect.objectContaining({
      name: 'new-category'
    }));
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('POST /admin/categories/add skips duplicate categories', async () => {
    const res = await request(makeApp({ id: 'admin-id', role: 'admin' }))
      .post('/admin/categories/add')
      .send({ name: 'tech' });

    expect(db.insert).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('POST /admin/categories/delete/:id removes a category for admins', async () => {
    const res = await request(makeApp({ id: 'admin-id', role: 'admin' }))
      .post('/admin/categories/delete/c1');

    expect(db.remove).toHaveBeenCalledWith('categories', 'c1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });
});
