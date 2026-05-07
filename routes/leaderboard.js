const express = require("express");
const router = express.Router();
const axios = require("axios");
const { getRoobetAffiliates } = require("../controllers/roobetController.js");
const leaderboardController = require("../controllers/leaderboardController.js");
const dayjs = require("dayjs");
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
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NzYwNDYwLCJpYXQiOjE3NjUwNTQxOTYsImV4cCI6MTkyMjg0MjE5Nn0.r41izt3dIKfI-O6pwEOspV5n0OPYL-sbh7k2-1KTIuI",
        Cookie: "let-me-in=top-secret-cookie-do-not-share",
        Accept: "application/json",
      },
    });

    const leaderboard = data.data.find(lb => lb.status === "LIVE");
    if (!leaderboard) {
      return res.status(404).json({ error: "No live leaderboard found" });
    }

    const startDate = new Date(leaderboard.startDate);
    const endDate = new Date(startDate.getTime() + leaderboard.durationDays * 24 * 60 * 60 * 1000);

    res.json({
      startDate,
      endDate,
      rewards: leaderboard.rewards,
      players: leaderboard.topPlayers.map(player => ({
        name: player.name,
        userId: player.userId,
        xp: Number(player.xp),
        wageredGems: Number(player.xp) / 100,
        depositsGems: player.deposited / 100,
        avatar: player.avatar,
        earned: player.earned,
        wagered: player.wagered,
      })),
    });
  } catch (err) {
    console.error("Clash leaderboard fetch error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch Clash leaderboards" });
  }
});


router.get("/clash/:sinceDate", async (req, res) => {
  try {
    const sinceDateRaw = req.params.sinceDate || "2025-12-22";
    const sinceDate = new Date(sinceDateRaw);

    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const formattedDate = sinceDate.toISOString().split("T")[0];
    const url = `https://api.clash.gg/affiliates/detailed-summary/v2/${formattedDate}`;

    const { data } = await axios.get(url, {
      headers: {
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGFzcyIsInNjb3BlIjoiYWZmaWxpYXRlcyIsInVzZXJJZCI6NzYwNDYwLCJpYXQiOjE3NjUwNTQxOTYsImV4cCI6MTkyMjg0MjE5Nn0.r41izt3dIKfI-O6pwEOspV5n0OPYL-sbh7k2-1KTIuI",
        Cookie: "let-me-in=top-secret-cookie-do-not-share", // same as cURL
        Accept: "application/json",
      },
    });

    if (Array.isArray(data)) {
      const result = data.map((player) => ({
        ...player,
        wageredGems: player.wagered / 100,
        depositedGems: player.deposited / 100,
      }));

      return res.json(result);
    }

    res.status(500).json({ error: "Unexpected API response format" });
  } catch (err) {
    console.error(
      "Clash leaderboard fetch error:",
      err.response?.data || err.message
    );
    res.status(500).json({ error: err.response?.data || err.message });
  }
});




// WINOVO leaderboard (use env when available)
const WINOVO_API_KEY = process.env.WINOVO_API_KEY || "9b2e7c4a1d8f3b6c0a5e9d2f7c1b4a8e";
const WINOVO_BASE = process.env.WINOVO_BASE || "https://winovo.io/api/creator";

router.get("/winovo", async (req, res) => {
  try {
    if (!WINOVO_API_KEY) {
      return res.status(500).json({ error: "WINOVO API key not configured" });
    }

    const { data } = await axios.get(`${WINOVO_BASE}/users`, {
      headers: { "x-creator-auth": WINOVO_API_KEY, Accept: "application/json" },
      timeout: 10000,
    });

    res.json(data);
  } catch (err) {
    console.error(
      "WINOVO leaderboard fetch error:",
      err.response?.status,
      err.response?.data || err.message
    );
    res.status(err.response?.status || 500).json({ error: err.response?.data || "Failed to fetch WINOVO leaderboard" });
  }
});

router.post("/winovo/clear", async (req, res) => {
  try {
    if (!WINOVO_API_KEY) {
      return res.status(500).json({ error: "WINOVO API key not configured" });
    }

    const { data } = await axios.post(
      `${WINOVO_BASE}/clear`,
      null,
      { headers: { "x-creator-auth": WINOVO_API_KEY, Accept: "application/json" }, timeout: 10000 }
    );

    res.json(data);
  } catch (err) {
    console.error("WINOVO clear error:", err.response?.status, err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.response?.data || "Failed to clear WINOVO leaderboard" });
  }
});

