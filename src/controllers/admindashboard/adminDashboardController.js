const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");

const getAdminDashboard = async (req, res) => {
    try {
        // Count total users
        const [userCount] = await queryDatabase(
            `SELECT COUNT(*) AS totalUsers FROM ${TABLES.REGISTER}`
        );

        // Count deposits
        const [depositCount] = await queryDatabase(
            `SELECT COUNT(*) AS deposits FROM ${TABLES.USER_DEPOSIT_TRANSACTION} WHERE deposit_status ="pending" `
        );

        // Count withdrawals (if you have a table for it)
        const [withdrawalCount] = await queryDatabase(
            `SELECT COUNT(*) AS withdrawals FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} WHERE withdrawal_status ="pending" `
        );

        // support ticket

        const [supportCount] = await queryDatabase(`SELECT COUNT(*) AS support FROM ${TABLES.USER_SUPPORT} WHERE status ="open"`);

        // KYC users

        const [pendingKYC] = await queryDatabase(`SELECT COUNT(*) AS pendingKYC FROM ${TABLES.REGISTER} WHERE photo_verification_status = "pending"`);
        const [rejectCountKYC] = await queryDatabase(`SELECT COUNT(*) AS rejectKYC FROM ${TABLES.REGISTER} WHERE photo_verification_status = "rejected"`);
        const [kycVerified] = await queryDatabase(`SELECT COUNT(*) AS kycVerified FROM ${TABLES.REGISTER} WHERE photo_verification_status = "approved"`);

        // Sell and Buy order 

        const [sellTradeCount] = await queryDatabase(`SELECT COUNT(*) AS selltrade FROM ${TABLES.LIVE_USERS_ORDERS} o JOIN ${TABLES.REGISTER} u ON u.id = o.user_id WHERE o.type = "SELL" AND u.is_lp_added = 1`);
        const [buyTradeCount] = await queryDatabase(`SELECT COUNT(*) AS buytrade FROM ${TABLES.LIVE_USERS_ORDERS} o JOIN ${TABLES.REGISTER} u ON u.id = o.user_id WHERE o.type = "BUY" AND u.is_lp_added = 1`);

        // Open and Close order

        const [openCount] = await queryDatabase(`SELECT COUNT(*) AS openCount FROM ${TABLES.LIVE_USERS_ORDERS} o JOIN ${TABLES.REGISTER} u ON u.id = o.user_id WHERE o.order_status = "active" AND u.is_lp_added = 1`);
        const [closeCount] = await queryDatabase(`SELECT COUNT(*) AS closeCount FROM ${TABLES.LIVE_USERS_ORDERS} o JOIN ${TABLES.REGISTER} u ON u.id = o.user_id WHERE o.order_status = "cancelled" AND u.is_lp_added = 1`);

        // Blocked user
        
        const [BlockCount] = await queryDatabase(`SELECT COUNT(*) AS blockedCount FROM ${TABLES.REGISTER} WHERE user_status="inactive"`);

         // LP user
        
        const [LPCount] = await queryDatabase(`SELECT COUNT(*) AS lpCount FROM ${TABLES.REGISTER} WHERE is_lp_added = 1`);

        // IB User

        const [IBTransfer] = await queryDatabase(`SELECT COUNT(*) AS ibTransfer FROM ${TABLES.ADMIN_IB_DEPOSIT} WHERE deposit_status = 'pending'`);

        // IB KYC 

        const [IBKYC] = await queryDatabase(`SELECT COUNT(*) AS ibKyc FROM ${TABLES.ADMIN_BONUS} WHERE ib_photo_id_1_status = 'pending' AND
          ib_photo_id_2_status = 'pending' AND ib_photo_id_3_status = 'pending' AND ib_photo_id_4_status = 'pending' AND ib_photo_id_5_status = 'pending' AND
          ib_photo_id_6_status = 'pending' `);

        // Combine all stats
        const stats = {
            totalUsers: userCount[0]?.totalUsers || 0,
            deposits: depositCount[0]?.deposits || 0,
            withdrawals: withdrawalCount[0]?.withdrawals || 0,
            support: supportCount[0]?.support || 0,
            kycUnverified: rejectCountKYC[0]?.rejectKYC || 0,
            kycVerified: kycVerified[0]?.kycVerified || 0,
            pendingKYC: pendingKYC[0]?.pendingKYC || 0,
            sellOrders: sellTradeCount[0]?.selltrade || 0,
            buyOrders: buyTradeCount[0]?.buytrade || 0,
            liveActiveUsers: 0,
            openTrades: openCount[0]?.openCount || 0,
            closedTrades: closeCount[0]?.closeCount || 0,
            blockedUsers: BlockCount[0]?.blockedCount || 0,
            lpUsers : LPCount[0]?.lpCount || 0,
            ibPending : IBTransfer[0]?.ibTransfer || 0,
            ibKYCPending : IBKYC[0]?.ibKyc || 0
        };

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error("Error fetching admin dashboard stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard stats",
            error: error.message,
        });
    }
};

