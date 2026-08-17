const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const { ERROR_MESSAGES } = require("../../utils/errors");

// const demoAccount = async (req, res) => {
//     try {
//         const { user_id, balance } = req.body;

//         if (!user_id || !balance) {
//             return res.status(400).json({
//                 status: "error",
//                 message: "MISSING_FIELDS"
//             });
//         }

//         // check if demo account already exists
//         const [rows] = await queryDatabase(
//             `SELECT wallet FROM ${TABLES.DEMO_USERS_WALLET} WHERE user_id = ?`,
//             [user_id]
//         );

//         if (rows.length > 0) {
//             // add to existing balance
//             const newBalance = parseFloat(rows[0].wallet) + parseFloat(balance);
//             await queryDatabase(
//                 `UPDATE ${TABLES.DEMO_USERS_WALLET} SET wallet = ? WHERE user_id = ?`,
//                 [newBalance, user_id]
//             );

//             return res.status(200).json({
//                 status: "success",
//                 message: "Demo account balance updated successfully",
//                 data: { user_id, balance: newBalance }
//             });
//         } else {
//             // create new demo account
//             const result = await queryDatabase(
//                 `INSERT INTO ${TABLES.DEMO_USERS_WALLET} (user_id, wallet, created_at) VALUES (?, ?, NOW())`,
//                 [user_id, balance]
//             );

//             return res.status(200).json({
//                 status: "success",
//                 message: "Demo account created successfully",
//                 data: { id: result.insertId, user_id, balance }
//             });
//         }
//     } catch (error) {
//         console.error("Error demo account", error);
//         return res.status(500).json({
//             status: "error",
//             message: "Database error"
//         });
//     }
// };

const demoAccount = async (req, res) => {
    try {
        const { user_id, balance } = req.body;

        // Validate required fields
        if (!user_id || balance === undefined || balance === null) {
            return res.status(400).json({
                status: "error",
                message: "MISSING_FIELDS",
                error: "user_id and balance are required"
            });
        }

        // Validate balance is a valid number
        const amount = Number(balance);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                status: "error",
                message: "INVALID_BALANCE",
                error: "balance must be a positive number"
            });
        }

        // Validate user_id is a valid number
        const userId = Number(user_id);
        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "INVALID_USER_ID",
                error: "user_id must be a positive number"
            });
        }

        // Query with proper destructuring to handle mysql2 response format
        const walletResult = await queryDatabase(
            `SELECT wallet FROM ${TABLES.DEMO_USERS_WALLET} WHERE user_id = ?`,
            [userId]
        );

        // Handle mysql2 response format: [[data], fields] or [data]
        let rows = walletResult;
        if (Array.isArray(walletResult) && Array.isArray(walletResult[0]) && walletResult.length === 2) {
            rows = walletResult[0]; // Extract data from mysql2 format
        }

        if (Array.isArray(rows) && rows.length > 0) {
            // Wallet exists - update balance
            const currentBalance = Number(rows[0].wallet);
            
            // Validate that current balance is a valid number
            if (isNaN(currentBalance)) {
                return res.status(500).json({
                    status: "error",
                    message: "INVALID_DATA",
                    error: "Wallet balance in database is invalid"
                });
            }

            const newBalance = currentBalance + amount;

            // Update wallet
            await queryDatabase(
                `UPDATE ${TABLES.DEMO_USERS_WALLET}
                 SET wallet = ?
                 WHERE user_id = ?`,
                [newBalance, userId]
            );

            // Store history
            await queryDatabase(
                `INSERT INTO ${TABLES.DEMO_FUND_HISTORY}
                (user_id, amount, balance_before, balance_after)
                VALUES (?, ?, ?, ?)`,
                [
                    userId,
                    amount,
                    currentBalance,
                    newBalance
                ]
            );

            return res.status(200).json({
                status: "success",
                message: "Demo account balance updated successfully",
                data: {
                    user_id: userId,
                    balance: newBalance
                }
            });

        } else {
            // Wallet doesn't exist - create new
            const result = await queryDatabase(
                `INSERT INTO ${TABLES.DEMO_USERS_WALLET}
                (user_id, wallet, created_at)
                VALUES (?, ?, NOW())`,
                [userId, amount]
            );

            // Store first history
            await queryDatabase(
                `INSERT INTO ${TABLES.DEMO_FUND_HISTORY}
                (user_id, amount, balance_before, balance_after)
                VALUES (?, ?, ?, ?)`,
                [
                    userId,
                    amount,
                    0,
                    amount
                ]
            );

            return res.status(200).json({
                status: "success",
                message: "Demo account created successfully",
                data: {
                    id: result[0]?.insertId || null,
                    user_id: userId,
                    balance: amount
                }
            });
        }

    } catch (error) {
        console.error("Error demo account", error);
        return res.status(500).json({
            status: "error",
            message: "Database error",
            error: error.message
        });
    }
};

