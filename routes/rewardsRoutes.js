const express = require("express");
const router = express.Router();
const { Affiliate } = require("../models/Affiliate");

router.get("/", async (req, res) => {
  try {
    const affiliates = await Affiliate.find({ active: true }).sort({ order: 1 });
    res.json(affiliates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Temporary seed endpoint — remove after running once
const rewardsData = {
  Roobet: [
    { icon: "🏅", label: "Monthly Leaderboard" },
    { icon: "💵", label: "Weekly Deposit bonus" },
    { icon: "🎁", label: "Monthly wager promotion" },
    { icon: "🎰", label: "Weekly free spins giveaway" },
  ],
  CSGOWIN: [
    { icon: "🏅", label: "Monthly Leaderboard" },
    { icon: "💵", label: "Weekly Deposit bonus" },
    { icon: "🎁", label: "Monthly wager promotion" },
    { icon: "🔪", label: "Weekly free battle giveaway" },
  ],
  JuiceGG: [
    { icon: "🏅", label: "Monthly Leaderboard" },
    { icon: "💵", label: "Weekly Deposit bonus" },
    { icon: "🎁", label: "Monthly wager promotion" },
    { icon: "🔪", label: "Weekly free battle giveaway" },
  ],
};

router.post("/seed-rewards", async (req, res) => {
  try {
    const results = [];
    for (const [name, rewards] of Object.entries(rewardsData)) {
      const result = await Affiliate.updateOne(
        { name: { $regex: new RegExp(name, "i") } },
        { $set: { rewards } }
      );
      results.push({ name, matched: result.matchedCount, modified: result.modifiedCount });
    }
    res.json({ ok: true, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;