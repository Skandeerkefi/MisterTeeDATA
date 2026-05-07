const mongoose = require("mongoose");

const prizeMapSchema = {
	type: Map,
	of: Number,
	default: undefined,
};

const leaderboardDisplaySettingsSchema = new mongoose.Schema(
	{
		key: { type: String, default: "default", unique: true },
		roobet: {
			startDate: { type: String, default: "" },
			endDate: { type: String, default: "" },
			prizeByRank: prizeMapSchema,
		},
		csbattle: {
			from: { type: String, default: "" },
			to: { type: String, default: "" },
			prizeByRank: prizeMapSchema,
		},
	},
	{ timestamps: true }
);

module.exports = mongoose.model("LeaderboardDisplaySettings", leaderboardDisplaySettingsSchema);