const getAccountBalance = async (req, res) => {
    try {
        const { user_id } = req.params;
        
        if (!user_id) {
            return res.status(400).json({
                status: "error",
                message: "MISSING_USER_ID",
                error: "user_id is required"
            });
        }

        // Validate user_id is a valid number
        const userId = Number(user_id);
        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "INVALID_USER_ID",
                error: "user_id must be a positive number"
            });
        }

        const walletResult = await queryDatabase(
            `SELECT wallet FROM ${TABLES.DEMO_USERS_WALLET} WHERE user_id = ?`,
            [userId]
        );

        // Handle mysql2 response format: [[data], fields] or [data]
        let rows = walletResult;
        if (Array.isArray(walletResult) && Array.isArray(walletResult[0]) && walletResult.length === 2) {
            rows = walletResult[0]; // Extract data from mysql2 format
        }

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(200).json({
                status: "success",
                wallet: 0
            });
        }

        const walletValue = Number(rows[0].wallet);
        if (isNaN(walletValue)) {
            return res.status(500).json({
                status: "error",
                message: "INVALID_DATA",
                error: "Wallet balance in database is invalid"
            });
        }

        return res.status(200).json({
            status: "success",
            wallet: walletValue
        });

    } catch (error) {
        console.error("Error fetching demo account balance:", error);
        return res.status(500).json({
            status: "error",
            message: "Database error",
            error: error.message
        });
    }
}

// Account type
const accountType = async(req,res)=>{
    try {
        const {account_type} = req.body;
        const { user_id } = req.params;

        if(!["LIVE","DEMO"].includes(account_type)){
            return res.status(400).json({
                status:"error",
                message:"Invalid account type"
            });
        }
        await queryDatabase(`UPDATE ${TABLES.REGISTER} SET account_type = ? WHERE id = ? `,[account_type,user_id]);
        res.json({
            status:"success",
            message:"Account Changed successfully"
        });
    } catch (error) {
        console.error("Changed account type error",error);
        res.status(500).json({
            status:"error",
            message:"Account type server error"
        });
    }
};

