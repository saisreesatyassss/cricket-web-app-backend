const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CricketUser = require('../models/CricketUser');
const authMiddleware = require('../middleware/authMiddleware');  
const { v4: uuidv4 } = require('uuid');  // Importing uuid

const router = express.Router();
const startTime = Date.now();

// User Registration


router.post("/register", async (req, res) => {
  try {
    console.log("Start Registration Process");

    const { username, phoneNumber, password, email } = req.body;
    const generatedUUID = uuidv4();
    const generatedUniqueId = uuidv4(); // Generate uniqueId

    // Check if user already exists
    console.log("Checking for existing user...");
    const existingUser = await CricketUser.findOne({ phoneNumber });
    if (existingUser) return res.status(400).json({ error: "Phone number already in use" });

    // Hash password
    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    console.log("Creating new user...");
    const newUser = new CricketUser({
      userId: generatedUUID,
      uniqueId: generatedUniqueId, // Assign generated uniqueId
      username,
      phoneNumber,
      profilePage: { email },
      password: hashedPassword,
    });

    await newUser.save();
    console.log("User created successfully.");

    // Create JWT token
    const token = jwt.sign(
      { userId: newUser.userId, uniqueId: newUser.uniqueId, role: newUser.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("User registration completed.");

    // Return the response with token and user data
    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        userId: newUser.userId,
        uniqueId: newUser.uniqueId,
        username: newUser.username,
        role: newUser.role || "user",
      },
    });

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
      { expiresIn: "7d" }
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


router.post("/verify-phone", async (req, res) => {
  try {
    const { uniqueId, phoneNumber } = req.body;

    if (!uniqueId || !phoneNumber) {
      return res.status(400).json({ error: "Unique ID and phone number are required" });
    }

    // Find user by uniqueId and phoneNumber
    const user = await CricketUser.findOne({ userId: uniqueId, phoneNumber });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Check if phone number is already verified
    if (user.phoneNumberVerified) {
      return res.status(400).json({ message: "Phone number already verified" });
    }

    // Update phoneNumberVerified to true
    user.phoneNumberVerified = true;
    await user.save();

    res.status(200).json({ message: "Phone number verified successfully" });

  } catch (err) {
    console.error("Phone Verification Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});



router.get("/check-phone-verification", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by uniqueId from the decoded token
    const user = await CricketUser.findOne({ uniqueId: decoded.uniqueId });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({ 
      phoneNumberVerified: user.phoneNumberVerified, 
      message: user.phoneNumberVerified ? "Phone number is verified" : "Phone number is not verified"
    });

  } catch (err) {
    console.error("Check Verification Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/store-pan", async (req, res) => {
  try {
    const { panCardNumber } = req.body;
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by userId from token
    const user = await CricketUser.findOne({ userId: decoded.userId });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Store PAN card number
    user.panCardNumber = panCardNumber;
    await user.save();

    res.status(200).json({ message: "PAN card number stored successfully" });

  } catch (err) {
    console.error("PAN Card Storage Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
