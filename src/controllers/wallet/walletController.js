const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const { ERROR_MESSAGES } = require("../../utils/errors");


// Add Fund

// const addFund = async (req, res) => {

//     try {
//         const { user_id, amount } = req.body

//         if (!user_id || !amount) {
//             return res.status(400).json({
//                 status: "error",
//                 error: "MISSING_FIELDS",
//                 message: ERROR_MESSAGES.MISSING_FIELDS
//             })
//         }

//         // check aleray is there existing row

//         const [rows] = await queryDatabase(`SELECT wallet from ${TABLES.LIVE_USERS_WALLET} WHERE user_id =?`, [user_id])

//         if (rows.length > 0) {
//             // wallet exist means add amount
//             const newAmount = parseFloat(rows[0].wallet) + parseFloat(amount);
//             await queryDatabase(`UPDATE ${TABLES.LIVE_USERS_WALLET} SET wallet = ? WHERE user_id = ?`, [newAmount, user_id]);

//             // add fund history
//             await queryDatabase(`INSERT INTO ${TABLES.ADD_FUND_HISTORY} (user_id,amount,created_at) VALUES (?,?,NOW())`, [user_id, amount])

//             return res.status(200).json({
//                 status: "success",
//                 message: `Wallet updated successfully`,
//                 wallet: newAmount,
//                 user_id,
//             })
//         }
//         else {
//             // Wallet does not exist, create it
//             const result = await queryDatabase(`INSERT INTO ${TABLES.LIVE_USERS_WALLET} (user_id, wallet) VALUES (?, ?)`, [user_id, amount]);

//             // add fund history 

//             await queryDatabase(`INSERT INTO ${TABLES.ADD_FUND_HISTORY} (user_id,amount,created_at) VALUES (?,?,NOW())`, [user_id, amount])

//             return res.status(200).json({
//                 status: "success",
//                 message: "Wallet created and fund added successfully",
//                 id: result.insertId,
//                 wallet: amount,
//                 user_id,
//             });
//         }
//     } catch (error) {
//         return res.status(500).json({
//             status: "error",
//             error: "INTERNAL_SERVER_ERROR",
//             message: error.message,
//         });
//     }
// };

const addFund = async (req, res) => {

    try {
        const { user_id, amount } = req.body

        if (!user_id || !amount) {
            return res.status(400).json({
                status: "error",
                error: "MISSING_FIELDS",
                message: ERROR_MESSAGES.MISSING_FIELDS
            })
        }

       // Check user exists
        const [user] = await queryDatabase(`SELECT id FROM ${TABLES.REGISTER} WHERE id = ?`,[user_id]);

            if (user.length === 0) {
            return res.status(404).json({
                status: "error",
                message: `User not found with id ${user_id}`
            });
            }

        const [rows] = await queryDatabase(`SELECT wallet FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ?`, [user_id]);

        if (rows.length > 0) {
            // wallet exist means add amount
            const newAmount = parseFloat(rows[0].wallet) + parseFloat(amount);
            await queryDatabase(`UPDATE ${TABLES.LIVE_USERS_WALLET} SET wallet = ? WHERE user_id = ?`, [newAmount, user_id]);

            // add fund history
            await queryDatabase(`INSERT INTO ${TABLES.ADD_FUND_HISTORY} (user_id, amount, created_at) VALUES (?, ?, NOW())`,[user_id, amount]);

            return res.status(200).json({
                status: "success",
                message: `Wallet updated successfully`,
                wallet: newAmount,
                user_id,
            })
        }

        const result = await queryDatabase(`INSERT INTO ${TABLES.LIVE_USERS_WALLET} (user_id, wallet) VALUES (?, ?)`, [user_id, amount]);
        await queryDatabase(`INSERT INTO ${TABLES.ADD_FUND_HISTORY} (user_id, amount, created_at) VALUES (?, ?, NOW())`,[user_id, amount]);

            return res.status(200).json({
                status: "success",
                message: "Wallet created and fund added successfully",
                id: result.insertId,
                wallet: amount,
                user_id,
            });
        }
      catch (error) {
        return res.status(500).json({
            status: "error",
            error: "INTERNAL_SERVER_ERROR",
            message: error.message,
        });
    }
};

// Add Fund History fetch 

