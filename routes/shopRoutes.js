const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { ShopItem } = require("../models/ShopItem");
const { Redemption } = require("../models/Redemption");
const pointsService = require("../services/pointsService");

// Get all active shop items
router.get("/items", async (req, res) => {
  try {
    const items = await ShopItem.find({ active: true }).sort({ displayOrder: 1, createdAt: 1 });
    res.json(items);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get shop item by ID
router.get("/items/:id", async (req, res) => {
  try {
    const item = await ShopItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Create redemption request
router.post("/redeem", verifyToken, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: "itemId required" });

    const item = await ShopItem.findById(itemId);
    if (!item || !item.active) return res.status(400).json({ error: "Item not available" });
    if (item.stock !== null && item.stockRemaining <= 0) return res.status(400).json({ error: "Out of stock" });

    const userBalance = await pointsService.getBalance(req.user.id);
    if (userBalance < item.costInPoints) return res.status(400).json({ error: "Insufficient points" });

    // Deduct points
    await pointsService.deductPoints(req.user.id, item.costInPoints, "reward-redemption", `Redeemed: ${item.name}`, { itemId, itemName: item.name });

    // Create redemption
    const redemption = await new Redemption({
      user: req.user.id, shopItem: itemId, costPaid: item.costInPoints, status: "pending",
    }).save();

    // Decrease stock if limited
    if (item.stock !== null) {
      item.stockRemaining = Math.max(0, item.stockRemaining - 1);
      await item.save();
    }

    res.json({ success: true, redemption });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Get user's redemptions
router.get("/my-redemptions", verifyToken, async (req, res) => {
  try {
    const redemptions = await Redemption.find({ user: req.user.id })
      .populate("shopItem", "name description imageUrl")
      .sort({ createdAt: -1 });
    res.json(redemptions);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;