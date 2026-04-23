const express = require('express');
const request = require('supertest');

jest.mock('../utils/supabase', () => ({
  auth: {
    signInWithOAuth: jest.fn()
  }
}));

const supabase = require('../utils/supabase');
const authRouter = require('../routes/auth');

function makeApp(host = 'localhost:3000') {
  const app = express();

  app.use((req, res, next) => {
    req.session = {};
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
          redirectTo: 'http://localhost:3000'
        })
      })
    );
  });
});
