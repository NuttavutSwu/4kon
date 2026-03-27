const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(express.json());

// ================== CONFIG ==================
const JWT_SECRET = "mysecretkey";

// ================== DB ==================
mongoose.connect("mongodb://127.0.0.1:27017/role_demo");

// ================== MODEL ==================
const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
});

const User = mongoose.model("User", UserSchema);

// ================== HELPER ==================
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// ================== MIDDLEWARE ==================
const auth = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "No token" });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden (no permission)" });
    }
    next();
  };
};

// ================== ROUTES ==================

// ✅ Register
app.post("/register", async (req, res) => {
  const { email, password, role } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hashed,
    role: role || "user", // optional assign admin
  });

  res.json({ message: "Registered", user });
});

// ✅ Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Wrong password" });

  const token = generateToken(user);

  res.json({ token });
});

// ✅ User route (login ก็พอ)
app.get("/profile", auth, (req, res) => {
  res.json({
    message: "User profile",
    user: req.user,
  });
});

// ✅ Admin only
app.post("/admin-only", auth, checkRole("admin"), (req, res) => {
  res.json({
    message: "Welcome Admin 🎉",
  });
});

// ✅ Both admin & user
app.get("/products", auth, checkRole("admin", "user"), (req, res) => {
  res.json({
    message: "All products (for everyone logged in)",
  });
});

// ================== START ==================
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});