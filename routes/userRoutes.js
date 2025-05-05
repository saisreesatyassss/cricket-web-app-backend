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


// // GET PROFILE
// router.get("/profile", authMiddleware, async (req, res) => {
//   try {
//     const user = await CricketUser.findOne({ userId: req.user.userId });

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Sending only the profile information
//     const { firstName, lastName, education, stateOfResidence, gender, dateOfBirth } = user.profilePage;

//     res.json({
//       profile: {
//         firstName,
//         lastName,
//         education,
//         stateOfResidence,
//         gender,
//         dateOfBirth
//       }
//     });

//   } catch (err) {
//     res.status(500).json({ error: "Server error" });
//   }
// });


router.get("/profile", authMiddleware, async (req, res) => {
  try {
    // Fetch user by userId from token, exclude password only
    const user = await CricketUser.findOne({ userId: req.user.userId }).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return complete user object
    res.status(200).json({
      userId: user.userId,
      uniqueId: user.uniqueId,
      username: user.username,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
      role: user.role,
      createdAt: user.createdAt,
      referral: user.referral,

      profilePage: {
        firstName: user.profilePage.firstName,
        lastName: user.profilePage.lastName,
        profilePicture: user.profilePage.profilePicture,
        education: user.profilePage.education,
        gender: user.profilePage.gender,
        stateOfResidence: user.profilePage.stateOfResidence,
        email: user.profilePage.email,
        dateOfBirth: user.profilePage.dateOfBirth,
      },

      wallet: {
        withdrawable: user.wallet.withdrawable || 0,
        nonWithdrawable: user.wallet.nonWithdrawable || 0,
        isWalletFunded: user.wallet.isWalletFunded,
      },

      panCardVerified: user.panCardVerified,
      panCardNumber: user.panCardNumber,
      panCardImages: user.panCardImages,
    });
  } catch (err) {
    console.error("Profile Fetch Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
