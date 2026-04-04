require('dotenv').config(); // ต้องอยู่บรรทัดแรกสุด
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3000;

// เชื่อมต่อกับ Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ใช้ตัวนี้ตัวเดียวพอ
app.use(express.static('public'));

app.use((req, res, next) => {
    res.locals.currentUser = null;
    next();
});
app.use((req, res, next) => {
    res.locals.currentUser = null;
    next();
});

// Route สำหรับหน้า Register (GET)
const bcrypt = require('bcrypt');

app.post('/register', async (req, res) => {
    const { email, username, password, confirm_password } = req.body;

    if (password !== confirm_password) {
        return res.send("<script>alert('รหัสผ่านไม่ตรงกัน!'); window.history.back();</script>");
    }

    // 🔥 hash password ตรงนี้
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
        .from('users')
        .insert([
            { 
                email: email, 
                username: username, 
                password: hashedPassword, 
                role_id: 2
            }
        ]);

    if (error) {
        console.error(error);
        return res.send("Error");
    }

    res.send("<script>alert('สมัครสำเร็จ'); window.location='/login';</script>");
});


app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});


// Route สำหรับรับข้อมูล Login (POST)
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // 🔍 หา user ก่อน (ไม่ต้องเช็ค password)
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

    if (error || !user) {
        return res.send("<script>alert('ไม่พบผู้ใช้'); window.history.back();</script>");
    }

    // 🔥 เทียบ password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return res.send("<script>alert('รหัสผ่านผิด'); window.history.back();</script>");
    }

    // ✅ login สำเร็จ
    res.send("<script>alert('เข้าสู่ระบบสำเร็จ'); window.location='/dashboard';</script>");
});
app.get('/about', (req, res) => {
    res.render('about', { 
        title: 'About Us',
        currentUser: null // 🔥 ใส่ตัวนี้
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/register`);
});