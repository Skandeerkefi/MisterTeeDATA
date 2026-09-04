const mongoose = require("mongoose");

const affiliateSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true,
		maxLength: 200,
	},
	logoUrl: {
		type: String,
		default: "",
	},
	signupUrl: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		default: "",
	},
	order: {
		type: Number,
		default: 0,
	},
	active: {
		type: Boolean,
		default: true,
		index: true,
	},
	clicks: {
		type: Number,
		default: 0,
	},
}, { timestamps: true });

affiliateSchema.index({ order: 1 });
affiliateSchema.index({ active: 1, order: 1 });

const Affiliate = mongoose.model("Affiliate", affiliateSchema);
module.exports = { Affiliate };