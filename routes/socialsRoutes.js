const express = require("express");
const router = express.Router();
const { SocialLink } = require("../models/SocialLink");

router.get("/", async (req, res) => {
  try {
    const links = await SocialLink.find({ active: true }).sort({ order: 1 });
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;