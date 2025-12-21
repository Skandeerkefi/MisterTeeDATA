const express = require("express");
const router = express.Router();
const axios = require("axios");
const { getRoobetAffiliates } = require("../controllers/roobetController.js");
const leaderboardController = require("../controllers/leaderboardController.js");

// --- SPECIFIC ROUTES FIRST ---

// CSGOWin leaderboard (still cached)
let csgoCache = { data: null, timestamp: 0 };
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
router.get("/csgowin", async (req, res) => {
  try {
    const now = Date.now();

    if (csgoCache.data && now - csgoCache.timestamp < CACHE_TIME) {
      return res.json(csgoCache.data);
    }

    const code = "mistertee";
    const url = `https://api.csgowin.com/api/leaderboard/${code}`;
    const response = await fetch(url, { headers: { "x-apikey": "108adfb76a" } });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Failed to fetch CSGOWin leaderboard");
    }

    const data = await response.json();
    csgoCache = { data, timestamp: now };
    res.json(data);
  } catch (err) {
    console.error("CSGOWin leaderboard fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clash leaderboard: my-leaderboards-api (no cache)

router.get("/clash/leaderboards", async (req, res) => {
  try {
    const url = "https://clash.gg/api/affiliates/leaderboards/my-leaderboards-api";
    const { data } = await axios.get(url, {
      headers: {
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NzYwNDYwLCJpYXQiOjE3NjUwNTQxOTYsImV4cCI6MTkyMjg0MjE5Nn0.r41izt3dIKfI-O6pwEOspV5n0OPYL-sbh7k2-1KTIuI",
        Cookie: "let-me-in=top-secret-cookie-do-not-share",
        Accept: "application/json",
      },
    });

    // Extract only topPlayers and leaderboard period
    const leaderboard = data.data[0];
    const startDate = new Date(leaderboard.startDate);
    const endDate = new Date(startDate.getTime() + leaderboard.durationDays * 24*60*60*1000);

    res.json({
      startDate,
      endDate,
      rewards: leaderboard.rewards,
      players: leaderboard.topPlayers.map(player => ({
        name: player.name,
        userId: player.userId,
        xp: Number(player.xp),
        wagered: player.wagered,
        deposited: player.deposited,
        avatar: player.avatar,
        earned: player.earned,
      })),
    });
  } catch (err) {
    console.error("Clash leaderboard fetch error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch Clash leaderboards" });
  }
});

// Clash detailed summary (no cache)
router.get("/clash/:sinceDate", async (req, res) => {
  try {
    const sinceDateRaw = req.params.sinceDate || "2025-12-07";
    const sinceDate = new Date(sinceDateRaw);

    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const formattedDate = sinceDate.toISOString().split("T")[0];
    const url = `https://api.clash.gg/affiliates/detailed-summary/v2/${formattedDate}`;

    const { data } = await axios.get(url, {
      headers: {
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NzYwNDYwLCJpYXQiOjE3NjUwNTQxOTYsImV4cCI6MTkyMjg0MjE5Nn0.r41izt3dIKfI-O6pwEOspV5n0OPYL-sbh7k2-1KTIuI",
        Cookie: "let-me-in=top-secret-cookie-do-not-share",
        "Content-Type": "application/json",
      },
    });

    if (data.players) {
      data.players = data.players.map((player) => ({
        ...player,
        wageredGems: player.xp / 100,
        depositsGems: player.deposits / 100,
      }));
    }

    res.json(data);
  } catch (err) {
    console.error("Clash leaderboard fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- DYNAMIC ROUTES LAST ---
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);
router.get("/", leaderboardController.getLeaderboard);

module.exports = router;
