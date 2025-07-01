// fantasy-cricket-backend.js
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require('../models/CricketUser');

const router = express.Router();
router.use(express.json());

// ==================== MODELS ====================


// Team Model
const teamSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'CricketUser', required: true },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  teamName: { type: String, required: true },
  players: [{ 
    playerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    isCaptain: { type: Boolean, default: false },
    isViceCaptain: { type: Boolean, default: false }
  }],
  totalPoints: { type: Number, default: 0 },
  rank: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Add compound index to ensure a user cannot create multiple teams with the same name for a match
teamSchema.index({ userId: 1, matchId: 1, teamName: 1 }, { unique: true });
// Add index to limit teams per user per match
teamSchema.index({ userId: 1, matchId: 1 });

const Team = mongoose.model("Team", teamSchema);

// Match Model
const matchSchema = new mongoose.Schema({
  matchName: { type: String, required: true },
  teams: [{ type: String, required: true }], // Real cricket teams playing
  venue: { type: String, required: true },
  matchDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ["upcoming", "live", "completed"], 
    default: "upcoming" 
  },
  players: [{ 
    name: { type: String, required: true },
    team: { type: String, required: true }, // Which real team they belong to
    role: { type: String, enum: ["batsman", "bowler", "all-rounder", "wicket-keeper"], required: true },
    points: { type: Number, default: 0 } // Points earned in the match
  }],
  entryFee: { type: Number, default: 0 },
  prizePool: { type: Number, default: 0 },
  maxTeamsPerUser: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'CricketUser', required: true },
});

const Match = mongoose.model("Match", matchSchema);

// Contest Model
const contestSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  name: { type: String, required: true },
  entryFee: { type: Number, required: true },
  totalSpots: { type: Number, required: true },
  filledSpots: { type: Number, default: 0 },
  prizePool: { type: Number, required: true },
  winnerDistribution: [{ 
    rank: { type: Number, required: true },
    percentage: { type: Number, required: true } // Percentage of prize pool
  }],
  teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  status: { 
    type: String, 
    enum: ["open", "closed", "completed"], 
    default: "open" 
  },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'CricketUser', required: true },
});

const Contest = mongoose.model("Contest", contestSchema);




// ==================== MIDDLEWARE ====================

// Authentication Middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    const user = await User.findOne({ userId: decoded.userId });

    if (!user) {
      return res.status(401).json({ error: "Authentication failed" });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
};



// Admin Middleware
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};





// ==================== HELPER FUNCTIONS ====================

// Helper function to calculate team points
async function calculateTeamPoints(matchId) {
  try {
    const match = await Match.findById(matchId);
    if (!match) return;

    const playerPointsMap = new Map();
    match.players.forEach(player => {
      playerPointsMap.set(player._id.toString(), player.points);
    });

    const teams = await Team.find({ matchId });
    
    for (const team of teams) {
      let totalPoints = 0;
      
      for (const player of team.players) {
        let playerPoints = playerPointsMap.get(player.playerId.toString()) || 0;
        
        // Apply multiplier for captain and vice-captain
        if (player.isCaptain) {
          playerPoints *= 2; // Captain gets 2x points
        } else if (player.isViceCaptain) {
          playerPoints *= 1.5; // Vice-captain gets 1.5x points
        }
        
        totalPoints += playerPoints;
      }
      
      team.totalPoints = totalPoints;
      await team.save();
    }
  } catch (error) {
    console.error("Error calculating team points:", error);
  }
}

