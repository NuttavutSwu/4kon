const { requireLogin, requireAdmin } = require('../middleware/auth');

function createRes() {
  return {
    redirect: jest.fn()
  };
}

describe('middleware/auth', () => {
  test('requireLogin redirects to /login when not logged in', () => {
    const req = { session: {}, originalUrl: '/products/add' };
    const res = createRes();
    const next = jest.fn();

    requireLogin(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/login?redirect=' + encodeURIComponent('/products/add'));
    expect(next).not.toHaveBeenCalled();
  });

  test('requireLogin calls next when logged in', () => {
    const req = { session: { user: { id: 'u1' } }, originalUrl: '/wishlist' };
    const res = createRes();
    const next = jest.fn();

    requireLogin(req, res, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('requireAdmin redirects to /admin-login when not admin', () => {
    const cases = [
      { session: {} },
      { session: { user: { id: 'u1', role: 'user' } } }
    ];

    for (const req of cases) {
      const res = createRes();
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/auth/admin-login');
      expect(next).not.toHaveBeenCalled();
    }
  });

  test('requireAdmin calls next when admin', () => {
    const req = { session: { user: { id: 'admin', role: 'admin' } } };
    const res = createRes();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

