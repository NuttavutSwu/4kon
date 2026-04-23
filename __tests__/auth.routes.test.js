const express = require('express');
const request = require('supertest');

jest.mock('../utils/supabase', () => {
  const state = {
    maybeSingleError: null,
    insertError: null,
    selectError: null,
    signOutError: null,
    throwFromUsers: false
  };
  const signInWithOAuth = jest.fn();
  const signOut = jest.fn(async () => ({ error: state.signOutError }));

  const usersTable = [];

  function usersQuery(selectedFields = '*') {
    const filters = [];
    const query = {
      select: jest.fn(() => query),
      eq: jest.fn((field, value) => {
        filters.push({ field, value });
        return query;
      }),
      or: jest.fn(() => query),
      maybeSingle: jest.fn(async () => {
        if (state.maybeSingleError) return { data: null, error: state.maybeSingleError };
        let data = usersTable.slice();
        for (const f of filters) data = data.filter((row) => row[f.field] === f.value);
        return { data: data[0] || null, error: null };
      }),
      insert: jest.fn(async (rows) => {
        if (state.insertError) return { error: state.insertError };
        rows.forEach((r) => usersTable.push(r));
        return { error: null };
      })
    };

    // Support `.select('*')` + await returning `{ data }`
    query.then = (resolve) => {
      if (state.selectError) return Promise.resolve(resolve({ data: null, error: state.selectError }));
      return Promise.resolve(resolve({ data: usersTable.slice(), error: null, selectedFields }));
    };
    return query;
  }

  return {
    __users: usersTable,
    __state: state,
    __signOut: signOut,
    __signInWithOAuth: signInWithOAuth,
    auth: { signInWithOAuth, signOut },
    from: jest.fn((table) => {
      if (table === 'users' && state.throwFromUsers) {
        throw new Error('users table unavailable');
      }
      if (table === 'users') return usersQuery();
      return usersQuery();
    })
  };
});

const supabase = require('../utils/supabase');
const authRouter = require('../routes/auth');

function makeApp(host = 'localhost:3000') {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  const sharedSession = {
    destroy: (cb) => cb && cb()
  };
  app.use((req, res, next) => {
    req.session = sharedSession;
    req.headers.host = host;
    res.render = (_view, locals) => res.status(200).json(locals || {});
    next();
  });

  app.use('/auth', authRouter);
  return app;
}

describe('routes/auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.__users.length = 0;
    supabase.__state.maybeSingleError = null;
    supabase.__state.insertError = null;
    supabase.__state.selectError = null;
    supabase.__state.signOutError = null;
    supabase.__state.throwFromUsers = false;
  });

  test('GET /auth/google redirects to Supabase OAuth URL without mutating state', async () => {
    const oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=supabase-state-123';
    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: oauthUrl },
      error: null
    });

    const app = makeApp();
    const res = await request(app).get('/auth/google');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(oauthUrl);
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: 'http://localhost:3000/login?redirect=%2F'
        })
      })
    );
  });

  test('GET /auth/admin-login renders page', async () => {
    const app = makeApp();
    const res = await request(app).get('/auth/admin-login');

    expect(res.status).toBe(200);
    expect(res.body.error).toBe(null);
  });

  test('POST /auth/login renders google-only warning', async () => {
    const app = makeApp();
    const res = await request(app).post('/auth/login').send({});

    expect(res.status).toBe(200);
    expect(res.body.error).toContain('Google');
  });

  test('POST /auth/admin-login renders error when credentials invalid', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/admin-login')
      .type('form')
      .send({ username: 'admin', password: 'wrong' });

    expect(res.status).toBe(200);
    expect(res.body.error).toContain('ไม่ถูกต้อง');
  });

  test('POST /auth/admin-login redirects when admin user exists', async () => {
    supabase.__users.push({ id: 'u-admin', username: 'admin' });

    const app = makeApp();
    const res = await request(app)
      .post('/auth/admin-login')
      .type('form')
      .send({ username: 'admin', password: 'admin1234' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('POST /auth/admin-login can create dedicated admin user', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/admin-login')
      .type('form')
      .send({ username: 'admin', password: 'admin1234' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
    expect(supabase.__users.some((u) => u.username === 'admin-system')).toBe(true);
  });

  test('POST /auth/admin-login uses fixed-id user when found', async () => {
    supabase.__users.push({ id: '00000000-0000-0000-0000-000000000001', username: 'x' });
    const app = makeApp();
    const res = await request(app)
      .post('/auth/admin-login')
      .type('form')
      .send({ username: 'admin', password: 'admin1234' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
  });

  test('POST /auth/admin-login renders setup error when DB lookup fails', async () => {
    supabase.__state.maybeSingleError = { message: 'db down' };
    const app = makeApp();
    const res = await request(app)
      .post('/auth/admin-login')
      .type('form')
      .send({ username: 'admin', password: 'admin1234' });

    expect(res.status).toBe(200);
    expect(res.body.error).toContain('ไม่สามารถเตรียมบัญชีแอดมิน');
  });

  test('POST /auth/sync-user returns 400 when email missing', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/sync-user')
      .send({ name: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No email');
  });

  test('POST /auth/sync-user returns existing user when email matches', async () => {
    supabase.__users.push({ id: 'u1', username: 'a', email: 'a@example.com' });

    const app = makeApp();
    const res = await request(app)
      .post('/auth/sync-user')
      .send({ email: 'A@EXAMPLE.COM', name: 'A' });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(expect.objectContaining({ id: 'u1' }));
  });

  test('POST /auth/sync-user creates a new user when not found', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/auth/sync-user')
      .send({ email: 'new@example.com', name: 'New User' });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(expect.objectContaining({ email: 'new@example.com', role: 'user' }));
    expect(supabase.__users.some((u) => u.email === 'new@example.com')).toBe(true);
  });

  test('POST /auth/sync-user returns 500 when insert fails', async () => {
    supabase.__state.insertError = { message: 'insert fail' };
    const app = makeApp();
    const res = await request(app)
      .post('/auth/sync-user')
      .send({ email: 'new2@example.com', name: 'New User' });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('สร้าง user ไม่สำเร็จ');
  });

  test('POST /auth/sync-user returns 500 on unexpected select error', async () => {
    supabase.__state.throwFromUsers = true;
    const app = makeApp();
    const res = await request(app)
      .post('/auth/sync-user')
      .send({ email: 'boom@example.com', name: 'Boom' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('server error');
  });

  test('GET /auth/google renders login error when OAuth provider fails', async () => {
    supabase.__signInWithOAuth.mockResolvedValue({ data: null, error: { message: 'oauth failed' } });
    const app = makeApp();
    const res = await request(app).get('/auth/google');

    expect(res.status).toBe(200);
    expect(res.body.error).toContain('เกิดข้อผิดพลาด');
  });

  test('GET /auth/google uses production redirect host when not localhost', async () => {
    supabase.__signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/success' },
      error: null
    });
    const app = makeApp('example.com');
    const res = await request(app).get('/auth/google');

    expect(res.status).toBe(302);
    expect(supabase.__signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: 'https://fourkon.onrender.com/login?redirect=%2F'
        })
      })
    );
  });

  test('GET /auth/logout redirects home and calls Supabase signOut', async () => {
    const app = makeApp();
    const res = await request(app).get('/auth/logout');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    expect(supabase.__signOut).toHaveBeenCalled();
  });

  test('GET /auth/logout still redirects when signOut returns error', async () => {
    supabase.__state.signOutError = { message: 'cannot signout' };
    const app = makeApp();
    const res = await request(app).get('/auth/logout');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});
