const express = require("express");
const router = express.Router();
const axios = require("axios");
const { User } = require("../models/User");
const { verifyToken } = require("../middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { randomBytes, createHash } = require("crypto");

const DISCORD_API = "https://discord.com/api/v10";
const SCOPES = "identify email guilds.join";

// ─── Discord OAuth ───────────────────────────────────────────────

// Redirect to Discord authorization page — state carries purpose
router.get("/discord", (req, res) => {
  const siteToken = req.query.token;
  let state;
  try {
    if (siteToken) {
      const decoded = jwt.verify(siteToken, process.env.JWT_SECRET);
      state = jwt.sign({ userId: decoded.id, purpose: "discord-link" }, process.env.JWT_SECRET, { expiresIn: "10m" });
    } else {
      state = jwt.sign({ userId: null, purpose: "discord-login" }, process.env.JWT_SECRET, { expiresIn: "10m" });
    }
  } catch {
    return res.status(401).json({ error: "Invalid session — please sign in again" });
  }
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Discord callback — account-linking aware, one-and-done
router.get("/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: "Missing code" });
    if (!state) return res.status(400).json({ error: "Missing state" });
    let linkState;
    try { linkState = jwt.verify(state, process.env.JWT_SECRET); } catch { return res.status(400).json({ error: "Invalid OAuth state" }); }
    if (!["discord-link", "discord-login"].includes(linkState.purpose)) return res.status(400).json({ error: "Invalid OAuth state purpose" });

    const tokenRes = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { access_token } = tokenRes.data;
    const userRes = await axios.get(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` } });
    const discordUser = userRes.data;
    const discordId = String(discordUser.id);
    const discordUsername = discordUser.username;

    const existing = await User.findOne({ discordId });
    if (existing) {
      const isSameUser = linkState.purpose === "discord-link" && existing._id.toString() === linkState.userId;
      if (!isSameUser) {
        const dest = linkState.purpose === "discord-link" ? "/profile?error=discord-linked" : "/login?error=discord-linked";
        return res.redirect(`${process.env.FRONTEND_URL}${dest}`);
      }
    }

    if (linkState.purpose === "discord-link") {
      const user = await User.findById(linkState.userId);
      if (!user) return res.redirect(`${process.env.FRONTEND_URL}/login?error=user-not-found`);
      if (user.hasLinkedDiscord && user.discordId && user.discordId !== discordId) {
        return res.redirect(`${process.env.FRONTEND_URL}/profile?error=discord-already-linked`);
      }
      if (user.hasLinkedDiscord && user.discordId === discordId) {
        const sessionToken = jwt.sign({ id: user._id, role: user.role, kickUsername: user.kickUsername }, process.env.JWT_SECRET, { expiresIn: "7d" });
        return res.redirect(`${process.env.FRONTEND_URL}/profile?discord=linked&token=${encodeURIComponent(sessionToken)}`);
      }
      user.discordId = discordId;
      user.discordUsername = discordUsername;
      user.hasLinkedDiscord = true;
      await user.save();
      const sessionToken = jwt.sign({ id: user._id, role: user.role, kickUsername: user.kickUsername }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.redirect(`${process.env.FRONTEND_URL}/profile?discord=linked&token=${encodeURIComponent(sessionToken)}`);
    }

    if (existing) {
      const sessionToken = jwt.sign({ id: existing._id, role: existing.role, kickUsername: existing.kickUsername }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.redirect(`${process.env.FRONTEND_URL}/?token=${encodeURIComponent(sessionToken)}`);
    }
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=discord-not-linked`);
  } catch (error) {
    res.status(500).json({ error: "Discord OAuth failed", details: error.response?.data || error.message });
  }
});

// Link Discord via API (alternative) — one-and-done
router.post("/discord/link", verifyToken, async (req, res) => {
  try {
    const { discordId, discordUsername } = req.body;
    const userId = req.user.id;
    if (!discordId) return res.status(400).json({ error: "discordId required" });
    const existing = await User.findOne({ discordId: String(discordId) });
    if (existing && existing._id.toString() !== userId) return res.status(400).json({ error: "Discord account already linked to another user" });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.hasLinkedDiscord && user.discordId && String(user.discordId) !== String(discordId)) {
      return res.status(400).json({ error: "Discord already linked — cannot link another account" });
    }
    user.discordId = String(discordId);
    user.discordUsername = discordUsername;
    user.hasLinkedDiscord = true;
    await user.save();
    res.json({ success: true, message: "Discord linked successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Kick OAuth ──────────────────────────────────────────────────

// Redirect to Kick authorization page
router.get("/kick", (req, res) => {
  const siteToken = req.query.token;
  let state;
  try {
    const decoded = siteToken ? jwt.verify(siteToken, process.env.JWT_SECRET) : null;
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    state = jwt.sign({ userId: decoded?.id || null, purpose: decoded ? "kick-link" : "kick-login", codeVerifier }, process.env.JWT_SECRET, { expiresIn: "10m" });
    req.kickCodeChallenge = codeChallenge;
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
  const params = new URLSearchParams({
    client_id: process.env.KICK_CLIENT_ID,
    redirect_uri: process.env.KICK_REDIRECT_URI,
    response_type: "code",
    scope: "user:read",
    state,
    code_challenge: req.kickCodeChallenge,
    code_challenge_method: "S256",
  });
  const authorizationUrl = `https://id.kick.com/oauth/authorize?${params.toString()}`;
  res.redirect(302, authorizationUrl);
});

// Kick callback — fetch Kick user info
router.get("/callback/kick", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).json({ error: "Missing code or state" });

    const linkState = jwt.verify(state, process.env.JWT_SECRET);
    if (!["kick-link", "kick-login"].includes(linkState.purpose)) return res.status(400).json({ error: "Invalid OAuth state" });

    const tokenRes = await axios.post(
      "https://id.kick.com/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.KICK_CLIENT_ID,
        client_secret: process.env.KICK_CLIENT_SECRET,
        redirect_uri: process.env.KICK_REDIRECT_URI,
        code_verifier: linkState.codeVerifier,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = tokenRes.data;
    const userRes = await axios.get("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const kickUser = Array.isArray(userRes.data?.data) ? userRes.data.data[0] : userRes.data?.data || userRes.data;
    if (!kickUser?.user_id && !kickUser?.id) throw new Error("Kick did not return a user profile");

    const kickId = String(kickUser.user_id || kickUser.id);
    const kickUsername = kickUser.username || kickUser.name;
    let user = await User.findOne({ $or: [{ kickId }, { kickUsername }] });
    if (linkState.purpose === "kick-link" && user && user._id.toString() !== linkState.userId) {
      return res.redirect(`${process.env.FRONTEND_URL}/profile?error=kick-linked`);
    }
    if (linkState.purpose === "kick-link") {
      user = await User.findById(linkState.userId);
      if (user && user.hasLinkedKick && user.kickId && user.kickId !== kickId) {
        return res.redirect(`${process.env.FRONTEND_URL}/profile?error=kick-already-linked`);
      }
    }
    if (!user && linkState.purpose === "kick-link") return res.redirect(`${process.env.FRONTEND_URL}/login?error=user-not-found`);
    if (!user) {
      const password = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
      user = await User.create({ kickId, kickUsername, rainbetUsername: `kick-${kickId}`, password, hasLinkedKick: true });
    }
    user.kickId = kickId;
    user.kickUsername = kickUsername;
    user.hasLinkedKick = true;
    await user.save();
    const sessionToken = jwt.sign({ id: user._id, role: user.role, kickUsername: user.kickUsername }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const destination = linkState.purpose === "kick-login" ? "" : "/profile?kick=linked";
    res.redirect(`${process.env.FRONTEND_URL}${destination}${destination ? "&" : "?"}token=${encodeURIComponent(sessionToken)}`);
  } catch (error) {
    res.status(500).json({
      error: "Kick OAuth failed",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;