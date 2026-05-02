const express = require('express');
const request = require('supertest');

jest.mock('../utils/db', () => ({
  read: jest.fn().mockResolvedValue([]),
  insert: jest.fn().mockResolvedValue({ success: true }),
  update: jest.fn().mockResolvedValue({ success: true }),
  remove: jest.fn().mockResolvedValue()
}));

const adminRouter = require('../routes/admin');

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
  app.use('/admin', adminRouter);
  return app;
}

describe('routes/admin', () => {
  test('GET /admin returns 403 when not logged in', async () => {
    const app = makeApp(null);
    const res = await request(app).get('/admin');
    // requireAdmin returns 403 when there's no user
    expect(res.status).toBe(403);
  });

  test('GET /admin returns 403 when user is not admin', async () => {
    const app = makeApp({ id: 'u1', role: 'user' });
    const res = await request(app).get('/admin');
    // requireAdmin returns 403 when role !== 'admin'
    expect(res.status).toBe(403);
  });

  test('GET /admin renders dashboard for admin', async () => {
    const app = makeApp({ id: 'admin-id', role: 'admin' });
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
  });
});
