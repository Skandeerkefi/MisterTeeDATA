const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const gameService = require("../services/gameService");
const { GameRound, GAME_TYPES, GAME_OUTCOMES } = require("../models/GameRound");

router.get("/config/:gameType", verifyToken, async (req, res) => {
  try {
    const config = await gameService.getGameConfig(req.params.gameType);
    res.json({ minWager: config.minWager, maxWager: config.maxWager, dailyLossCap: config.dailyLossCap, active: config.active });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post("/coinflip", verifyToken, async (req, res) => {
  try {
    const { wager, chosenSide } = req.body;
    if (!wager || !chosenSide) return res.status(400).json({ error: "wager and chosenSide required" });
    const result = await gameService.playCoinFlip(req.user.id, parseInt(wager), chosenSide);
    res.json({ success: true, ...result });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// POST /api/games/mines/create  { bet, gridSize, mines, clientSeed }  + legacy /mines/start
router.post("/mines/create", verifyToken, async (req, res) => {
  try {
    const bet = req.body.bet ?? req.body.wager;
    const mines = req.body.mines ?? req.body.mineCount ?? 3;
    const clientSeed = req.body.clientSeed ?? "";
    if (!bet) return res.status(400).json({ error: "bet required" });
    const validGridSize = 5; const totalTiles = 25;
    const validMines = Math.min(Math.max(parseInt(mines), 1), totalTiles - 1);
    const result = await gameService.startMines(req.user.id, parseInt(bet), validMines, validGridSize, clientSeed);
    res.json({ gameId: String(result.gameId), status: result.status, multiplier: result.multiplier, nextMultiplier: result.nextMultiplier, serverSeedHash: result.serverSeedHash, clientSeed: result.clientSeed, nonce: result.nonce, gridSize: validGridSize, totalTiles, mines: validMines, wager: result.gameRound.wager, balance: result.balance, gameRoundId: String(result.gameId) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
router.post("/mines/start", verifyToken, async (req, res) => {
  try {
    const bet = req.body.bet ?? req.body.wager;
    const mines = req.body.mines ?? 3;
    const clientSeed = req.body.clientSeed ?? "";
    if (!bet) return res.status(400).json({ error: "wager required" });
    const validGridSize = 5; const totalTiles = 25;
    const validMines = Math.min(Math.max(parseInt(mines), 1), totalTiles - 1);
    const result = await gameService.startMines(req.user.id, parseInt(bet), validMines, validGridSize, clientSeed);
    res.json({ success: true, ...result, gameRoundId: String(result.gameId), gameId: String(result.gameId) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Spec: POST /api/games/mines/reveal  { gameId, tile }  + legacy { gameRoundId, cell }
router.post("/mines/reveal", verifyToken, async (req, res) => {
  try {
    const gameId = req.body.gameId ?? req.body.gameRoundId;
    const tile = req.body.tile ?? req.body.cell;
    if (!gameId || tile === undefined) return res.status(400).json({ error: "gameId and tile required" });
    const result = await gameService.revealMines(req.user.id, gameId, parseInt(tile));
    if (result.result === "mine") return res.json({ success: true, result: "mine", tile: result.tile, multiplier: 0, payout: 0, status: "lost", minePositions: result.minePositions, revealedCells: result.revealedCells });
    if (result.autoWin) return res.json({ success: true, result: "safe", tile: result.tile, multiplier: result.multiplier, potentialWin: result.payout, payout: result.payout, status: "won", autoWin: true, revealedCells: result.revealedCells, minePositions: result.minePositions });
    res.json({ success: true, result: result.result, tile: result.tile, multiplier: result.multiplier, potentialWin: result.potentialWin, nextMultiplier: result.nextMultiplier, status: result.status, canCashOut: result.canCashOut, revealedCells: result.revealedCells, balance: result.balance });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// Cash out — spec: POST /api/games/mines/cashout  { gameId }
router.post("/mines/cashout", verifyToken, async (req, res) => {
  try {
    const gameId = req.body.gameId ?? req.body.gameRoundId;
    if (!gameId) return res.status(400).json({ error: "gameId required" });
    const result = await gameService.cashOutMines(req.user.id, gameId);
    res.json({ success: true, result: "cashed_out", payout: result.payout, multiplier: result.multiplier, status: "won", minePositions: result.minePositions, revealedCells: result.revealedCells });
  } catch (error) { res.status(400).json({ error: error.message }); }
});
// Abandon stale game — releases the single-active guard
router.post("/mines/abandon", verifyToken, async (req, res) => {
  try {
    const r = await gameService.abandonMines(req.user.id);
    res.json({ success: true, result: "abandoned", status: "lost", gameId: String(r.gameRound._id), minePositions: r.gameRound.meta?.bombPositions || [] });
  } catch (error) { res.status(400).json({ error: error.message }); }
});



// Game verification + fairness
router.get("/mines/active", verifyToken, async (req, res) => {
  try {
    const g = await GameRound.findOne({ user: req.user.id, game: GAME_TYPES.MINES, outcome: GAME_OUTCOMES.PENDING }).sort({ createdAt: -1 });
    if (!g) return res.json({ active: false });
    const m = g.meta || {};
    const revealed = m.revealedCells || [];
    const mult = m.currentMultiplier || (revealed.length ? gameService.calculateMultiplier(m.totalTiles || 25, m.bombCount || 3, revealed.length) : 1);
    res.json({ active: true, gameId: String(g._id), gameRoundId: String(g._id), wager: g.wager, gridSize: m.gridSize || 5, totalTiles: m.totalTiles || 25, mines: m.bombCount || 3, revealedCells: revealed, multiplier: mult, potentialWin: Math.floor(g.wager * mult), nextMultiplier: revealed.length < (m.totalTiles - m.bombCount) ? gameService.calculateMultiplier(m.totalTiles, m.bombCount, revealed.length + 1) : null, serverSeedHash: m.serverSeedHash, clientSeed: m.clientSeed, nonce: m.nonce, status: "active" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
router.get("/mines/fairness/:gameId", verifyToken, async (req, res) => {
  try {
    const g = await GameRound.findOne({ _id: req.params.gameId, user: req.user.id, game: GAME_TYPES.MINES });
    if (!g) return res.status(404).json({ error: "Game not found" });
    const f = gameService.getMineFairness(g);
    let hashValid = null;
    if (g.outcome !== GAME_OUTCOMES.PENDING && g.meta?.serverSeed) hashValid = crypto.createHash("sha256").update(g.meta.serverSeed).digest("hex") === g.meta.serverSeedHash;
    res.json({ ...f, hashValid, gameRoundId: String(g._id) });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
// Get mines game details for verification
router.get("/mines/:gameRoundId", verifyToken, async (req, res) => {
  try {
    const gameRound = await GameRound.findOne({ _id: req.params.gameRoundId, user: req.user.id, game: GAME_TYPES.MINES });
    if (!gameRound) return res.status(404).json({ error: "Game not found" });
    
    res.json({
      gameRoundId: gameRound._id,
      gameId: String(gameRound._id),
      wager: gameRound.wager,
      bet: gameRound.wager,
      gridSize: gameRound.meta?.gridSize || 5,
      totalTiles: gameRound.meta?.totalTiles || 25,
      mines: gameRound.meta?.bombCount || 3,
      revealedCells: gameRound.meta?.revealedCells || [],
      multiplier: gameRound.multiplier,
      outcome: gameRound.outcome,
      status: gameRound.outcome === GAME_OUTCOMES.PENDING ? "active" : gameRound.outcome === GAME_OUTCOMES.WIN ? "won" : "lost",
      payout: gameRound.payout,
      minePositions: gameRound.outcome !== GAME_OUTCOMES.PENDING ? (gameRound.meta?.bombPositions || []) : undefined,
      serverSeedHash: gameRound.meta?.serverSeedHash,
      clientSeed: gameRound.meta?.clientSeed,
      nonce: gameRound.meta?.nonce,
      serverSeed: gameRound.outcome !== GAME_OUTCOMES.PENDING ? gameRound.meta?.serverSeed : undefined,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Legacy endpoint - locked to 5x5
router.post("/mines", verifyToken, async (req, res) => {
  try {
    const { wager, mines = 3, cell } = req.body;
    if (!wager) return res.status(400).json({ error: "wager required" });
    
    const validGridSize = 5;
    const totalTiles = 25;

    // If no cell provided, start a new game
    if (cell === undefined) {
      const result = await gameService.startMines(req.user.id, parseInt(wager), parseInt(mines), validGridSize);
      res.json({ success: true, ...result, gameRoundId: result.gameRound._id });
      return;
    }

    // With cell provided, create new game and reveal that cell in one go
    const bombCount = Math.min(Math.max(parseInt(mines), 1), totalTiles - 1);
    const { gameRound } = await gameService.placeWager(req.user.id, GAME_TYPES.MINES, parseInt(wager));
    const bombPositions = new Set();
    while (bombPositions.size < bombCount) bombPositions.add(Math.floor(Math.random() * totalTiles));
    gameRound.meta = { wagerTxId: gameRound.meta.wagerTxId, bombCount, bombPositions: [...bombPositions], revealedCells: [], gridSize: validGridSize };
    await gameRound.save();

    const bombPosArray = [...bombPositions];
    if (bombPosArray.includes(cell)) {
      const r = await gameService.resolveLoss(gameRound._id, { bombCount, bombPositions: bombPosArray, selectedCell: cell, revealedCells: [], hitMine: cell, gridSize: validGridSize });
      res.json({ success: true, ...r, outcome: "loss", selectedCell: cell, hitMine: cell, minePositions: bombPosArray });
    } else {
      const multiplier = gameService.calculateMultiplier(totalTiles, bombCount, 1);
      const payout = Math.floor(parseInt(wager) * multiplier);
      const r = await gameService.resolveWin(gameRound._id, payout, multiplier, { bombCount, bombPositions: bombPosArray, selectedCell: cell, revealedCells: [cell], gridSize: validGridSize });
      res.json({ success: true, ...r, outcome: "win", multiplier, selectedCell: cell, revealedCells: [cell] });
    }
  } catch (error) { res.status(400).json({ error: error.message }); }
});

router.get("/history", verifyToken, async (req, res) => {
  try {
    const gameType = req.query.gameType || req.query.game;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = parseInt(req.query.skip) || 0;
    const r = await gameService.getGameHistory(req.user.id, { gameType, limit, skip });
    res.json(r);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
router.get("/stats", verifyToken, async (req, res) => { try { const stats = await gameService.getUserStats(req.user.id); res.json(stats); } catch (error) { res.status(500).json({ error: error.message }); } });

module.exports = router;