const express = require('express');
const request = require('supertest');

jest.mock('bcryptjs', () => ({
  compareSync: jest.fn(),
  hashSync: jest.fn(() => 'hashed-password')
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'new-user-id')
}));

jest.mock('../utils/db', () => ({
  read: jest.fn(),
  insert: jest.fn()
}));

const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const authRouter = require('../routes/auth');

function makeApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = {
      destroy: jest.fn()
    };
    next();
  });
  app.use((req, res, next) => {
    res.render = (view, locals) => res.status(200).json({ view, ...locals });
    next();
  });
  app.use('/auth', authRouter);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('routes/auth', () => {
  test('POST /auth/login renders error on bad credentials', async () => {
    db.read.mockResolvedValue([
      { id: 'u1', username: 'alice', password: 'hashed-password', email: 'a@example.com', role_id: 2 }
    ]);
    bcrypt.compareSync.mockReturnValue(false);

    const res = await request(makeApp())
      .post('/auth/login')
      .send({ username: 'alice', password: 'wrong', redirect: '/wishlist' });

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('login');
    expect(res.body.redirect).toBe('/wishlist');
    expect(res.body.error).toContain('Username');
  });

  test('POST /auth/login stores session and redirects for admin users', async () => {
    db.read.mockResolvedValue([
      { id: 'admin-1', username: 'admin', password: 'hashed-password', email: 'admin@example.com', role_id: 1 }
    ]);
    bcrypt.compareSync.mockReturnValue(true);

    const app = makeApp();
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', password: 'secret', redirect: '/wishlist' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });

  test('POST /auth/register renders error when fields are missing', async () => {
    const res = await request(makeApp())
      .post('/auth/register')
      .send({ email: '', username: 'newuser', password: '' });

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('register');
    expect(res.body.error).toContain('กรุณากรอก');
  });

  test('POST /auth/register rejects duplicate username', async () => {
    db.read.mockResolvedValue([
      { id: 'u1', username: 'taken', email: 'taken@example.com', password: 'pw', role_id: 2 }
    ]);

    const res = await request(makeApp())
      .post('/auth/register')
      .send({ email: 'new@example.com', username: 'taken', password: 'pw' });

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('register');
    expect(res.body.error).toContain('Username');
  });

  test('POST /auth/register rejects duplicate email', async () => {
    db.read.mockResolvedValue([
      { id: 'u1', username: 'taken', email: 'taken@example.com', password: 'pw', role_id: 2 }
    ]);

    const res = await request(makeApp())
      .post('/auth/register')
      .send({ email: 'taken@example.com', username: 'newuser', password: 'pw' });

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('register');
    expect(res.body.error).toContain('Email');
  });

  test('POST /auth/register creates user and redirects to wishlist', async () => {
    db.read.mockResolvedValue([]);
    db.insert.mockResolvedValue({ success: true });

    const app = makeApp();
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@example.com', username: 'newuser', password: 'secret' });

    expect(db.insert).toHaveBeenCalledWith('users', [
      expect.objectContaining({
        id: 'new-user-id',
        username: 'newuser',
        email: 'new@example.com',
        password: 'hashed-password',
        role_id: 2
      })
    ]);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/wishlist');
  });

  test('POST /auth/register renders error when insert fails', async () => {
    db.read.mockResolvedValue([]);
    db.insert.mockResolvedValue({ success: false });

    const res = await request(makeApp())
      .post('/auth/register')
      .send({ email: 'new@example.com', username: 'newuser', password: 'secret' });

    expect(res.status).toBe(200);
    expect(res.body.view).toBe('register');
    expect(res.body.error).toContain('สมัครไม่สำเร็จ');
  });

  test('GET /auth/logout destroys session and redirects home', async () => {
    const res = await request(makeApp()).get('/auth/logout');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});