// Trade Open - Update Margin
const onTradeOpen = async (user_id, usedMargin) => {
  try {
    // Validate inputs
    const userId = Number(user_id);
    if (isNaN(userId) || userId <= 0) {
      throw new Error("Invalid user_id provided to onTradeOpen");
    }

    // Get wallet balance
    const walletResult = await queryDatabase(
      `SELECT wallet FROM ${TABLES.DEMO_USERS_WALLET} WHERE user_id = ?`,
      [userId]
    );

    // Handle mysql2 response format
    let walletRows = walletResult;
    if (Array.isArray(walletResult) && Array.isArray(walletResult[0]) && walletResult.length === 2) {
      walletRows = walletResult[0];
    }

    if (!Array.isArray(walletRows) || walletRows.length === 0) {
      throw new Error(`No wallet found for user_id: ${userId}`);
    }

    const balance = Number(walletRows[0]?.wallet || 0);
    if (isNaN(balance)) {
      throw new Error("Invalid wallet balance in database");
    }

    // Recalculate TOTAL used margin from Orders DB
    const tradesResult = await queryDatabase(
      `SELECT SUM(used_margin) as total_used FROM ${TABLES.DEMO_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
      [userId]
    );

    // Handle mysql2 response format
    let tradesRows = tradesResult;
    if (Array.isArray(tradesResult) && Array.isArray(tradesResult[0]) && tradesResult.length === 2) {
      tradesRows = tradesResult[0];
    }

    const totalUsedMargin = Number(tradesRows[0]?.total_used || 0);
    if (isNaN(totalUsedMargin)) {
      throw new Error("Invalid total used margin calculated");
    }
    
    // after-used-margin = balance - totalUsedMargin
    const afterUsedMargin = balance - totalUsedMargin;

    // Update Wallet table
    await queryDatabase(
      `UPDATE ${TABLES.DEMO_USERS_WALLET} SET used_margin = ?, after_used_margin = ? WHERE user_id = ?`,
      [totalUsedMargin, afterUsedMargin, userId]
    );

    return { balance, used_margin: totalUsedMargin, after_used_margin: afterUsedMargin };
  } catch (error) {
    console.error("Error in onTradeOpen:", error);
    throw error;
  }
};

// Trade Close - Update Balance & Margin
const onTradeClose = async (user_id, usedMarginForTrade, pnl) => {
  try {
    // Validate inputs
    const userId = Number(user_id);
    if (isNaN(userId) || userId <= 0) {
      throw new Error("Invalid user_id provided to onTradeClose");
    }

    const usedMarginValue = Number(usedMarginForTrade);
    if (isNaN(usedMarginValue)) {
      throw new Error("Invalid usedMarginForTrade value");
    }

    const pnlValue = Number(pnl);
    if (isNaN(pnlValue)) {
      throw new Error("Invalid pnl value");
    }

    const walletResult = await queryDatabase(
      `SELECT wallet, used_margin FROM ${TABLES.DEMO_USERS_WALLET} WHERE user_id = ?`,
      [userId]
    );

    // Handle mysql2 response format
    let walletRows = walletResult;
    if (Array.isArray(walletResult) && Array.isArray(walletResult[0]) && walletResult.length === 2) {
      walletRows = walletResult[0];
    }

    if (!Array.isArray(walletRows) || walletRows.length === 0) {
      throw new Error(`No wallet found for user_id: ${userId}`);
    }

    const balance = Number(walletRows[0].wallet);
    const currentUsedMargin = Number(walletRows[0].used_margin || 0);

    if (isNaN(balance)) {
      throw new Error("Invalid wallet balance in database");
    }

    if (isNaN(currentUsedMargin)) {
      throw new Error("Invalid used margin in database");
    }

    const newBalance = balance + pnlValue;
    const newUsedMargin = currentUsedMargin - usedMarginValue;
    const afterUsedMargin = newBalance - newUsedMargin;

    await queryDatabase(
      `UPDATE ${TABLES.DEMO_USERS_WALLET} SET wallet = ?, used_margin = ?, after_used_margin = ? WHERE user_id = ?`,
      [newBalance, newUsedMargin, afterUsedMargin, userId]
    );

    return { newBalance, newUsedMargin, afterUsedMargin };
  } catch (error) {
    console.error("Error in onTradeClose:", error);
    throw error;
  }
};

const getDemoFundHistory = async (req, res) => {
    try {
        const { user_id } = req.params;

        const history = await queryDatabase(
            `SELECT
                id,
                amount,
                balance_before,
                balance_after,
                created_at
            FROM ${TABLES.DEMO_FUND_HISTORY}
            WHERE user_id = ?
            ORDER BY id DESC`,
            [user_id]
        );

        res.status(200).json({
            status: "success",
            data: history
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "error",
            message: "Database error"
        });
    }
};

const getDemoAnalytics = async (req, res) => {
    try {
        const { user_id } = req.params;

        // Validate user_id
        if (!user_id) {
            return res.status(400).json({
                status: "error",
                message: "MISSING_USER_ID",
                error: "user_id is required"
            });
        }

        const userId = Number(user_id);
        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({
                status: "error",
                message: "INVALID_USER_ID",
                error: "user_id must be a positive number"
            });
        }

        // Query 1: Get total added fund from demo_fund_history
        const fundHistoryResult = await queryDatabase(
            `SELECT IFNULL(SUM(amount), 0) AS added_fund
             FROM ${TABLES.DEMO_FUND_HISTORY}
             WHERE user_id = ?`,
            [userId]
        );

        // Handle mysql2 response format
        let fundRows = fundHistoryResult;
        if (Array.isArray(fundHistoryResult) && Array.isArray(fundHistoryResult[0]) && fundHistoryResult.length === 2) {
            fundRows = fundHistoryResult[0];
        }

        const addedFund = Number(fundRows[0]?.added_fund || 0);
        if (isNaN(addedFund)) {
            throw new Error("Invalid added_fund value calculated");
        }

        // Query 2: Get total PNL from closed demo orders
        // Include all possible closed statuses: 'closed', 'completed', 'square_off'
        const pnlResult = await queryDatabase(
            `SELECT
                IFNULL(SUM(COALESCE(pnl, 0)), 0) AS total_pnl,
                COUNT(*) AS trade_count
            FROM ${TABLES.DEMO_USERS_ORDERS}
            WHERE user_id = ?`,
            [userId]
        );

        // Handle mysql2 response format
        let pnlRows = pnlResult;
        if (Array.isArray(pnlResult) && Array.isArray(pnlResult[0]) && pnlResult.length === 2) {
            pnlRows = pnlResult[0];
        }

        const totalPnl = Number(pnlRows[0]?.total_pnl || 0);
        const closedTradeCount = Number(pnlRows[0]?.trade_count || 0);
        
        if (isNaN(totalPnl)) {
            throw new Error("Invalid total_pnl value calculated");
        }

        // Enhanced debugging
        console.log(`[DEMO_ANALYTICS_DEBUG] User ${userId} - PNL Query:`, {
            closedTradeCount,
            totalPnl,
            rawPnlResult: pnlRows[0]
        });

        // Query 3: Get current wallet balance
        const walletResult = await queryDatabase(
            `SELECT IFNULL(wallet, 0) AS wallet_balance
             FROM ${TABLES.DEMO_USERS_WALLET}
             WHERE user_id = ?`,
            [userId]
        );

        // Handle mysql2 response format
        let walletRows = walletResult;
        if (Array.isArray(walletResult) && Array.isArray(walletResult[0]) && walletResult.length === 2) {
            walletRows = walletResult[0];
        }

        let walletBalance = 0;
        if (Array.isArray(walletRows) && walletRows.length > 0) {
            walletBalance = Number(walletRows[0]?.wallet_balance || 0);
            if (isNaN(walletBalance)) {
                walletBalance = 0;
            }
        }

        // Final balance = wallet balance (which already includes PNL from closed trades)
        const finalBalance = walletBalance;

        // Log analytics for debugging
        console.log(`Demo Analytics Query for user ${userId}:`, {
            addedFund,
            totalPnl,
            walletBalance,
            finalBalance,
            timestamp: new Date().toISOString()
        });

        return res.status(200).json({
            status: "success",
            data: {
                added_fund: parseFloat(addedFund.toFixed(2)),
                total_pnl: parseFloat(totalPnl.toFixed(2)),
                wallet_balance: parseFloat(walletBalance.toFixed(2)),
                final_balance: parseFloat(finalBalance.toFixed(2))
            }
        });

    } catch (error) {
        console.error("Error in getDemoAnalytics:", error);
        return res.status(500).json({
            status: "error",
            message: "Database error",
            error: error.message
        });
    }
};

module.exports = { demoAccount, getAccountBalance, accountType, onTradeOpen, onTradeClose, getDemoFundHistory, getDemoAnalytics };
