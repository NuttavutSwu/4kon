const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../utils/supabase');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin1234';
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_SYSTEM_USERNAME = 'admin-system';
const ADMIN_SYSTEM_EMAIL = 'admin-system@local';

function isLocalHost(value = '') {
  return /(^|:\/\/)(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(value));
}

function resolveBaseUrl(req) {
  const configuredUrl = (
    process.env.PUBLIC_APP_URL ||
    process.env.PRODUCTION_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    ''
  ).trim();

  if (configuredUrl && !isLocalHost(configuredUrl)) {
    return configuredUrl.startsWith('http')
      ? configuredUrl
      : `https://${configuredUrl}`;
  }

  const forwardedHost = req.get('x-forwarded-host');
  const host = forwardedHost || req.get('host');
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto || (isLocalHost(host) ? 'http' : 'https');

  if (host) {
    return `${protocol}://${host}`;
  }

  return 'http://localhost:3000';
}

function joinUrl(base, path) {
  const cleanBase = String(base || '').replace(/\/+$/, '');
  const cleanPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
  return `${cleanBase}${cleanPath}`;
}

router.get('/admin-login', (req, res) => {
  res.render('admin-login', { error: null });
});
// 🔹 USER LOGIN
router.post('/login', async (req, res) => {
  return res.render('login', {
    error: 'ผู้ใช้ทั่วไปต้องเข้าสู่ระบบด้วย Google เท่านั้น',
    redirect: '/'
  });
});

// 🔹 แสดงหน้า ADMIN LOGIN (เพิ่มส่วนนี้เข้าไป)
router.get('/admin-login', (req, res) => {
  res.render('admin-login', { error: null });
});
// 🔹 ADMIN LOGIN
router.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.render('admin-login', {
      error: 'Admin username/password ไม่ถูกต้อง'
    });
  }

  let adminId = null;
  try {
    // Use existing "admin" row if present (avoids unique collisions).
    const { data: byUsername, error: byUsernameError } = await supabase
      .from('users')
      .select('id')
      .eq('username', ADMIN_USERNAME)
      .maybeSingle();

    if (byUsernameError) throw byUsernameError;
    if (byUsername?.id) {
      adminId = byUsername.id;
    } else {
      // Fallback to our dedicated system user id (may already exist).
      const { data: byFixedId, error: byFixedIdError } = await supabase
        .from('users')
        .select('id')
        .eq('id', ADMIN_USER_ID)
        .maybeSingle();

      if (byFixedIdError) throw byFixedIdError;
      if (byFixedId?.id) {
        adminId = byFixedId.id;
      } else {
        // Last resort: attempt to create a dedicated system user.
        const adminUser = {
          id: ADMIN_USER_ID,
          username: ADMIN_SYSTEM_USERNAME,
          email: ADMIN_SYSTEM_EMAIL,
          password: bcrypt.hashSync(uuidv4(), 10),
          role: 'admin',
          role_id: 1,
          created_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('users')
          .insert([adminUser]);

        if (insertError) throw insertError;
        adminId = ADMIN_USER_ID;
      }
    }
  } catch (err) {
    console.error(err);
    return res.render('admin-login', {
      error: 'ไม่สามารถเตรียมบัญชีแอดมินในฐานข้อมูลได้'
    });
  }

  req.session.user = {
    id: adminId,
    username: ADMIN_USERNAME,
    email: 'admin@local',
    role: 'admin'
  };

  return res.redirect('/admin');
});



// 🔹 GOOGLE LOGIN 
router.get('/google', async (req, res) => {
  try {
    const redirectPath = typeof req.query.redirect === 'string' && req.query.redirect.startsWith('/')
      ? req.query.redirect
      : '/';
    const callbackPath = `/login?redirect=${encodeURIComponent(redirectPath)}`;
    const baseUrl = resolveBaseUrl(req);
    const redirectTo = joinUrl(baseUrl, callbackPath);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'email profile',
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline'
        }
      }
    });

    if (error || !data?.url) {
      throw error || new Error('Missing Google OAuth URL');
    }

    return res.redirect(data.url);

  } catch (err) {
    console.error(err);
    return res.render('login', {
      error: 'เกิดข้อผิดพลาด',
      redirect: '/'
    });
  }
});


// 🔹 SYNC USER (NEW)
router.post('/sync-user', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'No email' });
    }

    const { data: users } = await supabase.from('users').select('*');

    let existingUser = users?.find(
      u => (u.email || '').toLowerCase() === email.toLowerCase()
    );

    if (!existingUser) {
      const baseUsername = name || email.split('@')[0];

      const username = users?.some(u => u.username === baseUsername)
        ? `${baseUsername}${Date.now().toString().slice(-4)}`
        : baseUsername;

      const newUser = {
        id: uuidv4(),
        username,
        email,
        password: bcrypt.hashSync(uuidv4(), 10),
        role: 'user',
        role_id: 2,
        created_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('users')
        .insert([newUser]);

      if (insertError) {
        console.error(insertError);
        return res.status(500).json({ error: 'สร้าง user ไม่สำเร็จ' });
      }

      existingUser = newUser;
    }

    req.session.user = existingUser;

    return res.json({ user: existingUser });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});



// 🔹 LOGOUT
router.get('/logout', async (req, res) => {
  // Sign out from Supabase to clear Google OAuth session
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Supabase sign out error:', error);
  }

  // Destroy local session
  req.session.destroy(() => {
    res.redirect('/');
  });
});


module.exports = router;
