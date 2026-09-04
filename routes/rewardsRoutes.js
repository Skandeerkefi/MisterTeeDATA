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

module.exports = router;