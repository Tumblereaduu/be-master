const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");

// ============================================================================
// MASTER DASHBOARD - All system data, no filtering
// ============================================================================

const getMasterDashboard = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;

    // Get all metrics in aggregated queries
    const [adminStats] = await queryDatabase(
      `SELECT COUNT(*) AS total FROM ${TABLES.ADMINS} WHERE master_id = ? AND deleted_at IS NULL`,
      [masterId]
    );

    const [userStats] = await queryDatabase(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN user_status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN user_status = 'inactive' THEN 1 ELSE 0 END) AS inactive
      FROM ${TABLES.REGISTER} WHERE admin_id = ? AND deleted_at IS NULL`,
      [masterId]
    );

    const [todayRegistrations] = await queryDatabase(
      `SELECT COUNT(*) AS count FROM ${TABLES.REGISTER} WHERE admin_id = ? AND DATE(account_created_at) = CURDATE() AND deleted_at IS NULL`,
      [masterId]
    );

    const [depositStats] = await queryDatabase(
      `SELECT 
        SUM(CASE WHEN deposit_status = 'completed' THEN requested_amount_usd ELSE 0 END) AS completed,
        SUM(CASE WHEN deposit_status = 'pending' THEN requested_amount_usd ELSE 0 END) AS pending,
        SUM(CASE WHEN deposit_status = 'rejected' THEN requested_amount_usd ELSE 0 END) AS rejected
      FROM ${TABLES.USER_DEPOSIT_TRANSACTION} WHERE admin_id = ? AND deleted_at IS NULL`,
      [masterId]
    );

    const [withdrawalStats] = await queryDatabase(
      `SELECT 
        SUM(CASE WHEN withdrawal_status = 'completed' THEN requested_amount_usd ELSE 0 END) AS completed,
        SUM(CASE WHEN withdrawal_status = 'pending' THEN requested_amount_usd ELSE 0 END) AS pending,
        SUM(CASE WHEN withdrawal_status = 'rejected' THEN requested_amount_usd ELSE 0 END) AS rejected
      FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} WHERE admin_id = ? AND deleted_at IS NULL`,
      [masterId]
    );

    const [liveWalletStats] = await queryDatabase(
      `SELECT SUM(wallet) AS total_balance FROM ${TABLES.LIVE_USERS_WALLET} WHERE admin_id = ? AND deleted_at IS NULL`,
      [masterId]
    );

    const [demoWalletStats] = await queryDatabase(
      `SELECT SUM(wallet) AS total_balance FROM ${TABLES.DEMO_USERS_WALLET} WHERE admin_id = ? AND deleted_at IS NULL`,
      [masterId]
    );

    const [orderStats] = await queryDatabase(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN order_status = 'active' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN order_status IN ('completed', 'cancelled', 'closed') THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today
      FROM ${TABLES.LIVE_USERS_ORDERS} WHERE admin_id = ? AND deleted_at IS NULL`,
      [masterId]
    );

    const [tradingPnL] = await queryDatabase(
      `SELECT 
        SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) AS total_profit,
        SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) AS total_loss,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN pnl ELSE 0 END) AS today_pnl
      FROM ${TABLES.LIVE_USERS_ORDERS} WHERE admin_id = ? AND deleted_at IS NULL`,
      [masterId]
    );

    return res.status(200).json({
      status: "success",
      message: "Master dashboard retrieved",
      data: {
        system: {
          totalAdmins: adminStats[0]?.total || 0,
          totalUsers: userStats[0]?.total || 0,
          activeUsers: userStats[0]?.active || 0,
          inactiveUsers: userStats[0]?.inactive || 0,
          todayRegistrations: todayRegistrations[0]?.count || 0
        },
        deposits: {
          completed: depositStats[0]?.completed || 0,
          pending: depositStats[0]?.pending || 0,
          rejected: depositStats[0]?.rejected || 0
        },
        withdrawals: {
          completed: withdrawalStats[0]?.completed || 0,
          pending: withdrawalStats[0]?.pending || 0,
          rejected: withdrawalStats[0]?.rejected || 0
        },
        wallets: {
          liveBalance: liveWalletStats[0]?.total_balance || 0,
          demoBalance: demoWalletStats[0]?.total_balance || 0
        },
        trading: {
          totalTrades: orderStats[0]?.total || 0,
          openTrades: orderStats[0]?.open || 0,
          closedTrades: orderStats[0]?.closed || 0,
          todayTrades: orderStats[0]?.today || 0,
          totalProfit: tradingPnL[0]?.total_profit || 0,
          totalLoss: tradingPnL[0]?.total_loss || 0,
          todayPnL: tradingPnL[0]?.today_pnl || 0
        }
      }
    });
  } catch (error) {
    console.error("Master dashboard error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving dashboard"
    });
  }
};

// ============================================================================
// ADMIN DASHBOARD - Only admin's users and transactions
// ============================================================================

