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

			// ✅ Only allowed categories (from Roobet docs)
			const params = {
				userId: process.env.USER_ID,
				categories: "slots,provably fair", 
				// ❌ providers removed (not allowed for category filtering)
				// ❌ dice exclusion removed, already excluded by category
			};

			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

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
				weightedWagered: player.weightedWagered,
				favoriteGameId: player.favoriteGameId,
				favoriteGameTitle: player.favoriteGameTitle,
				rankLevel: player.rankLevel,
				rankLevelImage: player.rankLevelImage,
				highestMultiplier: player.highestMultiplier,
			}));

			processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

			const leaderboardWithDisclosure = {
				disclosure:
					"Leaderboard filtered to Slots & House Games only using official Roobet categories (slots,provably fair). Dice and other excluded games are automatically filtered out based on the category rules.",
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
				weightedWagered: player.weightedWagered,
				favoriteGameId: player.favoriteGameId,
				favoriteGameTitle: player.favoriteGameTitle,
				rankLevel: player.rankLevel,
				rankLevelImage: player.rankLevelImage,
				highestMultiplier: player.highestMultiplier,
			}));

			processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

			const leaderboardWithDisclosure = {
				disclosure:
					"Leaderboard filtered to Slots & House Games only using official Roobet categories (slots,provably fair).",
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
