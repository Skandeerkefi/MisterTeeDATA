const express = require("express");
const router = express.Router();
const axios = require("axios");
const { getRoobetAffiliates } = require("../controllers/roobetController.js");
router.get("/:start_at/:end_at", getRoobetAffiliates);


let csgoCache = {
	data: null,
	timestamp: 0
};
let clashCache = null;
let clashCacheTimestamp = 0;
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
router.get("/csgowin", async (req, res) => {
	try {
		const now = Date.now();

		// Cache duration (5 minutes)
		const CACHE_DURATION = 5 * 60 * 1000;

		// Serve from cache if still valid
		if (csgoCache.data && now - csgoCache.timestamp < CACHE_DURATION) {
			return res.json(csgoCache.data);
		}

		// ============================
		// API REQUEST (SERVER ONLY)
		// ============================
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

		// Save to cache
		csgoCache = {
			data,
			timestamp: now
		};

		res.json(data);

	} catch (err) {
		console.error("CSGOWin leaderboard fetch error:", err.message);
		res.status(500).json({ error: err.message });
	}
});


router.get("/clash/:sinceDate", async (req, res) => {
  try {
    const sinceDateRaw = req.params.sinceDate || "2023-01-01";
    const sinceDate = new Date(sinceDateRaw);

    if (isNaN(sinceDate)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const formattedDate = sinceDate.toISOString().split("T")[0];

    // Use cache if valid
    if (clashCache && Date.now() - clashCacheTimestamp < CACHE_TIME) {
      return res.json(clashCache);
    }

    const url = `https://api.clash.gg/affiliates/detailed-summary/v2/${formattedDate}`;

    const { data } = await axios.get(url, {
      headers: {
        "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NzYwNDYwLCJpYXQiOjE3NjUwNTQxOTYsImV4cCI6MTkyMjg0MjE5Nn0.r41izt3dIKfI-O6pwEOspV5n0OPYL-sbh7k2-1KTIuI",
        "Cookie": "let-me-in=top-secret-cookie-do-not-share",
        "Content-Type": "application/json",
      },
    });

    // Convert gem cents to gems (optional)
    if (data.players) {
      data.players = data.players.map(player => ({
        ...player,
        wageredGems: player.wagered / 100,
        depositsGems: player.deposits / 100,
      }));
    }

    // Cache the result
    clashCache = data;
    clashCacheTimestamp = Date.now();

    res.json(data);
  } catch (err) {
    console.error("Clash leaderboard fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
