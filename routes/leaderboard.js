const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController.js");
const fetch = require("node-fetch");
// Get leaderboard with optional date range
router.get("/", leaderboardController.getLeaderboard);

// Get leaderboard for a specific date range
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);
// Cache variables
let cachedLeaderboard = null;
let lastFetch = 0;
const CACHE_DURATION = 30 * 1000; // 30 seconds

router.get("/csgowin", async (req, res) => {
	try {
		const now = Date.now();

		// Serve cached data if still valid
		if (cachedLeaderboard && now - lastFetch < CACHE_DURATION) {
			return res.json(cachedLeaderboard);
		}

		const { take = 10, skip = 0 } = req.query;
		const params = new URLSearchParams({
			code: "mistertee",
			gt: new Date("2025").getTime().toString(),
			lt: Date.now().toString(),
			by: "wager",
			sort: "desc",
			search: "",
			take: take.toString(),
			skip: skip.toString(),
		});

		const url = `https://api.csgowin.com/api/affiliate/external?${params.toString()}`;
		const response = await fetch(url, {
			headers: { "x-apikey": "108adfb76a" },
		});

		const text = await response.text();

		if (!response.ok) {
			console.error("CSGOWin API error:", text);
			return res.status(response.status).json({ error: text });
		}

		let data;
		try {
			data = JSON.parse(text);
		} catch (err) {
			console.error("Failed to parse API response:", err);
			return res.status(500).json({ error: "Invalid API response" });
		}

		// Update cache
		cachedLeaderboard = data;
		lastFetch = now;

		res.json(data);
	} catch (err) {
		console.error("CSGOWin leaderboard fetch error:", err.message);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