const getFundHistory = async (req, res) => {
    try {
        const [rows] = await queryDatabase(`SELECT h.id, h.user_id, h.amount, h.created_at, u.username, u.email FROM ${TABLES.ADD_FUND_HISTORY} h LEFT JOIN ${TABLES.REGISTER} u ON h.user_id = u.id ORDER BY h.id DESC`);

        return res.status(200).json({
            status: "success",
            data: rows,
        })
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
}

// Update the wallet 

const updateWallet = async (req, res) => {
    try {
        const { user_id, amount } = req.body

        if (!user_id || amount === undefined) {
            return res.status(400).json({
                status: "error",
                error: "MISSING_FIELDS",
                message: ERROR_MESSAGES.MISSING_FIELDS || "Missing user_id or amount"
            })
        }

        // check if user exist 

        const [rows] = await queryDatabase(`SELECT wallet FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id =?`, [user_id])

        if (rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: `User ID ${user_id} not found`,
            });
        }

        // update the wallet with userId

        await queryDatabase(`UPDATE ${TABLES.LIVE_USERS_WALLET} SET wallet =? WHERE user_id =?`, [amount, user_id])

        // Save Update Wallet History

        await queryDatabase(`INSERT INTO ${TABLES.ADMIN_UPDATE_WALLET} (user_id,amount,created_at) VALUES(?,?,NOW())`,[user_id,amount])

        // check if any rows updated

        return res.status(200).json({
            status: "success",
            message: "Wallet updated successfully",
            user_id,
            wallet: amount,
        })
    } catch (error) {
        return res.status(500).json({
            status: "error",
            error: "INTERNAL_SERVER_ERROR",
            message: error.message,
        })
    }
}

// Fetch all data into wallet

const getWalletHistory = async (req, res) => {
    try {
        const [rows] = await queryDatabase(`SELECT id,user_id,amount,created_at FROM ${TABLES.ADMIN_UPDATE_WALLET} ORDER BY id DESC`);
        return res.status(200).json({
            status: "success",
            data: rows
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: error.message,
        })
    }
}

const getWalletByUserId = async (req, res) => {

    try {

        const { user_id } = req.params;

        if (!user_id) {
            return res.status(400).json({
                status: "error",
                message: "MISSING_USER_ID"
            })
        }

        // Get user info FIRST
        const [user] = await queryDatabase(`SELECT username, email FROM ${TABLES.REGISTER} WHERE id = ?`, [user_id]);

        if (user.length === 0) {
          return res.status(404).json({
                status: "error",
                message: `User not found with id ${user_id}`
            })
        }
        //  Get wallet (may NOT exist)
        const [wallet] = await queryDatabase(
          `SELECT wallet, used_margin, after_used_margin 
          FROM ${TABLES.LIVE_USERS_WALLET}
          WHERE user_id = ?`,
          [user_id]
        );

        return res.status(200).json({
            status: "success",
            wallet: wallet[0]?.wallet ||  0,
            used_margin: wallet[0]?.used_margin ||  0,
            after_used_margin: wallet[0]?.after_used_margin || 0,
            username: user[0].username,
            email: user[0].email
        })


    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: error.message
        })
    }
}

// Trade Open - Update Margin
const onTradeOpen = async (user_id, usedMargin) => {

  // Get wallet balance
  const [user] = await queryDatabase(
    `SELECT wallet FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ?`,
    [user_id]
  );

  const balance = Number(user[0]?.wallet || 0);

  //  Recalculate TOTAL used margin from Orders DB
  const [trades] = await queryDatabase(
    `SELECT SUM (used_margin) as total_used FROM ${TABLES.LIVE_USERS_ORDERS} WHERE user_id = ? AND order_status = 'active'`,
    [user_id]
  );

  const totalUsedMargin = (trades[0]?.total_used || 0);
  
  // after-used-margin = balance - totalUsedMargin
  const afterUsedMargin = balance - totalUsedMargin;

  // Update Wallet table
  await queryDatabase(
    `UPDATE ${TABLES.LIVE_USERS_WALLET} SET used_margin = ?, after_used_margin = ? WHERE user_id = ?`,
    [totalUsedMargin, afterUsedMargin, user_id]
  );

  return { balance, used_margin: totalUsedMargin, after_used_margin: afterUsedMargin };
};

// Trade Close - Update Balance & Margin
const onTradeClose = async (user_id, usedMarginForTrade, pnl) => {  

  const [user] = await queryDatabase(
    `SELECT wallet, used_margin FROM ${TABLES.LIVE_USERS_WALLET} WHERE user_id = ?`,
    [user_id]
  );

  const balance = Number(user[0]?.wallet || 0);
  const currentUsedMargin = Number(user[0]?.used_margin || 0);
  const safePnL = isFinite(pnl) ? Number(pnl) : 0;
  const newBalance = balance + safePnL;
  const newUsedMargin = Math.max(0, currentUsedMargin - Number(usedMarginForTrade));
  const afterUsedMargin = newBalance - newUsedMargin;

  await queryDatabase(
    `UPDATE ${TABLES.LIVE_USERS_WALLET} SET wallet = ?, used_margin = ?, after_used_margin = ? WHERE user_id = ?`,
    [newBalance, newUsedMargin, afterUsedMargin, user_id]
  );
  return { newBalance, newUsedMargin, afterUsedMargin };
};


module.exports = { addFund, getFundHistory, updateWallet,getWalletHistory, getWalletByUserId, onTradeOpen, onTradeClose }
