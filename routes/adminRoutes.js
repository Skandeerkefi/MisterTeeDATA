const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth");
const { User } = require("../models/User");
const { ShopItem } = require("../models/ShopItem");
const { Redemption } = require("../models/Redemption");
const { Affiliate } = require("../models/Affiliate");
const { SocialLink } = require("../models/SocialLink");
const { GameConfig } = require("../models/GameConfig");
const pointsService = require("../services/pointsService");
const { TRANSACTION_TYPES } = require("../models/PointsTransaction");

// Points adjust
router.post("/points/adjust", verifyToken, isAdmin, async (req, res) => {
  const { userId, amount, reason } = req.body;
  if (!userId || amount === undefined) return res.status(400).json({ error: "userId and amount required" });
  try { let result; if (amount >= 0) result = await pointsService.addPoints(userId, amount, TRANSACTION_TYPES.ADMIN_ADJUSTMENT, reason || "Admin adjustment", { adjustedBy: req.user.id }); else result = await pointsService.deductPoints(userId, Math.abs(amount), TRANSACTION_TYPES.ADMIN_ADJUSTMENT, reason || "Admin adjustment", { adjustedBy: req.user.id }); res.json({ success: true, ...result }); } catch (error) { res.status(400).json({ error: error.message }); }
});
router.post("/points/set", verifyToken, isAdmin, async (req, res) => { const { userId, balance, reason } = req.body; if (!userId || balance === undefined || Number(balance) < 0) return res.status(400).json({ error: "userId and a non-negative balance are required" }); try { const user = await User.findById(userId); if (!user) return res.status(404).json({ error: "User not found" }); const delta = Number(balance) - user.pointsBalance; if (delta === 0) return res.json({ success: true, balance: user.pointsBalance, changed: false }); const result = delta > 0 ? await pointsService.addPoints(userId, delta, TRANSACTION_TYPES.ADMIN_ADJUSTMENT, reason || "Admin balance set", { adjustedBy: req.user.id, targetBalance: Number(balance) }) : await pointsService.deductPoints(userId, Math.abs(delta), TRANSACTION_TYPES.ADMIN_ADJUSTMENT, reason || "Admin balance set", { adjustedBy: req.user.id, targetBalance: Number(balance) }); res.json({ success: true, changed: true, ...result }); } catch (error) { res.status(400).json({ error: error.message }); } });

