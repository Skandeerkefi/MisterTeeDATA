const axios = require("axios");

// Helper function to blur usernames
function blurUsername(username) {
	if (!username || username.length <= 2) return "***";

	const firstChar = username.charAt(0);
	const lastChar = username.charAt(username.length - 1);
	const blurredPart = "*".repeat(Math.max(0, username.length - 2));

	return firstChar + blurredPart + lastChar;
}

// Helper function to calculate weighted wager based on RTP
function calculateWeightedWager(wagered, gameRtp) {
	if (!gameRtp || gameRtp <= 97) {
		return wagered; // 100% contribution
	} else if (gameRtp > 97 && gameRtp < 98) {
		return wagered * 0.5; // 50% contribution
	} else if (gameRtp >= 98) {
		return wagered * 0.1; // 10% contribution
	}
	return wagered; // Default to 100% if RTP is unknown
}

// Get RTP for a game based on its identifier
function getGameRtp(gameIdentifier) {
	// This is a simplified implementation. In a real scenario, you would
	// need to maintain a database or API mapping game identifiers to their RTP values

	// Example mapping - you would need to expand this with actual game data
	const gameRtpMap = {
		"pragmatic:vs20fruitsw": 96.5,
		"hacksaw:1059": 96.0,
		"housegames:Plinko": 97.5,
		"housegames:hotbox": 97.8,
		"housegames:roulette": 97.2,
		"housegames:towers": 97.6,
		"housegames:coinflip": 97.0,
		"housegames:junglemines": 97.3,
		"housegames:mines": 97.4,
		"housegames:crash": 97.7,
		"housegames:linearmines": 97.1,
		"luckypengwin:yetiCashDash": 96.8,
	};

	return gameRtpMap[gameIdentifier] || 96.0; // Default to 96% if unknown
}

const leaderboardController = {
	getLeaderboard: async (req, res) => {
		try {
			const { startDate, endDate } = req.query;

			// Build API parameters
			const params = {
				userId: process.env.USER_ID,
				categories: "slots,provably fair",
				providers: "-dice", // Exclude dice games
			};

			// Add date parameters if provided
			if (startDate) params.startDate = startDate;
			if (endDate) params.endDate = endDate;

			// Make API request to Roobet
			const response = await axios.get(
				`${process.env.API_BASE_URL}/affiliate/v2/stats`,
				{
					params,
					headers: {
						Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
					},
				}
			);

			// Process the data according to requirements
			const processedData = response.data.map((player) => ({
				uid: player.uid,
				username: blurUsername(player.username),
				wagered: player.wagered,
				weightedWagered: calculateWeightedWager(
					player.wagered,
					getGameRtp(player.favoriteGameId)
				),
				favoriteGameId: player.favoriteGameId,
				favoriteGameTitle: player.favoriteGameTitle,
				rankLevelImage: player.rankLevelImage,
			}));

			// Sort by weighted wager (descending)
			processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

			// Add leaderboard disclosure
			const leaderboardWithDisclosure = {
				disclosure:
					"Your wagers on Robbet will count towards the leaderboard at the following weights based on the games you are playing. This helps prevent leaderboard abuse: Games with an RTP of 97% or less will contribute 100% of the amount wagered to the leaderboard. Games with an RTP above 97% will contribute 50% of the amount wagered to the leaderboard. Games with an RTP of 98% and above will contribute 10% of the amount wagered to the leaderboard. Only Slots and Housegames count (dice is excluded)",
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

			// Build API parameters
			const params = {
				userId: process.env.USER_ID,
				categories: "slots,provably fair",
				providers: "-dice", // Exclude dice games
				startDate,
				endDate,
			};

			// Make API request to Roobet
			const response = await axios.get(
				`${process.env.API_BASE_URL}/affiliate/v2/stats`,
				{
					params,
					headers: {
						Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
					},
				}
			);

			// Process the data according to requirements
			const processedData = response.data.map((player) => ({
				uid: player.uid,
				username: blurUsername(player.username),
				wagered: player.wagered,
				weightedWagered: calculateWeightedWager(
					player.wagered,
					getGameRtp(player.favoriteGameId)
				),
				favoriteGameId: player.favoriteGameId,
				favoriteGameTitle: player.favoriteGameTitle,
				rankLevelImage: player.rankLevelImage, // /<-- Added this line
			}));

			// Sort by weighted wager (descending)
			processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

			// Add leaderboard disclosure
			const leaderboardWithDisclosure = {
				disclosure:
					"Your wagers on Robbet will count towards the leaderboard at the following weights based on the games you are playing. This helps prevent leaderboard abuse: Games with an RTP of 97% or less will contribute 100% of the amount wagered to the leaderboard. Games with an RTP above 97% will contribute 50% of the amount wagered to the leaderboard. Games with an RTP of 98% and above will contribute 10% of the amount wagered to the leaderboard. Only Slots and Housegames count (dice is excluded)",
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
