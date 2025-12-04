const axios = require("axios");

// Helper function to blur usernames
function blurUsername(username) {
  if (!username || username.length <= 2) return "***";
  const firstChar = username.charAt(0);
  const lastChar = username.charAt(username.length - 1);
  const blurredPart = "*".repeat(Math.max(0, username.length - 2));
  return firstChar + blurredPart + lastChar;
}

// Helper function to get start of day in ISO format
function getStartOfDay(dateStr) {
  return new Date(dateStr + "T00:00:00.000Z").toISOString();
}

// Helper function to get end of day in ISO format
function getEndOfDay(dateStr) {
  return new Date(dateStr + "T23:59:59.999Z").toISOString();
}

const leaderboardController = {
  // Get full leaderboard with optional query params
  getLeaderboard: async (req, res) => {
	try {
	  const { startDate, endDate } = req.query;

	  const params = {
		userId: process.env.USER_ID,
	  };

	  if (startDate) params.startDate = getStartOfDay(startDate);
	  if (endDate) params.endDate = getEndOfDay(endDate);

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

	  // Sort by weightedWagered descending
	  processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

	  res.json({
		disclosure:
		  "All games are included. Weighted wager values come directly from Roobet’s Affiliate API.",
		data: processedData,
	  });
	} catch (error) {
	  console.error("Error fetching leaderboard data:", error.message);
	  res.status(500).json({
		error: "Failed to fetch leaderboard data",
		details: error.response?.data || error.message,
	  });
	}
  },

  // Get leaderboard by date range (via route params)
  getLeaderboardByDate: async (req, res) => {
	try {
	  const { startDate, endDate } = req.params;

	  const params = {
		userId: process.env.USER_ID,
	  };

	  if (startDate) params.startDate = getStartOfDay(startDate);
	  if (endDate) params.endDate = getEndOfDay(endDate);

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

	  // Sort by weightedWagered descending
	  processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);

	  res.json({
		disclosure:
		  "All games included. Weighted wager values are provided directly by Roobet.",
		data: processedData,
	  });
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
