const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");

// User page show Every Deposit List By UserId

const getListbbyUserId = async (req, res) => {

  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ status: "error", message: "User Id is required" });
  }

  try {
    const sql = `SELECT d.*, h.ib_kyc_status FROM ${TABLES.ADMIN_IB_DEPOSIT} d LEFT JOIN ${TABLES.ADMIN_BONUS} h ON h.user_id = d.user_id WHERE d.user_id = ? ORDER BY d.deposit_request_at DESC`

    const [rows] = await queryDatabase(sql, [user_id]);

    const sumSql = `SELECT COALESCE(SUM(transfer_amount_usd),0) AS transfer_amount FROM ${TABLES.ADMIN_IB_DEPOSIT} WHERE user_id = ? AND deposit_status = 'approved' `

    const [sumResult] = await queryDatabase(sumSql, [user_id]);

    // console.log(sumResult)

    res.status(200).json({
      status: "success",
      message: "IB Deposits fetched successfully",
      total_amount: Number(sumResult[0].transfer_amount),
      data: rows
    });

  } catch (error) {
    console.error("Failed to fetch details", error);
    return res.status(500).json({ status: "error", message: "Internal server Fetch Error" });
  }
}

// Admin Deposit show all List

const getAllDepositList = async (req, res) => {
  try {

    const sql = `SELECT * FROM ${TABLES.ADMIN_IB_DEPOSIT} ORDER BY deposit_request_at DESC`

    const [rows] = await queryDatabase(sql);

    res.status(200).json({ status: 'success', message: "IB Deposit list fetched successfully", data: rows });

  } catch (error) {

    console.error("Failed to fetch deposits", error);

    return res.status(500).json({ status: "error", message: "Internal server deposit all error" });
  }
}

// Admin Deposit Show Single userId

const getIBDepositById = async (req, res) => {
  try {

    const { user_id } = req.params;

    const sql = `SELECT * FROM ${TABLES.ADMIN_IB_DEPOSIT} where ib_id = ?`

    const [rows] = await queryDatabase(sql, [user_id]);

    if (rows.length === 0) {
      return res.status(404).json({ status: "error", message: "IB Deposit not found" })
    }

    res.status(200).json({ status: "success", message: "IB Deposit fetched successfully", data: rows[0] });

  } catch (error) {
    console.error("Failed to fetch IB Deposit by ID", error);

    return res.status(500).json({ status: "error", message: "Internal server IB Deposit by Id" });
  }
}

// Create Transfer API 

const createIBDeposit = async (req, res) => {
  try {
    const { enter_amount } = req.body;

    if (!enter_amount) {
      return res.status(400).json({ status: "error", message: "Amount is required" });
    }

    if (!req.user) {
      return res.status(401).json({ status: "error", message: "User not found in token" });
    }

    // From Token it comes

    const user_id = req.user.id;

    const username = req.user.username;

    const email = req.user.email;

    // const transfer_amount_usd = Number(enter_amount);

    const amount = parseFloat(enter_amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ status: "error", message: "Invalid amount" })
    }
    if (amount < 50){
      return res.status(400).json({status: 'error', message:"Minimum Amount $50 required"})
    }

    const  [rows] = await queryDatabase(`SELECT ib_kyc_status FROM ${TABLES.ADMIN_BONUS} WHERE user_id = ? LIMIT 1`, [user_id]);

    if(rows[0].ib_kyc_status !== "completed"){
      return res.status(400).json({status: 'error', message: "IB KYC is not completed. Complete First"})
    }

    await queryDatabase (`UPDATE ${TABLES.ADMIN_BONUS} SET total_earnings = GREATEST(total_earnings - ?,0) WHERE user_id = ? `,[enter_amount, user_id]);

    const sql = `INSERT INTO ${TABLES.ADMIN_IB_DEPOSIT} (user_id, username, email, enter_amount,transfer_amount_usd, deposit_status) VALUES (?, ?, ?, ?, ?, 'pending')`;

    const [result] = await queryDatabase(sql, [user_id, username, email, amount, amount]);

    res.json({ status: "success", message: "IB Deposit created successfully", ib_deposit_id: result.insertId });

  } catch (error) {
    console.error("Error creating IB Deposit", error);

    res.status(500).json({ status: "error", message: "Internal IB Deposit error", error: error.message });
  }
};

