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
app.use('/css', express.static(path.join(__dirname, 'css')));

// Route สำหรับหน้า Register (GET)
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'Register.html'));
});

// Route สำหรับรับข้อมูลและบันทึกลง Database (POST)
app.post('/register', async (req, res) => {
    const { email, username, password, confirm_password } = req.body;

    // 1. เช็คว่ารหัสผ่านตรงกันไหม
    if (password !== confirm_password) {
        return res.send("<script>alert('รหัสผ่านไม่ตรงกัน!'); window.history.back();</script>");
    }

    // 2. ส่งข้อมูลไปที่ Supabase ตาราง users
    const { data, error } = await supabase
        .from('users')
        .insert([
            { 
                email: email, 
                username: username, 
                password: password, 
                role_id: 2 // ค่า Default สำหรับ Member
            }
        ]);

    if (error) {
        console.error("Database Error:", error.message);
        return res.status(500).send("เกิดข้อผิดพลาด: " + error.message);
    }

    // 3. ถ้าสำเร็จ ให้เด้งไปหน้า Login
    res.send("<script>alert('สมัครสมาชิกสำเร็จ!'); window.location.href='/login';</script>");
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/register`);
});