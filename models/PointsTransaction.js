const mongoose = require("mongoose");

// Transaction types:
const TRANSACTION_TYPES = {
	// System activities
	DAILY_LOGIN: "daily-login",
	DAILY_LOGIN_STREAK: "daily-login-streak",
	GIVEAWAY_JOIN: "giveaway-join",
	GIVEAWAY_WIN: "giveaway-win",

	// Games
	GAME_WAGER: "game-wager",
	GAME_PAYOUT: "game-payout",

	// Shop
	REWARD_REDEMPTION: "reward-redemption",
	REDEMPTION_REJECTED: "redemption-rejected",

	// Admin
	ADMIN_ADJUSTMENT: "admin-adjustment",
	SYSTEM_TRANSACTION: "system-transaction",

	// Slot calls
	SLOT_CALL_CREATE: "slot-call-create",
	SLOT_CALL_ACCEPT: "slot-call-accept",
	SLOT_CALL_1600X: "slot-call-1600x",
};

const pointsTransactionSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
		index: true,
	},
	type: {
		type: String,
		required: true,
		enum: Object.values(TRANSACTION_TYPES),
		index: true,
	},
	amount: {
		type: Number,
		required: true,
	},
	balanceAfter: {
		type: Number,
		required: true,
	},
	description: {
		type: String,
		default: "",
	},
	// For games: reference to the game round
	gameRoundId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "GameRound",
	},
	// For redemptions: reference to the redemption
	redemptionId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Redemption",
	},
	// Admin who made this adjustment (for admin-adjustment type)
	adminId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	// Additional metadata stored as a flexible object
	meta: {
		type: mongoose.Schema.Types.Mixed,
		default: {},
	},
}, { timestamps: true });

// Compound index for efficient queries by user + type + time
pointsTransactionSchema.index({ user: 1, type: 1, createdAt: -1 });
pointsTransactionSchema.index({ createdAt: -1 });

const PointsTransaction = mongoose.model("PointsTransaction", pointsTransactionSchema);

module.exports = { PointsTransaction, TRANSACTION_TYPES };