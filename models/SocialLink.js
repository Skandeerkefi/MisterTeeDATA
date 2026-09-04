const mongoose = require("mongoose");

const SOCIAL_PLATFORMS = {
	DISCORD: "discord",
	KICK: "kick",
	TWITTER: "twitter",
	YOUTUBE: "youtube",
	TWITCH: "twitch",
	TIKTOK: "tiktok",
	INSTAGRAM: "instagram",
};

const socialLinkSchema = new mongoose.Schema({
	platform: {
		type: String,
		required: true,
		unique: true,
		enum: Object.values(SOCIAL_PLATFORMS),
	},
	url: {
		type: String,
		required: true,
	},
	order: {
		type: Number,
		default: 0,
	},
	active: {
		type: Boolean,
		default: true,
	},
	iconName: {
		type: String,
		default: "",
	},
}, { timestamps: true });

socialLinkSchema.index({ order: 1 });

const SocialLink = mongoose.model("SocialLink", socialLinkSchema);
module.exports = { SocialLink, SOCIAL_PLATFORMS };