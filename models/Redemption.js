const mongoose = require("mongoose");

const REDEMPTION_STATUS = {
	PENDING: "pending",
	APPROVED: "approved",
	REJECTED: "rejected",
	FULFILLED: "fulfilled",
};

const redemptionSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
		index: true,
	},
	shopItem: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "ShopItem",
		required: true,
	},
	costPaid: {
		type: Number,
		required: true,
	},
	status: {
		type: String,
		enum: Object.values(REDEMPTION_STATUS),
		default: REDEMPTION_STATUS.PENDING,
		index: true,
	},
	fulfillmentStatus: {
		type: String,
		enum: ["pending", "granted", "shipped", "delivered", "cancelled"],
		default: "pending",
	},
	fulfillmentNotes: {
		type: String,
		default: "",
	},
	requestedAt: {
		type: Date,
		default: Date.now,
	},
	resolvedAt: {
		type: Date,
	},
	resolvedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	rejectionReason: {
		type: String,
		default: "",
	},
}, { timestamps: true });

redemptionSchema.index({ user: 1, createdAt: -1 });
redemptionSchema.index({ status: 1, createdAt: -1 });

const Redemption = mongoose.model("Redemption", redemptionSchema);
module.exports = { Redemption, REDEMPTION_STATUS };