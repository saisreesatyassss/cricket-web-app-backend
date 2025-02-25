const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Team Schema
const teamSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  teamName: { type: String, required: true },
  players: [{ name: String, role: String }],
  createdAt: { type: Date, default: Date.now },
});

const Team = mongoose.model("Team", teamSchema);

// CREATE TEAM
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { teamName, players } = req.body;

    const newTeam = new Team({
      userId: req.user.userId,
      teamName,
      players,
    });

    await newTeam.save();
    res.json({ message: "Team created successfully" });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// FETCH USER TEAMS
router.get("/my-teams", authMiddleware, async (req, res) => {
  try {
    const teams = await Team.find({ userId: req.user.userId });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
