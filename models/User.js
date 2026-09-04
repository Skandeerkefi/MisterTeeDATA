const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
	kickUsername: { type: String, required: true, unique: true },
	rainbetUsername: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	role: { type: String, enum: ["user", "admin"], default: "user" },

	// Discord linking
	discordId: { type: String, unique: true, sparse: true },
	discordUsername: { type: String },

	// Points system
	pointsBalance: { type: Number, default: 0 },
	lifetimePointsEarned: { type: Number, default: 0 },

	// Kick integration
	kickId: { type: String, sparse: true },
	hasLinkedKick: { type: Boolean, default: false },
	hasLinkedDiscord: { type: Boolean, default: false },

	// Daily login tracking
	lastDailyLogin: { type: Date },
	loginStreak: { type: Number, default: 0 },

	// Daily loss tracking
	dailyLosses: {
		date: { type: String },
		amount: { type: Number, default: 0 },
	},

	// Account status
	isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();
	this.password = await bcrypt.hash(this.password, 10);
	next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
	return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.resetDailyLossesIfNeeded = function () {
	const today = new Date().toISOString().split("T")[0];
	if (this.dailyLosses?.date !== today) {
		this.dailyLosses = { date: today, amount: 0 };
	}
	return this;
};

const User = mongoose.model("User", userSchema);
module.exports = { User };
