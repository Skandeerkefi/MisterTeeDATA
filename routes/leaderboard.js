const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController.js");
const fetch = require("node-fetch");
// Get leaderboard with optional date range
router.get("/", leaderboardController.getLeaderboard);
const CSGOWinLeaderboard = require("../models/CSGOWinLeaderboard");

// Get leaderboard for a specific date range
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);
let lastUpdate = 0;
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function updateLeaderboard(take = 10, skip = 0) {
	const now = Date.now();
	if (now - lastUpdate < UPDATE_INTERVAL) {
		console.log("Using cached leaderboard");
		return; // Don't update if last update < 5min
	}

	try {
		const gt = Date.now() - 7 * 24 * 60 * 60 * 1000; // last 7 days
		const lt = Date.now();

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
			headers: { "x-apikey": "108adfb76a" },
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(text || "Failed to fetch leaderboard");
		}

		const data = await response.json();

		// Optional: clear old data or upsert
		await CSGOWinLeaderboard.deleteMany({});
		const formattedData = data.map((item, index) => ({
			username: item.username || item.user || `User${index + 1}`,
			wager: item.wager,
			rank: index + 1,
			updatedAt: new Date(),
		}));

		await CSGOWinLeaderboard.insertMany(formattedData);
		lastUpdate = now;
		console.log("Leaderboard updated!");
	} catch (err) {
		console.error("CSGOWin fetch/update error:", err.message);
	}
}

// Route to get leaderboard from DB
router.get("/csgowin", async (req, res) => {
	try {
		const { take = 10, skip = 0 } = req.query;

		// Update DB if needed
		await updateLeaderboard(take, skip);

		const leaderboard = await CSGOWinLeaderboard.find()
			.sort({ rank: 1 })
			.skip(parseInt(skip))
			.limit(parseInt(take));

		res.json(leaderboard);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
