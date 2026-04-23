/**
 * Express middleware that requires a logged-in session user.
 *
 * Redirects to `/login?redirect=<originalUrl>` when no session user exists.
 *
 * @param {import('express').Request & { session?: { user?: { id: string, role?: string } } }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

/**
 * Express middleware that requires an admin session user.
 *
 * Redirects to `/auth/admin-login` when not logged in or not an admin.
 *
 * @param {import('express').Request & { session?: { user?: { id: string, role?: string } } }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    // แก้จาก '/admin-login' เป็น '/auth/admin-login'
    return res.redirect('/auth/admin-login');
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
