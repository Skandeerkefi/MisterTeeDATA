const mongoose = require("mongoose");
const { GAME_TYPES } = require("./GameRound");

const gameConfigSchema = new mongoose.Schema({
	game: {
		type: String,
		required: true,
		unique: true,
		enum: Object.values(GAME_TYPES),
	},
	active: {
		type: Boolean,
		default: true,
	},
	// Wager limits
	minWager: {
		type: Number,
		default: 10,
		min: 1,
	},
	maxWager: {
		type: Number,
		default: 10000,
	},
	// Daily loss cap per user (in points)
	dailyLossCap: {
		type: Number,
		default: 50000,
	},
	// RTP percentage (e.g., 95 = 95% return to player)
	rtp: {
		type: Number,
		default: 95,
		min: 0,
		max: 100,
	},
	// Game-specific configuration
	// Coin Flip: { headsOdds, tailsOdds }
	// Blackjack: { blackjackMultiplier, numberOfDecks }
	// Mines: { defaultMines, maxMines, multiplierPerSafe }
	// Tower: { defaultFloors, maxFloors, multiplierPerFloor }
	config: {
		type: mongoose.Schema.Types.Mixed,
		default: {},
	},
}, { timestamps: true });

const GameConfig = mongoose.model("GameConfig", gameConfigSchema);
module.exports = { GameConfig };