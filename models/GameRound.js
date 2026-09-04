const mongoose = require("mongoose");

const GAME_TYPES = {
	COIN_FLIP: "coinflip",
	MINES: "mines",
};

const GAME_OUTCOMES = {
	WIN: "win",
	LOSS: "loss",
	PENDING: "pending",
	TIE: "tie",
};

const gameRoundSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
		index: true,
	},
	game: {
		type: String,
		required: true,
		enum: Object.values(GAME_TYPES),
		index: true,
	},
	wager: {
		type: Number,
		required: true,
		min: 0,
	},
	payout: {
		type: Number,
		default: 0,
	},
	outcome: {
		type: String,
		enum: Object.values(GAME_OUTCOMES),
		default: GAME_OUTCOMES.PENDING,
	},
	// Multiplier won (e.g., 2.0x, 1.5x)
	multiplier: {
		type: Number,
		default: 0,
	},
	// Game-specific state stored as JSON
	// For mines: { selectedCell, bombCount, bombPositions }
	// For coinflip: { chosenSide, resultSide }
	meta: {
		type: mongoose.Schema.Types.Mixed,
		default: {},
	},
	playedAt: {
		type: Date,
		default: Date.now,
	},
}, { timestamps: true });

gameRoundSchema.index({ user: 1, playedAt: -1 });
gameRoundSchema.index({ game: 1, playedAt: -1 });
gameRoundSchema.index({ outcome: 1, playedAt: -1 });

const GameRound = mongoose.model("GameRound", gameRoundSchema);
module.exports = { GameRound, GAME_TYPES, GAME_OUTCOMES };