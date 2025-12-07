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
/*  -----------------------------------------------
    🆕 NEW CLASH LEADERBOARD SUMMARY API
    ----------------------------------------------- */

let clashCache = null;
let clashCacheTimestamp = 0;
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes caching

router.get("/clash/:sinceDate", async (req, res) => {
	try {
		const sinceDate = req.params.sinceDate || "2023-01-01";
		const url = `https://api.clash.gg/affiliates/detailed-summary/v2/${sinceDate}`;

		// Check cache
		if (clashCache && Date.now() - clashCacheTimestamp < CACHE_TIME) {
			return res.json(clashCache);
		}

		const response = await fetch(url, {
			headers: {
				"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NzYwNDYwLCJpYXQiOjE3NjUwNTQxOTYsImV4cCI6MTkyMjg0MjE5Nn0.r41izt3dIKfI-O6pwEOspV5n0OPYL-sbh7k2-1KTIuI",
				"Cookie": "let-me-in=top-secret-cookie-do-not-share"
			}
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(text || "Failed to fetch Clash leaderboard");
		}

		const data = await response.json();

		// Save to cache
		clashCache = data;
		clashCacheTimestamp = Date.now();

		res.json(data);

	} catch (err) {
		console.error("Clash leaderboard fetch error:", err.message);
		res.status(500).json({ error: err.message });
	}
});



module.exports = router;
