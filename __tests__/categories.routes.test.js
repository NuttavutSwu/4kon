const express = require('express');
const request = require('supertest');

jest.mock('../utils/db', () => ({
  read: jest.fn().mockResolvedValue([
    { id: 'c1', name: 'tech' },
    { id: 'c2', name: 'gadget' }
  ]),
  insert: jest.fn().mockResolvedValue({ success: true }),
  remove: jest.fn().mockResolvedValue()
}));

const categoriesRouter = require('../routes/categories');

function makeApp(user = null) {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    if (!req.session) req.session = {};
    req.session.user = user;
    next();
  });
  app.use((req, res, next) => {
    const originalRender = res.render;
    res.render = (view, locals, callback) => {
      if (typeof locals === 'function') {
        callback = locals;
        locals = {};
      }
      if (callback) {
        callback(null, '');
      } else {
        res.status(res.statusCode || 200).json({ view, ...locals });
      }
    };
    next();
  });
  app.use('/admin/categories', categoriesRouter);
  return app;
}

describe('routes/categories', () => {
  test('POST /admin/categories/add returns 403 when not logged in', async () => {
    const app = makeApp(null);
    const res = await request(app)
      .post('/admin/categories/add')
      .send({ name: 'new-category' });
    expect(res.status).toBe(403);
  });

  test('POST /admin/categories/add returns 403 when user is not admin', async () => {
    const app = makeApp({ id: 'u1', role: 'user' });
    const res = await request(app)
      .post('/admin/categories/add')
      .send({ name: 'new-category' });
    expect(res.status).toBe(403);
  });

  test('POST /admin/categories/add returns 500 when name is empty', async () => {
    const app = makeApp({ id: 'admin-id', role: 'admin' });
    const res = await request(app)
      .post('/admin/categories/add')
      .send({ name: '' });
    expect(res.status).toBe(500);
  });

  test('POST /admin/categories/delete/:id returns 403 when not admin', async () => {
    const app = makeApp({ id: 'u1', role: 'user' });
    const res = await request(app)
      .post('/admin/categories/delete/c1');
    expect(res.status).toBe(403);
  });
});
