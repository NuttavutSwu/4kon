function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    // แก้จาก '/admin-login' เป็น '/auth/admin-login'
    return res.redirect('/auth/admin-login');
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
