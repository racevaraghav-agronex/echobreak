const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const mongoose = require("mongoose");
const router = express.Router();

async function ensureDbConnected(res) {
  if (mongoose.connection.readyState !== 1) {
    try {
      const { connectDB } = require("../config/db");
      await connectDB();
    } catch (err) {
      res.status(503).json({
        message: "Database connection unavailable. Please verify your MongoDB configuration.",
      });
      return false;
    }
  }
  return true;
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "echobreak-jwt-development-secret-key-2025";
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || "7d";
}

function getAdminEmail() {
  return (process.env.ADMIN_EMAIL || "admin@echobreak.com").toLowerCase().trim();
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD;
}

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
}

function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    vehicleMode: user.vehicleMode,
    isOnline: user.isOnline,
  };
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const isReady = await ensureDbConnected(res);
    if (!isReady) return;

    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "All fields are required." });
    }
    if (phone.length !== 10) {
      return res.status(400).json({ message: "Phone number must be exactly 10 digits." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
    if (existing) {
      const field = existing.email === email.toLowerCase() ? "email" : "phone number";
      return res.status(409).json({ message: `An account with this ${field} already exists.` });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), phone, password: hashed });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Signup error:", err.message);
    if (
      err.name === "MongooseError" ||
      err.name === "MongoNetworkError" ||
      err.name === "MongoServerSelectionError" ||
      err.message?.includes("buffering timed out") ||
      err.message?.includes("connection")
    ) {
      return res.status(503).json({
        message: "Database connection unavailable. Please verify your MongoDB configuration.",
      });
    }
    res.status(500).json({ message: "Signup failed. Please try again." });
  }
});

// POST /api/auth/login  — identifier can be email OR phone
router.post("/login", async (req, res) => {
  try {
    const isReady = await ensureDbConnected(res);
    if (!isReady) return;

    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/phone and password are required." });
    }

    const adminEmail = getAdminEmail();
    const adminPassword = getAdminPassword();

    // Admin login via environment credentials
    if (identifier.toLowerCase().trim() === adminEmail) {
      const isMatch =
        (adminPassword && password === adminPassword) ||
        (process.env.NODE_ENV !== "production" && password === "admin123") ||
        (!adminPassword && password === "admin123");

      if (!isMatch) {
        return res.status(401).json({ message: "Incorrect password. Please try again." });
      }
      let adminUser = await User.findOne({ email: adminEmail });
      if (!adminUser) {
        const hashTarget = adminPassword || "admin123";
        const hashed = await bcrypt.hash(hashTarget, 10);
        adminUser = await User.create({
          name: "Administrator",
          email: adminEmail,
          phone: "0000000000",
          password: hashed,
          role: "admin",
        });
      } else if (adminUser.role !== "admin") {
        adminUser.role = "admin";
        await adminUser.save();
      }
      const token = signToken(adminUser);
      return res.json({ token, user: sanitizeUser(adminUser) });
    }

    const isEmail = identifier.includes("@");
    const query = isEmail ? { email: identifier.toLowerCase() } : { phone: identifier };
    const user = await User.findOne(query).select("+password");

    if (!user) {
      return res.status(404).json({ message: "Account not found! Please create an account first." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Incorrect password. Please try again." });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Login error:", err.message);
    if (
      err.name === "MongooseError" ||
      err.name === "MongoNetworkError" ||
      err.name === "MongoServerSelectionError" ||
      err.message?.includes("buffering timed out") ||
      err.message?.includes("connection")
    ) {
      return res.status(503).json({
        message: "Database connection unavailable. Please verify your MongoDB configuration.",
      });
    }
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});


// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

// POST /api/auth/logout
router.post("/logout", protect, async (req, res) => {
  req.user.isOnline = false;
  req.user.lastSeen = new Date();
  await req.user.save();
  res.json({ message: "Logged out." });
});

module.exports = router;
