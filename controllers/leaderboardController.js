const axios = require("axios");

const DISCLOSURE_TEXT = `
Your wagers on Roobet will count towards the leaderboard at the following weights based on the games you are playing. This helps prevent leaderboard abuse:

- Games with an RTP of 97% or less will contribute 100% of the amount wagered to the leaderboard.
- Games with an RTP above 97% will contribute 50% of the amount wagered to the leaderboard.
- Games with an RTP of 98% and above will contribute 10% of the amount wagered to the leaderboard.

- Only Slots and Housegames count (dice is excluded)
`;

function blurUsername(username) {
  if (!username || username.length <= 2) return "***";
  const firstChar = username.charAt(0);
  const lastChar = username.charAt(username.length - 1);
  const blurredPart = "*".repeat(Math.max(0, username.length - 2));
  return firstChar + blurredPart + lastChar;
}

function getStartOfDay(dateStr) {
  return new Date(dateStr + "T00:00:00.000Z").toISOString();
}

function getEndOfDay(dateStr) {
  return new Date(dateStr + "T23:59:59.999Z").toISOString();
}

const leaderboardController = {
  getLeaderboard: async (req, res) => {
    try {
      const { startDate, endDate, sortBy } = req.query;

      const params = {
        userId: process.env.USER_ID,
        categories: "slots,provably fair", // Only Slots & Housegames excluding dice
      };

      if (startDate) params.startDate = getStartOfDay(startDate);
      if (endDate) params.endDate = getEndOfDay(endDate);
      if (sortBy) params.sortBy = sortBy;

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

      // Default sorting by weightedWagered
      if (!sortBy) {
        processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);
      }

      res.json({
        disclosure: DISCLOSURE_TEXT,
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