// Admin IB Deposit Approve or Rejected

const updateIBDepositByID = async (req, res) => {
  try {
    const { ib_id } = req.params;

    const { deposit_status, deposit_reject_reason } = req.body;

    if (!deposit_status) {
      return res.status(400).json({ status: "error", message: "Deposit status is required" });
    }

    const [rows] = await queryDatabase(`SELECT * FROM ${TABLES.ADMIN_IB_DEPOSIT} WHERE ib_id = ?`, [ib_id]);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ status: "error", message: "IB Deposit record not found" });
    }

    const deposit = rows[0];

    // Prevent  double approve 

    if (deposit.deposit_status === "approved" && deposit_status === "approved") {
      return res.status(400).json({ status: "error", message: "Deposit already approved" })
    }

    const sql = `UPDATE ${TABLES.ADMIN_IB_DEPOSIT} SET deposit_status = ?, deposit_reject_reason = ?, deposit_verified_at = CASE WHEN ? = 'approved' THEN NOW() ELSE deposit_verified_at END WHERE ib_id = ? `

    await queryDatabase(sql, [deposit_status, deposit_reject_reason || null, deposit_status, ib_id]);

    // If approved Reduce total_earnings

    if (deposit_status === "rejected") {
      await queryDatabase(`UPDATE ${TABLES.ADMIN_BONUS} SET total_earnings = total_earnings + ? WHERE user_id =  ?`, [deposit.transfer_amount_usd, deposit.user_id]);
    }

    return res.status(200).json({
      status: "success",
      message: "IB transfer has been Updated Successfully"
    });

  } catch (error) {
    console.error("Failed to update IB Deposit", error);
    res.status(500).json({ status: "error", message: "Internal server IB deposit update Error" });
  }
}

// Total Earnings
const getIBTotalEarnings = async (req, res) => {

  const { user_id } = req.params;

  try {
    const sql = `SELECT r.id AS user_id, COALESCE (SUM(c.commission_amount), 0) AS total_earnings, b.id AS bonus_row_id, b.ib_kyc_status, r.ib_status FROM ${TABLES.REGISTER} r 
    LEFT JOIN ${TABLES.ADMIN_IB_AMOUNT} c ON c.ib_id = r.id LEFT JOIN ${TABLES.ADMIN_BONUS} b ON b.user_id = r.id WHERE r.id = ? GROUP BY r.id, b.id, b.ib_kyc_status, r.ib_status LIMIT 1`;

    const [rows] = await queryDatabase(sql, [user_id]);

    return res.status(200).json({
      status: "success",
      message:"Your Earnings data fetched successfully",
      data: rows[0],
    });

  } catch (error) {
    console.error("Error while fetching Total earnings", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch Total earnings",
      error: error.message,
    });
  }
};

// IB Dashboard page All Client, Revenue details shown