const getAdminDashboard = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const masterId = req.user?.master_id;

    if (!adminId) {
      return res.status(400).json({
        status: "error",
        message: "Admin ID required"
      });
    }

    // Get all metrics filtered by admin_id
    const [userStats] = await queryDatabase(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN user_status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN user_status = 'inactive' THEN 1 ELSE 0 END) AS inactive
      FROM ${TABLES.REGISTER} WHERE admin_id = ? AND deleted_at IS NULL`,
      [adminId]
    );

    const [todayRegistrations] = await queryDatabase(
      `SELECT COUNT(*) AS count FROM ${TABLES.REGISTER} WHERE admin_id = ? AND DATE(account_created_at) = CURDATE() AND deleted_at IS NULL`,
      [adminId]
    );

    const [depositStats] = await queryDatabase(
      `SELECT 
        SUM(CASE WHEN deposit_status = 'completed' THEN requested_amount_usd ELSE 0 END) AS completed,
        SUM(CASE WHEN deposit_status = 'pending' THEN requested_amount_usd ELSE 0 END) AS pending,
        SUM(CASE WHEN deposit_status = 'rejected' THEN requested_amount_usd ELSE 0 END) AS rejected
      FROM ${TABLES.USER_DEPOSIT_TRANSACTION} WHERE admin_id = ? AND deleted_at IS NULL`,
      [adminId]
    );

    const [withdrawalStats] = await queryDatabase(
      `SELECT 
        SUM(CASE WHEN withdrawal_status = 'completed' THEN requested_amount_usd ELSE 0 END) AS completed,
        SUM(CASE WHEN withdrawal_status = 'pending' THEN requested_amount_usd ELSE 0 END) AS pending,
        SUM(CASE WHEN withdrawal_status = 'rejected' THEN requested_amount_usd ELSE 0 END) AS rejected
      FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} WHERE admin_id = ? AND deleted_at IS NULL`,
      [adminId]
    );

    const [liveWalletStats] = await queryDatabase(
      `SELECT SUM(wallet) AS total_balance FROM ${TABLES.LIVE_USERS_WALLET} WHERE admin_id = ? AND deleted_at IS NULL`,
      [adminId]
    );

    const [demoWalletStats] = await queryDatabase(
      `SELECT SUM(wallet) AS total_balance FROM ${TABLES.DEMO_USERS_WALLET} WHERE admin_id = ? AND deleted_at IS NULL`,
      [adminId]
    );

    const [orderStats] = await queryDatabase(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN order_status = 'active' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN order_status IN ('completed', 'cancelled', 'closed') THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS today
      FROM ${TABLES.LIVE_USERS_ORDERS} WHERE admin_id = ? AND deleted_at IS NULL`,
      [adminId]
    );

    const [tradingPnL] = await queryDatabase(
      `SELECT 
        SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) AS total_profit,
        SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) AS total_loss,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN pnl ELSE 0 END) AS today_pnl
      FROM ${TABLES.LIVE_USERS_ORDERS} WHERE admin_id = ? AND deleted_at IS NULL`,
      [adminId]
    );

    return res.status(200).json({
      status: "success",
      message: "Admin dashboard retrieved",
      data: {
        users: {
          total: userStats[0]?.total || 0,
          active: userStats[0]?.active || 0,
          inactive: userStats[0]?.inactive || 0,
          todayRegistrations: todayRegistrations[0]?.count || 0
        },
        deposits: {
          completed: depositStats[0]?.completed || 0,
          pending: depositStats[0]?.pending || 0,
          rejected: depositStats[0]?.rejected || 0
        },
        withdrawals: {
          completed: withdrawalStats[0]?.completed || 0,
          pending: withdrawalStats[0]?.pending || 0,
          rejected: withdrawalStats[0]?.rejected || 0
        },
        wallets: {
          liveBalance: liveWalletStats[0]?.total_balance || 0,
          demoBalance: demoWalletStats[0]?.total_balance || 0
        },
        trading: {
          totalTrades: orderStats[0]?.total || 0,
          openTrades: orderStats[0]?.open || 0,
          closedTrades: orderStats[0]?.closed || 0,
          todayTrades: orderStats[0]?.today || 0,
          totalProfit: tradingPnL[0]?.total_profit || 0,
          totalLoss: tradingPnL[0]?.total_loss || 0,
          todayPnL: tradingPnL[0]?.today_pnl || 0
        }
      }
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving dashboard"
    });
  }
};

// ============================================================================
// USER DASHBOARD - Only user's own account
// ============================================================================

