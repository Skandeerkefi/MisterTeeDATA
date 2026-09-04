const express = require("express");
const router = express.Router();
const { User } = require("../models/User");

// Points leaderboard
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, type = "balance" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortField = type === "lifetime" ? "lifetimePointsEarned" : "pointsBalance";

    const users = await User.find({ isActive: true })
      .select("kickUsername discordUsername pointsBalance lifetimePointsEarned")
      .sort({ [sortField]: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments({ isActive: true });

    // Add rank to each user
    const ranked = users.map((u, i) => ({
      rank: skip + i + 1,
      kickUsername: u.kickUsername,
      pointsBalance: u.pointsBalance,
      lifetimePointsEarned: u.lifetimePointsEarned,
    }));

    res.json({ leaderboard: ranked, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Top 3 for podium display
router.get("/top3", async (req, res) => {
  try {
    const { type = "balance" } = req.query;
    const sortField = type === "lifetime" ? "lifetimePointsEarned" : "pointsBalance";
    const top3 = await User.find({ isActive: true })
      .select("kickUsername pointsBalance lifetimePointsEarned")
      .sort({ [sortField]: -1 })
      .limit(3);
    res.json(top3.map((u, i) => ({ rank: i + 1, kickUsername: u.kickUsername, points: sortField === "lifetimePointsEarned" ? u.lifetimePointsEarned : u.pointsBalance })));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;