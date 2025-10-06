const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController.js");

// Get leaderboard with optional date range
router.get("/", leaderboardController.getLeaderboard);

// Get leaderboard for a specific date range
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);
router.get("/csgowin", async (req, res) => {
  try {
    const { take = 10, skip = 0 } = req.query;

    const params = new URLSearchParams({
      code: "mistertee",
      gt: new Date("2025").getTime(), // start date
      lt: Date.now(), // end date
      by: "wager", // can be createdAt | deposited | name | wager
      sort: "desc", // asc | desc
      search: "",
      take,
      skip,
    });

    const url = `https://api.csgowin.com/api/affiliate/external?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        "x-apikey": "108adfb76a",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to fetch leaderboard");
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("CSGOWin leaderboard fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