const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID required"
      });
    }

    // Get user's wallet
    const [liveWallet] = await queryDatabase(
      `SELECT wallet, used_margin FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    const [demoWallet] = await queryDatabase(
      `SELECT wallet, used_margin FROM ${TABLES.DEMO_USERS_WALLET} WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    // Get user's trading stats
    const [tradeStats] = await queryDatabase(
      `SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN order_status = 'active' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN order_status IN ('completed', 'cancelled', 'closed') THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN pnl ELSE 0 END) AS today_pnl,
        SUM(pnl) AS total_pnl
      FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    // Get user's transaction history
    const [depositHistory] = await queryDatabase(
      `SELECT COUNT(*) AS total FROM ${TABLES.USER_DEPOSIT_TRANSACTION} WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    const [withdrawalHistory] = await queryDatabase(
      `SELECT COUNT(*) AS total FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} WHERE user_id = ? AND deleted_at IS NULL`,
      [userId]
    );

    return res.status(200).json({
      status: "success",
      message: "User dashboard retrieved",
      data: {
        liveAccount: {
          balance: liveWallet[0]?.wallet || 0,
          usedMargin: liveWallet[0]?.used_margin || 0,
          freeMargin: (liveWallet[0]?.wallet || 0) - (liveWallet[0]?.used_margin || 0)
        },
        demoAccount: {
          balance: demoWallet[0]?.wallet || 0,
          usedMargin: demoWallet[0]?.used_margin || 0,
          freeMargin: (demoWallet[0]?.wallet || 0) - (demoWallet[0]?.used_margin || 0)
        },
        trading: {
          openTrades: tradeStats[0]?.open || 0,
          closedTrades: tradeStats[0]?.closed || 0,
          totalTrades: tradeStats[0]?.total || 0,
          todayPnL: tradeStats[0]?.today_pnl || 0,
          totalPnL: tradeStats[0]?.total_pnl || 0
        },
        transactions: {
          deposits: depositHistory[0]?.total || 0,
          withdrawals: withdrawalHistory[0]?.total || 0
        }
      }
    });
  } catch (error) {
    console.error("User dashboard error:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving dashboard"
    });
  }
};

// ============================================================================
// RECENT ACTIVITY ENDPOINTS
// ============================================================================

const getMasterRecentUsers = async (req, res) => {
  try {
    const masterId = req.user?.master_id || req.user?.id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const [users] = await queryDatabase(
      `SELECT id, username, email, user_status, account_created_at 
       FROM ${TABLES.REGISTER} 
       WHERE master_id = ? AND deleted_at IS NULL 
       ORDER BY account_created_at DESC LIMIT ?`,
      [masterId, limit]
    );

    return res.status(200).json({
      status: "success",
      message: "Recent users retrieved",
      data: users || []
    });
  } catch (error) {
    console.error("Error fetching recent users:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving recent users"
    });
  }
};

const getAdminRecentUsers = async (req, res) => {
  try {
    const adminId = req.user?.admin_id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const [users] = await queryDatabase(
      `SELECT id, username, email, user_status, account_created_at 
       FROM ${TABLES.REGISTER} 
       WHERE admin_id = ? AND deleted_at IS NULL 
       ORDER BY account_created_at DESC LIMIT ?`,
      [adminId, limit]
    );

    return res.status(200).json({
      status: "success",
      message: "Recent users retrieved",
      data: users || []
    });
  } catch (error) {
    console.error("Error fetching recent users:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving recent users"
    });
  }
};

// ============================================================================
// USER RECENT TRADES/TRANSACTIONS
// ============================================================================

const getUserRecentTrades = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const [trades] = await queryDatabase(
      `SELECT id, symbol, type, entry_price, entry_time, exit_price, exit_time, pnl, order_status 
       FROM ${TABLES.LIVE_USERS_ORDERS} 
       WHERE user_id = ? AND deleted_at IS NULL 
       ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );

    return res.status(200).json({
      status: "success",
      message: "Recent trades retrieved",
      data: trades || []
    });
  } catch (error) {
    console.error("Error fetching recent trades:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving recent trades"
    });
  }
};

const getUserRecentTransactions = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Get deposits and withdrawals
    const [deposits] = await queryDatabase(
      `SELECT deposit_id AS id, 'deposit' AS type, requested_amount_usd AS amount, deposit_status AS status, deposit_request_at AS created_at 
       FROM ${TABLES.USER_DEPOSIT_TRANSACTION} 
       WHERE user_id = ? AND deleted_at IS NULL 
       ORDER BY deposit_request_at DESC LIMIT ?`,
      [userId, limit]
    );

    const [withdrawals] = await queryDatabase(
      `SELECT withdrawal_id AS id, 'withdrawal' AS type, requested_amount_usd AS amount, withdrawal_status AS status, withdrawal_request_at AS created_at 
       FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} 
       WHERE user_id = ? AND deleted_at IS NULL 
       ORDER BY withdrawal_request_at DESC LIMIT ?`,
      [userId, limit]
    );

    // Combine and sort
    const combined = [...(deposits || []), ...(withdrawals || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);

    return res.status(200).json({
      status: "success",
      message: "Recent transactions retrieved",
      data: combined
    });
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving recent transactions"
    });
  }
};

module.exports = {
  getMasterDashboard,
  getAdminDashboard,
  getUserDashboard,
  getMasterRecentUsers,
  getAdminRecentUsers,
  getUserRecentTrades,
  getUserRecentTransactions
};
