const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { User } = require("../models/User");
const pointsService = require("../services/pointsService");

// Get current user's balance
router.get("/balance", verifyToken, async (req, res) => {
  try { const balance = await pointsService.getBalance(req.user.id); res.json({ balance }); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

// Get current user's points profile
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    const balance = user.pointsBalance;
    const { transactions, total } = await pointsService.getTransactionHistory(req.user.id, { limit: 10 });
    res.json({ balance, lifetimePoints: user.lifetimePointsEarned, lastDailyLogin: user.lastDailyLogin, loginStreak: user.loginStreak, recentTransactions: transactions });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Daily login bonus
router.post("/daily-login", verifyToken, async (req, res) => {
  try {
    const result = await pointsService.processDailyLogin(req.user.id);
    res.json({ success: true, ...result });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Transaction history
router.get("/transactions", verifyToken, async (req, res) => {
  try {
    const { limit = 50, skip = 0, type } = req.query;
    const result = await pointsService.getTransactionHistory(req.user.id, { limit: parseInt(limit), skip: parseInt(skip), type });
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;