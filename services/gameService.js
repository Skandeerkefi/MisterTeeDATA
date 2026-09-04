const crypto = require("crypto");
const { User } = require("../models/User");
const { GameRound, GAME_TYPES, GAME_OUTCOMES } = require("../models/GameRound");
const { GameConfig } = require("../models/GameConfig");
const { TRANSACTION_TYPES } = require("../models/PointsTransaction");
const pointsService = require("./pointsService");

// House edge for mines game (3-4% configurable, default 3%)
const HOUSE_EDGE = 0.03;

// ————— Provably fair helpers —————
function generateServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}
function hashSeed(seed) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}
// Deterministic mine placement using HMAC-SHA256 (serverSeed + clientSeed + nonce)
function generateMinePositions(totalTiles, mineCount, serverSeed, clientSeed, nonce) {
  const tiles = Array.from({ length: totalTiles }, (_, i) => i);
  // Seeded Fisher-Yates using HMAC stream
  let counter = 0;
  function nextRandom() {
    const h = crypto.createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${counter++}`).digest("hex");
    // take first 8 hex chars = 32-bit int
    return parseInt(h.slice(0, 8), 16) / 0xffffffff;
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles.slice(0, mineCount).sort((a, b) => a - b);
}
function generateRandomMinePositions(totalTiles, mineCount) {
  const s = new Set();
  while (s.size < mineCount) s.add(crypto.randomInt(0, totalTiles));
  return [...s].sort((a, b) => a - b);
}

const gameService = {
  // ——— Multiplier ———
  // Exact probability: P(k safe in a row)= C(safe,k)/C(total,k) product form
  // Fair multiplier = 1 / P, then apply house edge
  calculateMultiplier: (totalTiles, bombCount, safeTilesRevealed, houseEdge = HOUSE_EDGE) => {
    if (safeTilesRevealed === 0) return 1;
    const safeTiles = totalTiles - bombCount;
    if (safeTilesRevealed > safeTiles) return 0;
    let prob = 1;
    for (let i = 0; i < safeTilesRevealed; i++) {
      prob *= (safeTiles - i) / (totalTiles - i);
    }
    if (prob <= 0) return 0;
    const fair = 1 / prob;
    const adjusted = fair * (1 - houseEdge);
    return Number(adjusted.toFixed(2));
  },
  // Next-step preview (for UI)
  getNextMultiplier: (totalTiles, bombCount, currentSafe) => {
    return gameService.calculateMultiplier(totalTiles, bombCount, currentSafe + 1);
  },
  getMineFairness: (gameRound) => {
    if (!gameRound) return null;
    const meta = gameRound.meta || {};
    const isPending = gameRound.outcome === GAME_OUTCOMES.PENDING;
    return {
      gameId: gameRound._id,
      serverSeedHash: meta.serverSeedHash,
      serverSeed: isPending ? undefined : meta.serverSeed,
      clientSeed: meta.clientSeed,
      nonce: meta.nonce,
      totalTiles: meta.totalTiles,
      bombCount: meta.bombCount,
      verified: !isPending,
    };
  },

  getGameConfig: async (gameType) => {
    let config = await GameConfig.findOne({ game: gameType });
    if (!config) config = await GameConfig.create({ game: gameType });
    return config;
  },

  validateWager: async (userId, gameType, wager) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    user.resetDailyLossesIfNeeded();
    const config = await gameService.getGameConfig(gameType);
    if (!config.active) throw new Error(`${gameType} is disabled`);
    if (wager < config.minWager) throw new Error(`Min wager: ${config.minWager}`);
    if (wager > config.maxWager) throw new Error(`Max wager: ${config.maxWager}`);
    if (user.pointsBalance < wager) throw new Error("Insufficient balance");
    const todayLoss = user.dailyLosses?.amount || 0;
    if (todayLoss >= config.dailyLossCap) throw new Error(`Daily loss cap reached (${config.dailyLossCap})`);
    return { valid: true, config };
  },

  placeWager: async (userId, gameType, wager) => {
    await gameService.validateWager(userId, gameType, wager);
    const { transaction } = await pointsService.deductPoints(userId, wager, TRANSACTION_TYPES.GAME_WAGER, `Wager: ${gameType}`, { game: gameType, wager });
    const gameRound = await new GameRound({ user: userId, game: gameType, wager, outcome: GAME_OUTCOMES.PENDING, meta: { wagerTxId: transaction._id } }).save();
    return { gameRound, transaction };
  },

  resolveWin: async (gameRoundId, payout, multiplier = 1, meta = {}) => {
    const gameRound = await GameRound.findById(gameRoundId);
    if (!gameRound) throw new Error("Game round not found");
    if (gameRound.outcome !== GAME_OUTCOMES.PENDING) throw new Error("Game already settled");
    gameRound.outcome = GAME_OUTCOMES.WIN; gameRound.payout = payout; gameRound.multiplier = multiplier;
    gameRound.meta = { ...gameRound.meta, ...meta }; await gameRound.save();
    await pointsService.addPoints(gameRound.user, payout, TRANSACTION_TYPES.GAME_PAYOUT, `Win: ${gameRound.game} (${multiplier}x)`, { gameRoundId, payout });
    return { gameRound, balance: await pointsService.getBalance(gameRound.user) };
  },

  resolveLoss: async (gameRoundId, meta = {}) => {
    const gameRound = await GameRound.findById(gameRoundId);
    if (!gameRound) throw new Error("Game round not found");
    if (gameRound.outcome !== GAME_OUTCOMES.PENDING) throw new Error("Game already settled");
    gameRound.outcome = GAME_OUTCOMES.LOSS; gameRound.payout = 0; gameRound.multiplier = 0;
    gameRound.meta = { ...gameRound.meta, ...meta }; await gameRound.save();
    const user = await User.findById(gameRound.user);
    user.resetDailyLossesIfNeeded();
    const today = new Date().toISOString().split("T")[0];
    user.dailyLosses = { date: today, amount: (user.dailyLosses?.amount || 0) + gameRound.wager };
    await user.save();
    return { gameRound, netLoss: gameRound.wager };
  },

  resolveTie: async (gameRoundId, meta = {}) => {
    const gameRound = await GameRound.findById(gameRoundId);
    if (!gameRound) throw new Error("Game round not found");
    gameRound.outcome = GAME_OUTCOMES.TIE;
    gameRound.payout = gameRound.wager;
    gameRound.multiplier = 1;
    gameRound.meta = { ...gameRound.meta, ...meta };
    await gameRound.save();
    await pointsService.addPoints(gameRound.user, gameRound.wager, TRANSACTION_TYPES.GAME_PAYOUT, `Tie: ${gameRound.game}`, { gameRoundId, payout: gameRound.wager });
    return { gameRound, balance: gameRound.wager };
  },

  playCoinFlip: async (userId, wager, chosenSide) => {
    if (!["heads", "tails"].includes(chosenSide)) throw new Error("Choose 'heads' or 'tails'");
    const { gameRound } = await gameService.placeWager(userId, GAME_TYPES.COIN_FLIP, wager);
    const resultSide = Math.random() < 0.49 ? "heads" : "tails";
    const won = resultSide === chosenSide;
    if (won) return await gameService.resolveWin(gameRound._id, wager * 2, 2, { chosenSide, resultSide, won });
    return await gameService.resolveLoss(gameRound._id, { chosenSide, resultSide, won });
  },

  startMines: async (userId, wager, bombCount = 3, _gridSize = 5, clientSeed = "") => {
    const validGridSize = 5;
    const totalTiles = 25;
    const validBombCount = Math.min(Math.max(parseInt(bombCount), 1), totalTiles - 1);
    wager = parseInt(wager);
    if (!Number.isFinite(wager) || wager <= 0) throw new Error("Invalid wager");
    // auto-forfeit stale pending so user never spawns locked — 5x5 only
    let active = await GameRound.findOne({ user: userId, game: GAME_TYPES.MINES, outcome: GAME_OUTCOMES.PENDING });
    if (active) {
      try { await gameService.resolveLoss(active._id, { ...active.meta, forfeited: true, autoForfeitedAt: new Date().toISOString() }); } catch {}
      active = null;
    }
    await gameService.validateWager(userId, GAME_TYPES.MINES, wager);
    const { gameRound } = await gameService.placeWager(userId, GAME_TYPES.MINES, wager);
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashSeed(serverSeed);
    const safeClientSeed = (clientSeed && String(clientSeed).slice(0, 64)) || crypto.randomBytes(8).toString("hex");
    const nonce = Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
    let bombPositions;
    try { bombPositions = generateMinePositions(totalTiles, validBombCount, serverSeed, safeClientSeed, nonce); }
    catch { bombPositions = generateRandomMinePositions(totalTiles, validBombCount); }
    gameRound.meta = { wagerTxId: gameRound.meta.wagerTxId, bombCount: validBombCount, bombPositions, revealedCells: [], gridSize: validGridSize, totalTiles, serverSeed, serverSeedHash, clientSeed: safeClientSeed, nonce, currentMultiplier: 1 };
    await gameRound.save();
    const nextMultiplier = gameService.calculateMultiplier(totalTiles, validBombCount, 1);
    return { gameRound, gameId: gameRound._id, status: "active", multiplier: 1, nextMultiplier, potentialWin: 0, serverSeedHash, clientSeed: safeClientSeed, nonce, gridSize: validGridSize, totalTiles, mines: validBombCount, balance: await pointsService.getBalance(userId) };
  },

  revealMines: async (userId, gameRoundId, cell) => {
    const gameRound = await GameRound.findOne({ _id: gameRoundId, user: userId, game: GAME_TYPES.MINES });
    if (!gameRound) throw new Error("Mines round not found");
    if (gameRound.outcome !== GAME_OUTCOMES.PENDING) throw new Error("This Mines round is already settled");
    const totalTiles = gameRound.meta?.totalTiles || 25;
    const selectedCell = parseInt(cell);
    if (!Number.isFinite(selectedCell) || selectedCell < 0 || selectedCell >= totalTiles) throw new Error(`Cell must be between 0 and ${totalTiles - 1}`);
    const revealedCells = gameRound.meta?.revealedCells || [];
    if (revealedCells.includes(selectedCell)) throw new Error("That cell is already revealed");
    const bombPositions = gameRound.meta?.bombPositions || [];
    const bombCount = gameRound.meta?.bombCount || 3;
    if (bombPositions.includes(selectedCell)) {
      const result = await gameService.resolveLoss(gameRoundId, { ...gameRound.meta, selectedCell, revealedCells, hitMine: selectedCell });
      return { ...result, result: "mine", tile: selectedCell, selectedCell, hitMine: selectedCell, minePositions: bombPositions, revealedCells, status: "lost", multiplier: 0, payout: 0 };
    }
    const nextRevealed = [...revealedCells, selectedCell];
    const multiplier = gameService.calculateMultiplier(totalTiles, bombCount, nextRevealed.length);
    const potentialWin = Math.floor(gameRound.wager * multiplier);
    const hasMore = nextRevealed.length < (totalTiles - bombCount);
    const nextMultiplier = hasMore ? gameService.calculateMultiplier(totalTiles, bombCount, nextRevealed.length + 1) : null;
    gameRound.meta = { ...gameRound.meta, revealedCells: nextRevealed, selectedCell, currentMultiplier: multiplier };
    gameRound.multiplier = multiplier;
    await gameRound.save();
    if (nextRevealed.length === totalTiles - bombCount) {
      const payout = Math.floor(gameRound.wager * multiplier);
      const winResult = await gameService.resolveWin(gameRoundId, payout, multiplier, { ...gameRound.meta, autoWin: true, clearedBoard: true });
      return { ...winResult, result: "safe", tile: selectedCell, selectedCell, revealedCells: nextRevealed, multiplier, potentialWin: payout, payout, status: "won", canCashOut: false, nextMultiplier: null, autoWin: true, minePositions: bombPositions, balance: await pointsService.getBalance(userId) };
    }
    return { gameRound, result: "safe", tile: selectedCell, selectedCell, revealedCells: nextRevealed, multiplier, potentialWin, nextMultiplier, canCashOut: true, status: "active", balance: await pointsService.getBalance(userId) };
  },

  cashOutMines: async (userId, gameRoundId) => {
    const gameRound = await GameRound.findOne({ _id: gameRoundId, user: userId, game: GAME_TYPES.MINES });
    if (!gameRound) throw new Error("Mines round not found");
    if (gameRound.outcome !== GAME_OUTCOMES.PENDING) throw new Error("This Mines round is already settled");
    const revealedCells = gameRound.meta?.revealedCells || [];
    if (revealedCells.length === 0) throw new Error("Reveal at least one safe cell before cashing out");
    const tt = gameRound.meta?.totalTiles || 25;
    const bc = gameRound.meta?.bombCount || 3;
    const multiplier = gameRound.meta?.currentMultiplier || gameService.calculateMultiplier(tt, bc, revealedCells.length);
    const payout = Math.floor(gameRound.wager * multiplier);
    const result = await gameService.resolveWin(gameRoundId, payout, multiplier, { ...gameRound.meta, cashedOut: true });
    return { ...result, result: "cashed_out", payout, multiplier, potentialWin: payout, minePositions: gameRound.meta?.bombPositions || [], revealedCells, status: "won" };
  },
  abandonMines: async (userId) => {
    const gameRound = await GameRound.findOne({ user: userId, game: GAME_TYPES.MINES, outcome: GAME_OUTCOMES.PENDING }).sort({ createdAt: -1 });
    if (!gameRound) throw new Error("No active Mines game to abandon");
    // forfeit = loss (no payout, bomb positions revealed afterwards)
    return await gameService.resolveLoss(gameRound._id, { ...gameRound.meta, forfeited: true, abandonedAt: new Date().toISOString() });
  },



  getGameHistory: async (userId, options = {}) => {
    const { limit = 20, skip = 0, gameType } = options;
    const query = { user: userId };
    if (gameType) query.game = gameType;
    const games = await GameRound.find(query).sort({ playedAt: -1 }).skip(skip).limit(limit);
    const total = await GameRound.countDocuments(query);
    return { games, total };
  },

  getUserStats: async (userId) => {
    const games = await GameRound.find({ user: userId });
    const stats = { totalGames: 0, wins: 0, losses: 0, totalWagered: 0, totalPayout: 0 };
    games.forEach(g => {
      stats.totalGames++;
      stats.totalWagered += g.wager;
      if (g.outcome === GAME_OUTCOMES.WIN) { stats.wins++; stats.totalPayout += g.payout; }
      else if (g.outcome === GAME_OUTCOMES.LOSS) stats.losses++;
    });
    stats.winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : "0";
    return stats;
  },
};

module.exports = gameService;