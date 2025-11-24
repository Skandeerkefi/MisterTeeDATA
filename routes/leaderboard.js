const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController.js");

// Normal leaderboards
router.get("/", leaderboardController.getLeaderboard);
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);

// NEW CSGOWIN LEADERBOARD API
router.get("/csgowin", async (req, res) => {
	try {
		const code = "mistertee";
		const url = `https://api.csgowin.com/api/leaderboard/${code}`;

		const response = await fetch(url, {
			headers: { "x-apikey": "108adfb76a" },
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(text || "Failed to fetch CSGOWin leaderboard");
		}

		const data = await response.json();
		res.json(data);

	} catch (err) {
		console.error("CSGOWin leaderboard fetch error:", err.message);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