// --- CSGODiamonds referrals leaderboard ---
router.post("/diamonds", async (req, res) => {
  try {
    const key = req.body.key || process.env.CSGO_DIAMONDS_API_KEY;
    const type = "WAGER";
    const before = Number(req.body.before);
    const after = Number(req.body.after);

    if (!key) {
      return res.status(400).json({ error: "Missing CSGO Diamonds API key" });
    }

    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      return res.status(400).json({ error: "Missing or invalid before/after timestamps" });
    }

    const { data } = await axios.post(
      "https://api.csgodiamonds.com/affiliate/leaderboard/referrals",
      {
        key,
        type,
        before,
        after,
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    res.json(data);
  } catch (err) {
    const upstreamError = err.response?.data;
    const errorMessage =
      typeof upstreamError === "string"
        ? upstreamError
        : upstreamError?.error || upstreamError?.message || "Failed to fetch CSGO Diamonds leaderboard";

    console.error(
      "CSGO Diamonds leaderboard fetch error:",
      err.response?.data || err.message
    );
    res.status(err.response?.status || 500).json({
      error: errorMessage,
    });
  }
});

// --- CSBattle affiliates leaderboard ---
const CSBATTLE_AFFILIATE_ID =
  process.env.CSBATTLE_AFFILIATE_ID || "cd5a7170-1742-4ddb-95fb-985597beb99f";
const CSBATTLE_FROM_DEFAULT = "2025-04-10 00:00:00";
const CSBATTLE_TO_DEFAULT = "2030-04-19 23:59:59";

let csbattleCache = { data: null, key: "", timestamp: 0 };

router.get("/csbattle", async (req, res) => {
  try {
    const from = (req.query.from && String(req.query.from)) || CSBATTLE_FROM_DEFAULT;
    const to = (req.query.to && String(req.query.to)) || CSBATTLE_TO_DEFAULT;
    const cacheKey = `${from}|${to}`;
    const now = Date.now();

    if (
      csbattleCache.data &&
      csbattleCache.key === cacheKey &&
      now - csbattleCache.timestamp < CACHE_TIME
    ) {
      return res.json(csbattleCache.data);
    }

    const url = `https://api.csbattle.com/leaderboards/affiliates/${CSBATTLE_AFFILIATE_ID}`;
    const { data } = await axios.get(url, {
      params: { from, to },
      headers: { Accept: "application/json" },
      timeout: 15000,
    });

    const rawUsers = Array.isArray(data?.users) ? data.users : [];
    const payload = {
      users: rawUsers.map((u, idx) => ({
        uuid: u.uuid,
        username: u.username ?? "—",
        avatar: u.avatar ?? null,
        wager: Number(u.wager) || 0,
        rank: Number.isFinite(Number(u.rank)) ? Number(u.rank) : idx + 1,
      })),
      period: { from, to },
    };

    csbattleCache = { data: payload, key: cacheKey, timestamp: now };
    res.json(payload);
  } catch (err) {
    console.error(
      "CSBattle affiliates leaderboard fetch error:",
      err.response?.data || err.message
    );
    const upstream = err.response?.data;
    let errorMessage = "Failed to fetch CSBattle leaderboard";
    if (typeof upstream === "string") errorMessage = upstream;
    else if (upstream && typeof upstream === "object" && upstream.message) {
      errorMessage = String(upstream.message);
    } else if (err.message) {
      errorMessage = err.message;
    }
    res.status(err.response?.status || 500).json({ error: errorMessage });
  }
});

// --- Rainbet bi-weekly leaderboard ---
router.get("/rainbet", async (req, res) => {
  try {
    // Bi-weekly period starting 4th of current month
    const now = dayjs();
    let start = dayjs(`${now.year()}-${now.month() + 1}-04`);
    let end = start.add(14, "day"); // 2 weeks later

    const url = "https://services.rainbet.com/v1/external/affiliates";

    const { data } = await axios.get(url, {
      params: {
        start_at: start.format("YYYY-MM-DD"),
        end_at: end.format("YYYY-MM-DD"),
        key: process.env.RAINBET_API_KEY,
      },
      headers: { Accept: "application/json" },
      timeout: 10000,
    });

    // Normalize the data to a consistent array
    const affiliates = Array.isArray(data.affiliates) ? data.affiliates : [];

    res.json({ affiliates, start: start.toISOString(), end: end.toISOString() });
  } catch (err) {
    console.error(
      "Rainbet bi-weekly fetch error:",
      err.response?.data || err.message
    );
    res.status(500).json({ error: err.response?.data || "Failed to fetch Rainbet leaderboard" });
  }
});


// --- DYNAMIC ROUTES LAST ---
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);
router.get("/", leaderboardController.getLeaderboard);

module.exports = router;
