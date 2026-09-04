const mongoose = require("mongoose");

const shopItemSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true,
		maxLength: 200,
	},
	description: {
		type: String,
		default: "",
		trim: true,
		maxLength: 2000,
	},
	imageUrl: {
		type: String,
		default: "",
	},
	costInPoints: {
		type: Number,
		required: true,
		min: 0,
	},
	// null = unlimited stock
	stock: {
		type: Number,
		default: null,
	},
	// Track remaining stock when limited
	stockRemaining: {
		type: Number,
		default: null,
	},
	active: {
		type: Boolean,
		default: true,
		index: true,
	},
	category: {
		type: String,
		enum: ["digital", "physical", "role", "other"],
		default: "other",
	},
	displayOrder: {
		type: Number,
		default: 0,
	},
}, { timestamps: true });

// Virtual to check if item is purchasable
shopItemSchema.virtual("isAvailable").get(function () {
	if (!this.active) return false;
	if (this.stock !== null && this.stockRemaining <= 0) return false;
	return true;
});

shopItemSchema.set("toJSON", { virtuals: true });

const ShopItem = mongoose.model("ShopItem", shopItemSchema);
module.exports = { ShopItem };