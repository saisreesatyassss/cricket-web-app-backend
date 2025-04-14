const express = require("express");
const CricketUser = require("../models/CricketUser");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.put("/update-profile", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, education, stateOfResidence, gender, dateOfBirth } = req.body;

    await CricketUser.findOneAndUpdate(
      { userId: req.user.userId },
      { profilePage: { firstName, lastName, education, stateOfResidence, gender, dateOfBirth } },
      { new: true }
    );

    res.json({ message: "Profile updated successfully" });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


// GET PROFILE
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await CricketUser.findOne({ userId: req.user.userId });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Sending only the profile information
    const { firstName, lastName, education, stateOfResidence, gender, dateOfBirth } = user.profilePage;

    res.json({
      profile: {
        firstName,
        lastName,
        education,
        stateOfResidence,
        gender,
        dateOfBirth
      }
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