// Shop items
router.get("/shop-items", async (req, res) => {
  try {
    const items = await ShopItem.find().sort({ displayOrder: 1, createdAt: 1 });
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post("/shop-items", verifyToken, isAdmin, async (req, res) => {
  try {
    const b = req.body;
    const stock = b.stock === "" || b.stock === undefined || b.stock === null ? null : Number(b.stock);
    const stockRemainingRaw = b.stockRemaining === "" || b.stockRemaining === undefined ? stock : Number(b.stockRemaining);
    const payload = {
      name: String(b.name||"").trim(),
      description: String(b.description||"").trim(),
      imageUrl: String(b.imageUrl||"").trim(),
      costInPoints: Number(b.costInPoints),
      category: b.category || "other",
      stock: stock,
      stockRemaining: stock === null ? null : (Number.isFinite(stockRemainingRaw) ? stockRemainingRaw : stock),
      displayOrder: Number(b.displayOrder) || 0,
      active: b.active !== false,
    };
    if (!payload.name) return res.status(400).json({ error: "Name required" });
    if (!Number.isFinite(payload.costInPoints) || payload.costInPoints < 0) return res.status(400).json({ error: "Valid costInPoints required" });
    const item = await ShopItem.create(payload);
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.put("/shop-items/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const b = req.body;
    const update = { ...b };
    if ("stock" in b) update.stock = b.stock === "" || b.stock === null || b.stock === undefined ? null : Number(b.stock);
    if ("stockRemaining" in b) update.stockRemaining = b.stockRemaining === "" || b.stockRemaining === null || b.stockRemaining === undefined ? null : Number(b.stockRemaining);
    if ("costInPoints" in b) update.costInPoints = Number(b.costInPoints);
    if ("displayOrder" in b) update.displayOrder = Number(b.displayOrder) || 0;
    if ("name" in b) update.name = String(b.name).trim();
    if ("description" in b) update.description = String(b.description).trim();
    if ("imageUrl" in b) update.imageUrl = String(b.imageUrl).trim();
    if (update.stock === null) update.stockRemaining = null;
    if (update.stock !== null && update.stockRemaining === undefined) {
      const existing = await ShopItem.findById(req.params.id);
      if (existing && existing.stockRemaining === null) update.stockRemaining = update.stock;
    }
    const item = await ShopItem.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete("/shop-items/:id", verifyToken, isAdmin, async (req, res) => { await ShopItem.findByIdAndDelete(req.params.id); res.json({ success: true }); });

// Redemptions
router.get("/redemptions", verifyToken, isAdmin, async (req, res) => { const r = await Redemption.find().populate("user", "kickUsername discordUsername").populate("shopItem", "name costInPoints"); res.json(r); });
router.put("/redemptions/:id/approve", verifyToken, isAdmin, async (req, res) => { const r = await Redemption.findByIdAndUpdate(req.params.id, { status: "approved", resolvedAt: new Date(), resolvedBy: req.user.id }, { new: true }); res.json(r); });
router.put("/redemptions/:id/reject", verifyToken, isAdmin, async (req, res) => { const { reason } = req.body; const redemption = await Redemption.findById(req.params.id); if (!redemption) return res.status(404).json({ error: "Not found" }); redemption.status = "rejected"; redemption.resolvedAt = new Date(); redemption.resolvedBy = req.user.id; redemption.rejectionReason = reason || ""; await redemption.save(); await pointsService.addPoints(redemption.user, redemption.costPaid, TRANSACTION_TYPES.REDEMPTION_REJECTED, "Redemption rejected - refund"); res.json(redemption); });
router.put("/redemptions/:id/fulfillment", verifyToken, isAdmin, async (req, res) => { const { fulfillmentStatus, fulfillmentNotes } = req.body; const redemption = await Redemption.findByIdAndUpdate(req.params.id, { fulfillmentStatus, fulfillmentNotes }, { new: true }); if (!redemption) return res.status(404).json({ error: "Not found" }); res.json(redemption); });

// Affiliates
router.post("/affiliates", verifyToken, isAdmin, async (req, res) => { const a = await Affiliate.create(req.body); res.json(a); });
router.put("/affiliates/:id", verifyToken, isAdmin, async (req, res) => { const a = await Affiliate.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(a); });
router.delete("/affiliates/:id", verifyToken, isAdmin, async (req, res) => { await Affiliate.findByIdAndDelete(req.params.id); res.json({ success: true }); });

// Socials
router.post("/socials", verifyToken, isAdmin, async (req, res) => { const s = await SocialLink.create(req.body); res.json(s); });
router.put("/socials/:id", verifyToken, isAdmin, async (req, res) => { const s = await SocialLink.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json(s); });
router.delete("/socials/:id", verifyToken, isAdmin, async (req, res) => { await SocialLink.findByIdAndDelete(req.params.id); res.json({ success: true }); });

// Game configs
router.put("/game-configs/:game", verifyToken, isAdmin, async (req, res) => { const c = await GameConfig.findOneAndUpdate({ game: req.params.game }, req.body, { new: true, upsert: true }); res.json(c); });

// Transactions & Users
router.get("/transactions", verifyToken, isAdmin, async (req, res) => { const { limit, skip, userId, type } = req.query; const r = await pointsService.getAllTransactions({ limit: parseInt(limit) || 100, skip: parseInt(skip) || 0, userId, type }); res.json(r); });
router.get("/users", verifyToken, isAdmin, async (req, res) => { const { search, linked } = req.query; const query = {}; if (search) query.kickUsername = { $regex: search, $options: "i" }; if (linked === "discord") query.hasLinkedDiscord = true; if (linked === "kick") query.hasLinkedKick = true; const users = await User.find(query).select("-password").sort({ createdAt: -1 }).limit(50); res.json(users); });

module.exports = router;