const getTimeRange = async (req, res) => {
  try {
    const { range } = req.query;

    let userTimeFilter = "";
    let orderTimeFilter = "";

    // Time filters for both tables
    // if (range === "24h") {
    //   userTimeFilter = "AND account_created_at >= NOW() - INTERVAL 1 DAY";
    //   orderTimeFilter = "AND created_at >= NOW() - INTERVAL 1 DAY";
    // } else if (range === "week") {
    //   userTimeFilter = "AND account_created_at >= NOW() - INTERVAL 7 DAY";
    //   orderTimeFilter = "AND created_at >= NOW() - INTERVAL 7 DAY";
    // } else if (range === "15days") {
    //   userTimeFilter = "AND account_created_at >= NOW() - INTERVAL 15 DAY";
    //   orderTimeFilter = "AND created_at >= NOW() - INTERVAL 15 DAY";
    // } else if (range === "month") {
    //   userTimeFilter = "AND account_created_at >= NOW() - INTERVAL 1 MONTH";
    //   orderTimeFilter = "AND created_at >= NOW() - INTERVAL 1 MONTH";
    // }
      let interval = "1 DAY"; // default 24h
    if (range === "week") interval = "7 DAY";
    else if (range === "15days") interval = "15 DAY";
    else if (range === "month") interval = "1 MONTH";

    // Query users table
    const [kycUser] = await queryDatabase(
      `SELECT COUNT(*) AS kycUser 
       FROM ${TABLES.REGISTER} 
       WHERE photo_verification_status = 'approved' ${userTimeFilter} AND photo_verification_timestamp >= NOW() - INTERVAL ${interval}`
    );

    const [registerUser] = await queryDatabase(
      `SELECT COUNT(*) AS registerUser 
       FROM ${TABLES.REGISTER} r
       WHERE r.is_lp_added = 1 AND r.account_created_at >= NOW() - INTERVAL ${interval}`
    );

    // Query live_users_orders table
    const [profit] = await queryDatabase(
      `SELECT IFNULL(SUM(pnl), 0) AS totalProfit 
       FROM ${TABLES.LIVE_USERS_ORDERS} o JOIN ${TABLES.REGISTER} u ON u.id = o.user_id
       WHERE u.is_lp_added = 1 AND o.pnl > 0 AND o.exit_time >= NOW() - INTERVAL ${interval}`
    );

    const [loss] = await queryDatabase(
      `SELECT IFNULL(SUM(pnl), 0) AS totalLoss 
       FROM ${TABLES.LIVE_USERS_ORDERS}  o JOIN ${TABLES.REGISTER} u ON u.id = o.user_id
       WHERE u.is_lp_added = 1 AND o.pnl < 0 AND o.exit_time >= NOW() - INTERVAL ${interval}`
    );

    const stats = {
      kycUser: kycUser[0]?.kycUser || 0,
      registerUser: registerUser[0]?.registerUser || 0,
      totalProfit: profit[0]?.totalProfit || 0,
      totalloss: Math.abs(loss[0]?.totalLoss || 0),
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error("Error while fetching time range stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch range stats" });
  }
};

// User Analytics

const getAnalytics = async (req, res) => {

  const { user_id } = req.params;

  try {

    // Total Deposit
    const [depositRows] = await queryDatabase(`SELECT COALESCE(SUM (transfer_amount_usd), 0) AS total_deposit FROM ${TABLES.USER_DEPOSIT_TRANSACTION} WHERE user_id = ?
       AND deposit_status = 'completed' `, [user_id]);

    // Total Withdrawal
    const [withdrawalRows] = await queryDatabase(`SELECT COALESCE(SUM (transfer_amount_usd), 0) AS total_withdrawal FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} WHERE user_id = ? 
      AND withdrawal_status = 'completed' `, [user_id]);

    // Total PNL
    const [pnlRows] = await queryDatabase(`SELECT COALESCE(SUM(pnl),0) AS total_pnl FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status IN ('cancelled','completed') `, [user_id]);

    const [commissionRows] = await queryDatabase(`SELECT COALESCE(SUM(commission_amount), 0) AS total_ib_commission FROM ${TABLES.ADMIN_IB_AMOUNT} WHERE ib_id = ?`, [user_id, user_id]);

    const [ibBalance] = await queryDatabase(`SELECT COALESCE(SUM(total_earnings), 0) AS total_ib_balance FROM ${TABLES.ADMIN_BONUS} WHERE user_id = ?`, [user_id]);

      const totalDeposit = Number(depositRows[0]?.total_deposit || 0);
      const totalWithdrawal = Number(withdrawalRows[0]?.total_withdrawal || 0);
      const totalPnl = Number(pnlRows[0]?.total_pnl);
      const totalIBCommission = Number(commissionRows[0]?.total_ib_commission || 0);
      const totalIBBalance = Number(ibBalance[0]?.total_ib_balance || 0); 

      // Total Final Balance
      const totalFinalBalance = (totalDeposit - totalWithdrawal + totalIBBalance + totalPnl).toFixed(2);

      res.status(200).json({
        status:"success",
        message: "User analytics fetched successfully",
        data: {
          total_deposit: Number(totalDeposit),
          total_withdrawal: Number(totalWithdrawal),
          total_pnl: Number(totalPnl),
          total_ib_commission:Number(totalIBCommission),
          total_ib_balance: Number(totalIBBalance),
          totalFinalBalance
        }
      });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      status:"error",
      message:"Analytics fetch failed due to server error"
    });
  }
}

