const axios = require("axios");

// Helper function to blur usernames
function blurUsername(username) {
	if (!username || username.length <= 2) return "***";
	const firstChar = username.charAt(0);
	const lastChar = username.charAt(username.length - 1);
	const blurredPart = "*".repeat(Math.max(0, username.length - 2));
	return firstChar + blurredPart + lastChar;
}

const leaderboardController = {
	getLeaderboard: async (req, res) => {
		try {
			const { startDate, endDate } = req.query;

			const params = {
				userId: process.env.USER_ID,
				categories: "slots,provably fair", // Slots & House games only
				providers: "-dice", // Exclude dice games
			};

			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

			// ✅ Call Roobet Affiliate API directly
			const response = await axios.get(
				`${process.env.API_BASE_URL}/affiliate/v2/stats`,
				{
					params,
					headers: {
						Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
					},
				}
			);

			// ✅ Use weightedWagered directly from Roobet
			const processedData = response.data.map((player) => ({
				uid: player.uid,
				username: blurUsername(player.username),
				wagered: player.wagered,
				weightedWagered: player.weightedWagered, // ✅ direct from API
				favoriteGameId: player.favoriteGameId,
				favoriteGameTitle: player.favoriteGameTitle,
				rankLevel: player.rankLevel,
				rankLevelImage: player.rankLevelImage,
				highestMultiplier: player.highestMultiplier,
			}));

			// ✅ Sort descending by weighted wager
			processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

			const leaderboardWithDisclosure = {
				disclosure:
					"Weighted wager values are provided directly by Roobet's Affiliate API and reflect official contribution weighting based on RTP and game category. Only Slots and House Games (excluding Dice) are counted.",
				data: processedData,
			};

			res.json(leaderboardWithDisclosure);
		} catch (error) {
			console.error("Error fetching leaderboard data:", error.message);
			res.status(500).json({
				error: "Failed to fetch leaderboard data",
				details: error.response?.data || error.message,
			});
		}
	},

	getLeaderboardByDate: async (req, res) => {
		try {
			const { startDate, endDate } = req.params;

			const params = {
				userId: process.env.USER_ID,
				categories: "slots,provably fair",
				providers: "-dice",
				startDate,
				endDate,
			};

			const response = await axios.get(
				`${process.env.API_BASE_URL}/affiliate/v2/stats`,
				{
					params,
					headers: {
						Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
					},
				}
			);

			const processedData = response.data.map((player) => ({
				uid: player.uid,
				username: blurUsername(player.username),
				wagered: player.wagered,
				weightedWagered: player.weightedWagered, // ✅ API-provided field
				favoriteGameId: player.favoriteGameId,
				favoriteGameTitle: player.favoriteGameTitle,
				rankLevel: player.rankLevel,
				rankLevelImage: player.rankLevelImage,
				highestMultiplier: player.highestMultiplier,
			}));

			processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

			const leaderboardWithDisclosure = {
				disclosure:
					"Weighted wager values are directly provided by Roobet’s Affiliate API to prevent leaderboard manipulation. Only Slots and House Games count (dice excluded).",
				data: processedData,
			};

			res.json(leaderboardWithDisclosure);
		} catch (error) {
			console.error("Error fetching leaderboard data:", error.message);
			res.status(500).json({
				error: "Failed to fetch leaderboard data",
				details: error.response?.data || error.message,
			});
		}
	},
};

module.exports = leaderboardController;
