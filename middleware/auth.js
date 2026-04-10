function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'ไม่มีสิทธิ์เข้าถึงหน้านี้' });
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
