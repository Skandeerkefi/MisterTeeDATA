const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController.js");
const fetch = require("node-fetch");
// Get leaderboard with optional date range
router.get("/", leaderboardController.getLeaderboard);


// Get leaderboard for a specific date range
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);
router.get("/csgowin", async (req, res) => {
	try {
		const { take = 10, skip = 0, startDate, endDate } = req.query;

		// Use provided gt/lt or default to last 7 days
		const gt = startDate
			? parseInt(startDate)
			: Date.now() - 7 * 24 * 60 * 60 * 1000;
		const lt = endDate ? parseInt(endDate) : Date.now();

		const params = new URLSearchParams({
			code: "mistertee",
			gt,
			lt,
			by: "wager",
			sort: "desc",
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