const getIBDashboardStats = async (req, res) => {
  try {
    const ibId = req.user.id;

    const sql = ` SELECT COUNT(DISTINCT u.id) AS total_clients, 
    COUNT(DISTINCT CASE WHEN u.account_created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN u.id END) AS month_clients,
    COUNT(DISTINCT CASE WHEN DATE(u.account_created_at) = CURDATE() - INTERVAL 1 DAY THEN u.id END) AS yesterday_clients,
    COALESCE(SUM(CASE WHEN created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN commission_amount END), 0) AS month_revenue,
    COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() - INTERVAL 1 DAY THEN commission_amount END), 0) AS yesterday_revenue,
    COALESCE(SUM(a.commission_amount),0) AS total_revenue FROM users u
    LEFT JOIN ${TABLES.ADMIN_IB_AMOUNT} a ON u.id = a.user_id WHERE u.referred_by_id = ? `;

    const [rows] = await queryDatabase(sql, [ibId]);

    // From ib_bonuss table total_earnings send

    const bonusSql = `SELECT COALESCE(total_earnings,0) AS current_earnings FROM ${TABLES.ADMIN_BONUS} WHERE user_id = ? LIMIT 1`;

    const [bonusRows] = await queryDatabase(bonusSql, [ibId]);

    return res.status(200).json({
      status: "success",
      message: "Stats fetched successfully",
      data: {
        ...rows[0],
        current_earnings: bonusRows[0]?.current_earnings || 0
      }
    });

  } catch (error) {
    console.error("Error while fetching IB dashboard stats", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error on ibdashboard"
    });
  }
};

// Client Details fetched for single user

const getIBDashboardClients = async (req, res) => {
  try {
    const { user_id } = req.params;

    const sql = `SELECT DISTINCT u.id, u.username, u.account_created_at, COALESCE(SUM(c.commission_amount),0) AS total_commission
     FROM ${TABLES.REGISTER} u LEFT JOIN ${TABLES.ADMIN_IB_AMOUNT} c ON u.id = c.user_id AND c.ib_id = ? WHERE u.referred_by_id = ? GROUP BY u.id, u.username, u.account_created_at
      ORDER BY u.id DESC`

    const [rows] = await queryDatabase(sql, [user_id, user_id]);

    const formattedRows = rows.map((row)=> ({...row, total_commission:Number(row.total_commission).toFixed(2)}))

    return res.status(200).json({ status: "success", message: "Client details is fetched", data: formattedRows });

  } catch (error) {
    console.error("Error while Fetching IB clients details", error);
    return res.status(500).json({ status: "error", message: "Internal server error while fetching IB clients" })
  }
}

// Admin IB Commission details for single user

const getIBCommissionDetails = async (req,res)=>{

    try {
      const { user_id:ib_id } = req.params;
      
      const sql = `SELECT  u.username, u.id, c.trade_id, o.lot_size, o.order_type, o.type, c.commission_amount, c.created_at FROM ${TABLES.ADMIN_IB_AMOUNT}
       c JOIN ${TABLES.REGISTER} u ON u.id = c.user_id JOIN ${TABLES.LIVE_USERS_ORDERS} o ON 
      o.trade_id = c.trade_id WHERE c.ib_id = ? ORDER BY c.created_at DESC`

      const [rows] = await queryDatabase (sql,[ib_id]);

      const formattedRows = rows.map(row => ({...row, commission_amount : Number(row.commission_amount).toFixed(2)}) )

      return res.status(200).json({status:"success", message:"Commission data fetched successfully", data:formattedRows});

    } catch (error) {
      console.error("Error while fetching ID commission Details", error);
      return res.status(500).json({status:"error", message:"Internal server error while fetching GetIBcommissionDetails"})
    }
}

const getAllCommission = async (req,res)=>{

  try {
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const offSet = (page - 1) * limit;
    const sql = `SELECT * FROM ${TABLES.ADMIN_IB_AMOUNT} order BY ib_id DESC LIMIT ? OFFSET ?`
    
    const [rows] = await queryDatabase(sql, [limit, offSet])

    return res.status(200).json({
      status:"success",
      data:rows,
      page, totalRows:rows.length,
      message:"IB Commission History fetched successfully"
    })

  } catch (error) {
    console.log("Error while fetching IB Commission History", error)
    return res.status(500).json({
      status:"error",
      message:"Internal server error"
    })
  }
}


module.exports = { getListbbyUserId, getAllDepositList, getIBDepositById, createIBDeposit, updateIBDepositByID, getIBTotalEarnings, getIBDashboardStats, getIBDashboardClients, getIBCommissionDetails,  getAllCommission };