// Helper function to update contest rankings
async function updateContestRankings(matchId) {
  try {
    const contests = await Contest.find({ matchId });
    
    for (const contest of contests) {
      // Get all teams in this contest with their points
      const teams = await Team.find({ _id: { $in: contest.teams } })
        .sort({ totalPoints: -1 });
      
      // Assign ranks (teams with equal points get the same rank)
      let currentRank = 1;
      let previousPoints = null;
      let teamsAtSameRank = 0;
      
      for (let i = 0; i < teams.length; i++) {
        if (previousPoints !== null && teams[i].totalPoints < previousPoints) {
          currentRank += teamsAtSameRank;
          teamsAtSameRank = 1;
        } else if (previousPoints !== null && teams[i].totalPoints === previousPoints) {
          teamsAtSameRank++;
        }
        
        teams[i].rank = currentRank;
        await teams[i].save();
        
        previousPoints = teams[i].totalPoints;
      }
      
      contest.status = "completed";
      await contest.save();
    }
  } catch (error) {
    console.error("Error updating contest rankings:", error);
  }
}




// ========== MATCH ROUTES ==========

// CREATE MATCH (Admin only)
router.post("/matches/create", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { matchName, teams, venue, matchDate, entryFee, prizePool, maxTeamsPerUser } = req.body;

    if (!matchName || !teams || !venue || !matchDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newMatch = new Match({
      matchName,
      teams,
      venue,
      matchDate: new Date(matchDate),
      entryFee: entryFee || 0,
      prizePool: prizePool || 0,
      maxTeamsPerUser: maxTeamsPerUser || 1,
      players: [], 
      createdBy: req.user._id
    });

    await newMatch.save();
    res.status(201).json({ 
      message: "Match created successfully", 
      matchId: newMatch._id 
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ error: "Match with this name already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});
router.post("/matches/:matchId/players", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { players } = req.body;

    if (!players || !Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ error: "Players array is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ error: "Invalid match ID" });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    if (new Date(match.matchDate) < new Date()) {
      return res.status(400).json({ error: "The match has already started" });
    }

    const maxPlayers = match.teams.length * 11; // 11 players per team
    if (match.players.length >= maxPlayers) {
      return res.status(400).json({ error: `The match already has ${maxPlayers} players` });
    }

    // Check for duplicate players
    const existingPlayerNames = new Set(match.players.map(p => p.name));
    for (const player of players) {
      if (!player.name || !player.team || !player.role) {
        return res.status(400).json({ error: "Each player must have name, team, and role" });
      }

      if (!["batsman", "bowler", "all-rounder", "wicket-keeper"].includes(player.role)) {
        return res.status(400).json({ error: "Invalid player role" });
      }

      if (!match.teams.includes(player.team)) {
        return res.status(400).json({ error: `Player team must be one of the match teams: ${match.teams.join(', ')}` });
      }

      if (existingPlayerNames.has(player.name)) {
        return res.status(400).json({ error: "No duplicates allowed" });
      }
    }

    // Ensure each team does not exceed 11 players
    for (const team of match.teams) {
      const currentTeamPlayers = match.players.filter(p => p.team === team).length;
      const newTeamPlayers = players.filter(p => p.team === team).length;

      if (currentTeamPlayers + newTeamPlayers > 11) {
        return res.status(400).json({ error: `Team ${team} cannot have more than 11 players` });
      }
    }

    // Add players if all checks pass
    match.players.push(...players);
    await match.save();

    res.json({
      message: "Players added successfully",
      totalPlayers: match.players.length, // Updated count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// UPDATE MATCH STATUS (Admin only)
router.patch("/matches/:matchId/status", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { status } = req.body;

    if (!status || !["upcoming", "live", "completed"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required" });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    match.status = status;
    await match.save();

    // If match is marked as completed, close all associated contests
    if (status === "completed") {
      await Contest.updateMany(
        { matchId: matchId, status: { $ne: "completed" } },
        { status: "closed" }
      );
    }

    res.json({ message: "Match status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE PLAYER POINTS (Admin only)
router.patch("/matches/:matchId/player-points", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { playerPoints } = req.body;

    if (!playerPoints || !Array.isArray(playerPoints)) {
      return res.status(400).json({ error: "Player points array is required" });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }

    if (match.status !== "completed") {
      return res.status(400).json({ error: "Cannot update points for match that is not completed" });
    }

    // Update points for each player
    const playerMap = new Map();
    for (const player of match.players) {
      playerMap.set(player._id.toString(), player);
    }

    for (const { playerId, points } of playerPoints) {
      if (!playerMap.has(playerId)) {
        return res.status(400).json({ error: `Player with ID ${playerId} not found in match` });
      }
      
      const playerIndex = match.players.findIndex(p => p._id.toString() === playerId);
      match.players[playerIndex].points = points;
    }

    await match.save();

    // Calculate and update points for all teams in this match
    await calculateTeamPoints(matchId);

    // Update rankings in all contests for this match
    await updateContestRankings(matchId);

    res.json({ message: "Player points updated and team rankings calculated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET ALL MATCHES
router.get("/matches", async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = {};
    if (status && ["upcoming", "live", "completed"].includes(status)) {
      query.status = status;
    }
    
    const matches = await Match.find(query)
      .select('matchName teams venue matchDate status entryFee prizePool')
      .sort({ matchDate: 1 });
    
    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
router.get("/usermatches", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    // Step 1: Find all matchIds where user has joined a team
    const userTeams = await Team.find({ userId }).select("matchId");

    const matchIds = [...new Set(userTeams.map(team => team.matchId.toString()))];

    // Step 2: Fetch those matches
    const matches = await Match.find({ _id: { $in: matchIds } })
      .select("matchName teams venue matchDate status entryFee prizePool")
      .sort({ matchDate: 1 });

    res.json(matches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET MATCH DETAILS
router.get("/matches/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }
    
    res.json(match);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET MATCH PLAYERS
router.get("/matches/:matchId/players", async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }
    
    res.json(match.players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ========== TEAM ROUTES ==========
router.post("/teams/create", authMiddleware, async (req, res) => {
  try {
    console.log("Request received with body:", req.body);

    const { matchId, teamName, players } = req.body;

    if (!matchId || !teamName || !players) {
      console.error("Validation failed: Missing required fields");
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if match exists and is not completed
    const match = await Match.findById(matchId);
    if (!match) {
      console.error(`Match not found with ID: ${matchId}`);
      return res.status(404).json({ error: "Match not found" });
    }

    if (match.status === "completed") {
      console.error(`Match is completed. ID: ${matchId}`);
      return res.status(400).json({ error: "Cannot create team for completed match" });
    }

    // Check if user has reached the maximum teams limit for this match
    const userTeamsCount = await Team.countDocuments({ 
      userId: req.user._id, 
      matchId 
    });
    
    console.log(`User has already created ${userTeamsCount} teams for match ID ${matchId}`);

    if (userTeamsCount >= match.maxTeamsPerUser) {
      console.error(`User exceeded max teams limit for match ID ${matchId}`);
      return res.status(400).json({ 
        error: `You have reached the maximum limit of ${match.maxTeamsPerUser} teams for this match` 
      });
    }

    // Validate team size
    if (!Array.isArray(players) || players.length !== 11) {
      console.error(`Invalid team size. Received ${players.length} players`);
      return res.status(400).json({ error: "Team must have exactly 11 players" });
    }

    // Check captain and vice-captain
    const captainCount = players.filter(p => p.isCaptain).length;
    const viceCaptainCount = players.filter(p => p.isViceCaptain).length;

    if (captainCount !== 1) {
      console.error(`Invalid captain count: ${captainCount}`);
      return res.status(400).json({ error: "Team must have exactly 1 captain" });
    }
    
    if (viceCaptainCount !== 1) {
      console.error(`Invalid vice-captain count: ${viceCaptainCount}`);
      return res.status(400).json({ error: "Team must have exactly 1 vice-captain" });
    }

    if (players.some(p => p.isCaptain && p.isViceCaptain)) {
      console.error("Captain and vice-captain are the same player");
      return res.status(400).json({ error: "Captain and vice-captain must be different players" });
    }

    // Convert match players to a usable format
    const matchPlayers = match.players.map(p => ({
      id: p._id.toString(),
      role: p.role,
      team: p.team
    }));

    console.log("Match players:", matchPlayers);

    // Validate that all players exist in the match
    const matchPlayerIds = matchPlayers.map(p => p.id);
    const invalidPlayers = players.filter(p => !matchPlayerIds.includes(p.playerId));

    if (invalidPlayers.length > 0) {
      console.error(`Invalid players selected: ${invalidPlayers.map(p => p.playerId).join(', ')}`);
      return res.status(400).json({ 
        error: `Invalid players: ${invalidPlayers.map(p => p.playerId).join(', ')}` 
      });
    }

    // Validate role requirements
    const selectedPlayers = players.map(p => {
      const matchPlayer = matchPlayers.find(mp => mp.id === p.playerId);
      return {
        ...p,
        actualRole: matchPlayer.role,
        team: matchPlayer.team
      };
    });

    const playersByRole = {
      "wicket-keeper": selectedPlayers.filter(p => p.actualRole === "wicket-keeper").length,
      "batsman": selectedPlayers.filter(p => p.actualRole === "batsman").length,
      "bowler": selectedPlayers.filter(p => p.actualRole === "bowler").length,
      "all-rounder": selectedPlayers.filter(p => p.actualRole === "all-rounder").length
    };

    console.log("Players by role:", playersByRole);

    if (playersByRole["wicket-keeper"] < 1) {
      console.error("Team must have at least 1 wicket-keeper");
      return res.status(400).json({ error: "Team must have at least 1 wicket-keeper" });
    }

    // Limit players from a single team
    const playersByTeam = {};
    for (const player of selectedPlayers) {
      playersByTeam[player.team] = (playersByTeam[player.team] || 0) + 1;
    }

    for (const team in playersByTeam) {
      if (playersByTeam[team] > 7) {
        console.error(`Too many players from team ${team}: ${playersByTeam[team]}`);
        return res.status(400).json({ 
          error: `Maximum 7 players allowed from a single team, you have selected ${playersByTeam[team]} from ${team}` 
        });
      }
    }

    // Prepare players for saving
      const playersToSave = players.map(p => {
        const matchPlayer = matchPlayers.find(mp => mp.id === p.playerId);
        return {
          playerId: p.playerId,
          name: p.name, // Add name field
          role: matchPlayer.role,
          isCaptain: p.isCaptain || false,
          isViceCaptain: p.isViceCaptain || false
        };
      });


    // Check for duplicate team name
    const existingTeam = await Team.findOne({
      userId: req.user._id,
      matchId,
      teamName
    });

    if (existingTeam) {
      console.error(`Duplicate team name for match ID ${matchId}`);
      return res.status(400).json({ error: "You already have a team with this name for this match" });
    }

    // Create team
    const newTeam = new Team({
      userId: req.user._id,
      matchId,
      teamName,
      players: playersToSave,
      totalPoints: 0,
      rank: 0
    });

    await newTeam.save();

    console.log(`Team created successfully: ID ${newTeam._id}`);
    res.status(201).json({ 
      message: "Team created successfully", 
      teamId: newTeam._id 
    });
  } catch (err) {
    console.error("Team creation error:", err);
    if (err.code === 11000) {
      console.error("Duplicate key error:", err.message);
      return res.status(400).json({ error: "You already have a team with this name for this match" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// UPDATE USER TEAM
router.put("/teams/:teamId", authMiddleware, async (req, res) => {
  try {
    const { teamId } = req.params;
    const { teamName, players } = req.body;

    // Find the team and verify ownership
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    if (team.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to update this team" });
    }

    // Check if match is still upcoming
    const match = await Match.findById(team.matchId);
    if (!match || match.status !== "upcoming") {
      return res.status(400).json({ error: "Teams can only be updated for upcoming matches" });
    }

    // Validate players if being updated
    if (players) {
      // All the same validations as in the create endpoint
      if (!Array.isArray(players) || players.length !== 11) {
        return res.status(400).json({ error: "Team must have exactly 11 players" });
      }

      const captainCount = players.filter(p => p.isCaptain).length;
      const viceCaptainCount = players.filter(p => p.isViceCaptain).length;
      
      if (captainCount !== 1) {
        return res.status(400).json({ error: "Team must have exactly 1 captain" });
      }
      
      if (viceCaptainCount !== 1) {
        return res.status(400).json({ error: "Team must have exactly 1 vice-captain" });
      }

      if (players.some(p => p.isCaptain && p.isViceCaptain)) {
        return res.status(400).json({ error: "Captain and vice-captain must be different players" });
      }

      // Validate that all players exist in the match
      const matchPlayerIds = match.players.map(p => p._id.toString());
      for (const player of players) {
        if (!matchPlayerIds.includes(player.playerId)) {
          return res.status(400).json({ error: `Player ${player.playerId} is not part of this match` });
        }
      }

      // Validate player roles
      const playersByRole = {
        "wicket-keeper": players.filter(p => p.role === "wicket-keeper").length,
        "batsman": players.filter(p => p.role === "batsman").length,
        "bowler": players.filter(p => p.role === "bowler").length,
        "all-rounder": players.filter(p => p.role === "all-rounder").length
      };

      if (playersByRole["wicket-keeper"] < 1) {
        return res.status(400).json({ error: "Team must have at least 1 wicket-keeper" });
      }
      
      // if (playersByRole["batsman"] < 3) {
      //   return res.status(400).json({ error: "Team must have at least 3 batsmen" });
      // }
      
      // if (playersByRole["bowler"] < 3) {
      //   return res.status(400).json({ error: "Team must have at least 3 bowlers" });
      // }
      
      // if (playersByRole["all-rounder"] < 1) {
      //   return res.status(400).json({ error: "Team must have at least 1 all-rounder" });
      // }

      // Check team distribution
      const playersByTeam = {};
      for (const player of players) {
        const matchPlayer = match.players.find(p => p._id.toString() === player.playerId);
        playersByTeam[matchPlayer.team] = (playersByTeam[matchPlayer.team] || 0) + 1;
      }

      for (const team in playersByTeam) {
        if (playersByTeam[team] > 7) {
          return res.status(400).json({ error: `Maximum 7 players allowed from a single team, you have selected ${playersByTeam[team]} from ${team}` });
        }
      }

      team.players = players;
    }

    // Update team name if provided
    if (teamName) {
      team.teamName = teamName;
    }

    await team.save();
    res.json({ message: "Team updated successfully" });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ error: "You already have a team with this name for this match" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// GET USER TEAMS
 
router.get("/teams/my-teams", authMiddleware, async (req, res) => {
  try {
    const { matchId } = req.query;

    const query = { userId: req.user._id };
    if (matchId) {
      query.matchId = matchId;
    }

    const teams = await Team.find(query).sort({ createdAt: -1 }).lean();

    const matchIds = teams.map(team => team.matchId);

    const matches = await Match.find({ _id: { $in: matchIds } }).lean();

    // Build a map of playerId => { team, points }
    const matchPlayerMap = new Map();

    matches.forEach(match => {
      match.players.forEach(player => {
        matchPlayerMap.set(player._id.toString(), {
          team: player.team,
          points: player.points || 0,
        });
      });
    });

    // Enrich each team's players with their real team name and points
    const enrichedTeams = teams.map(team => {
      team.players = team.players.map(player => {
        const full = matchPlayerMap.get(player.playerId.toString()) || {};
        return {
          ...player,
          team: full.team || '',
          points: full.points ?? 0,
        };
      });
      return team;
    });

    res.json(enrichedTeams);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET TEAM DETAILS
router.get("/teams/:teamId", authMiddleware, async (req, res) => {
  try {
    const { teamId } = req.params;
    
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }
    
    // Check if user is authorized to view team details
    // (only team owner or admin can view detailed team)
    if (team.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized to view this team" });
    }
    
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

 
module.exports = router;
