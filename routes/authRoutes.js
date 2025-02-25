const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CricketUser = require('../models/CricketUser');
const authMiddleware = require('../middleware/authMiddleware');  
const { v4: uuidv4 } = require('uuid');  // Importing uuid

const router = express.Router();

// User Registration
router.post("/register", async (req, res) => {
  try {
    const { username, phoneNumber, password, email } = req.body;

    // Check if user already exists
    const existingUser = await CricketUser.findOne({ phoneNumber });
    if (existingUser) return res.status(400).json({ error: "Phone number already in use" });
    const userId = uuidv4();  // Create a new UUID

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new CricketUser({
      userId,
      username,
      phoneNumber,
      profilePage: { email },
      password: hashedPassword // This field must be in the schema
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });

  } catch (err) {
    console.error("Registration Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// User Login
router.post("/login", async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    // Find user
    const user = await CricketUser.findOne({ phoneNumber });
    if (!user) return res.status(400).json({ error: "User not found" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.userId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, user: { userId: user.userId, username: user.username, role: user.role } });

  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// User Profile (Protected Route)
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await CricketUser.findOne({ userId: req.user.userId }).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Profile Fetch Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
