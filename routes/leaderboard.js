const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController.js");

// Get leaderboard with optional date range
router.get("/", leaderboardController.getLeaderboard);

// Get leaderboard for a specific date range
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);

module.exports = router;
