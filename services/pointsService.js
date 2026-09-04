const { User } = require("../models/User");
const { PointsTransaction, TRANSACTION_TYPES } = require("../models/PointsTransaction");

/**
 * Points Service - All points operations MUST go through this service
 * Every points movement creates a PointsTransaction record
 */
const pointsService = {
  /**
   * Add points to a user (creates a credit transaction)
   */
  addPoints: async (userId, amount, type, description = "", meta = {}) => {
    if (amount <= 0) throw new Error("Amount must be positive for addPoints");
    
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    user.pointsBalance += amount;
    user.lifetimePointsEarned += amount;

    await user.save();

    const transaction = new PointsTransaction({
      user: userId,
      type,
      amount,
      balanceAfter: user.pointsBalance,
      description,
      meta,
    });
    await transaction.save();

    return { balance: user.pointsBalance, transaction };
  },

  /**
   * Deduct points from a user (creates a debit transaction)
   */
  deductPoints: async (userId, amount, type, description = "", meta = {}) => {
    if (amount <= 0) throw new Error("Amount must be positive for deductPoints");

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.pointsBalance < amount) throw new Error("Insufficient points balance");

    user.pointsBalance -= amount;
    await user.save();

    const transaction = new PointsTransaction({
      user: userId,
      type,
      amount: -amount,
      balanceAfter: user.pointsBalance,
      description,
      meta,
    });
    await transaction.save();

    return { balance: user.pointsBalance, transaction };
  },

  /**
   * Get user's current balance
   */
  getBalance: async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    return user.pointsBalance;
  },

  /**
   * Check if user has enough points
   */
  hasEnoughPoints: async (userId, amount) => {
    const balance = await pointsService.getBalance(userId);
    return balance >= amount;
  },

  /**
   * Get transaction history for a user
   */
  getTransactionHistory: async (userId, options = {}) => {
    const { limit = 50, skip = 0, type, startDate, endDate } = options;
    const query = { user: userId };

    if (type) query.type = type;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await PointsTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("adminId", "kickUsername");

    const total = await PointsTransaction.countDocuments(query);

    return { transactions, total, skip, limit };
  },

  /**
   * Get daily login bonus
   */
  processDailyLogin: async (userId, basePoints = 100, streakBonus = 10) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastLogin = user.lastDailyLogin ? new Date(user.lastDailyLogin) : null;

    if (lastLogin) {
      const lastLoginDay = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
      if (lastLoginDay.getTime() === today.getTime()) {
        throw new Error("Daily login already claimed today");
      }
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastLoginDay.getTime() === yesterday.getTime()) {
        user.loginStreak = (user.loginStreak || 0) + 1;
      } else {
        user.loginStreak = 1;
      }
    } else {
      user.loginStreak = 1;
    }

    const bonusPoints = basePoints + (user.loginStreak - 1) * streakBonus;
    user.lastDailyLogin = now;
    await user.save();

    await pointsService.addPoints(
      userId,
      bonusPoints,
      TRANSACTION_TYPES.DAILY_LOGIN,
      `Daily login bonus (streak: ${user.loginStreak})`,
      { streak: user.loginStreak, basePoints, bonusPoints }
    );

    if (user.loginStreak > 0 && user.loginStreak % 7 === 0) {
      const streakBonusPoints = 500;
      await pointsService.addPoints(
        userId,
        streakBonusPoints,
        TRANSACTION_TYPES.DAILY_LOGIN_STREAK,
        `7-day login streak bonus!`,
        { streak: user.loginStreak, bonus: streakBonusPoints }
      );
    }

    return { bonusPoints, streak: user.loginStreak, nextBonus: basePoints + user.loginStreak * streakBonus };
  },

  /**
   * Get all transactions (admin)
   */
  getAllTransactions: async (options = {}) => {
    const { limit = 100, skip = 0, type, userId, startDate, endDate } = options;
    const query = {};

    if (type) query.type = type;
    if (userId) query.user = userId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await PointsTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "kickUsername discordUsername")
      .populate("adminId", "kickUsername");

    const total = await PointsTransaction.countDocuments(query);

    return { transactions, total, skip, limit };
  },
};

module.exports = pointsService;