// const getAllLP = async (req, res) => {
//   try {
//     const [rows] = await queryDatabase(`
//       SELECT  u.id AS user_id, u.username, u.email, u.user_status,

//         -- Total Deposits
//         ( SELECT COALESCE(SUM(d.transfer_amount_usd), 0) FROM ${TABLES.USER_DEPOSIT_TRANSACTION} d WHERE d.user_id = u.id  AND d.deposit_status = 'completed') AS total_deposit,

//         -- Total Withdrawals
//         ( SELECT COALESCE(SUM(w.transfer_amount_usd), 0) FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} w WHERE w.user_id = u.id  AND w.withdrawal_status = 'completed') AS total_withdrawal,

//         -- Total PNL
//         ( SELECT COALESCE(SUM(o.pnl), 0) FROM ${TABLES.LIVE_USERS_ORDERS} o WHERE o.user_id = u.id AND o.order_status IN ('cancelled','completed')) AS total_pnl,

//         -- Wallet Balance
//         (SELECT COALESCE(wallet,0) FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = u.id LIMIT 1) AS wallet 

//         FROM ${TABLES.REGISTER} u WHERE u.is_lp_added = 1
//     `);

//     const data = rows.map(r => ({
//       ...r,
//       totalFinalBalance: (Number(r.total_deposit) - Number(r.total_withdrawal) + Number(r.total_pnl)).toFixed(2)
//     }));

//     return res.json({
//       success: true,
//       message:"All LP status fetched successfully",
//       data
//     });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ success: false, message: "Failed to fetch LP status" ,error: "Failed to fetch all LP users"});
//   }
// };
const getAllLP = async (req, res) => {
  try {
    const [rows] = await queryDatabase(`
      SELECT  
        u.id AS user_id, 
        u.username, 
        u.email, 
        u.user_status,

        -- Total Deposits
        (
          SELECT COALESCE(SUM(d.transfer_amount_usd), 0) 
          FROM ${TABLES.USER_DEPOSIT_TRANSACTION} d 
          WHERE d.user_id = u.id  
          AND d.deposit_status = 'completed'
        ) AS total_deposit,

        -- Total Withdrawals
        (
          SELECT COALESCE(SUM(w.transfer_amount_usd), 0) 
          FROM ${TABLES.USER_WITHDRAWAL_TRANSACTION} w 
          WHERE w.user_id = u.id  
          AND w.withdrawal_status = 'completed'
        ) AS total_withdrawal,

        -- Total PNL
        (
          SELECT COALESCE(SUM(o.pnl), 0) 
          FROM ${TABLES.LIVE_USERS_ORDERS} o 
          WHERE o.user_id = u.id 
          AND o.order_status IN ('cancelled','completed')
        ) AS total_pnl,

        -- Wallet Balance
        (
          SELECT COALESCE(wallet,0) 
          FROM ${TABLES.LIVE_USERS_WALLET} 
          WHERE user_id = u.id 
          LIMIT 1
        ) AS wallet 

      FROM ${TABLES.REGISTER} u 

      WHERE 
        u.is_lp_added = 1

        -- Only users who deposited
        AND EXISTS (
          SELECT 1 
          FROM ${TABLES.USER_DEPOSIT_TRANSACTION} d
          WHERE d.user_id = u.id
          AND d.deposit_status = 'completed'
          AND d.transfer_amount_usd > 0
        )
    `);

    const data = rows.map(r => ({
      ...r,
      totalFinalBalance: (
        Number(r.total_deposit) -
        Number(r.total_withdrawal) +
        Number(r.total_pnl)
      ).toFixed(2)
    }));

    return res.json({
      success: true,
      message: "All LP status fetched successfully",
      data
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch LP status",
      error: "Failed to fetch all LP users"
    });
  }
};

module.exports = { getAdminDashboard, getTimeRange, getAnalytics,getAllLP };
