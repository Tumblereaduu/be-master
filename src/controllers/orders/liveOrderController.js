const {queryDatabase} = require('../../config/db');
const { TABLES } = require('../../config/tables');
const forgePriceStore = require('../../models/1forge.price.model');
const { onTradeOpen, onTradeClose } = require('../wallet/walletController');
const { getSpread, getSpreadInPrice } = require('./spreadController');


// Get all pending orders for admin (no token required)
const getPendingOrdersAdmin = async (req, res) => {
  try {
    const sql = `SELECT o.*, u.email FROM ${TABLES.LIVE_USERS_ORDERS} o LEFT JOIN ${TABLES.REGISTER} u ON u.id = o.user_id WHERE o.order_status = 'pending' ORDER BY o.created_at DESC`;
    const [trades] = await queryDatabase(sql); // Make sure you destructure properly
    return res.status(200).json({ success: true, trades });
  } catch (error) {
    console.error("Error fetching pending trades (admin):", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// buytrade trade 

const buytrade = async (req, res) => {
  try {
    const sql = `SELECT o.*,u.email, u.is_lp_added  FROM ${TABLES.LIVE_USERS_ORDERS} o LEFT JOIN ${TABLES.REGISTER} u ON u.id = o.user_id  WHERE o.type = 'BUY' AND o.order_status NOT IN ('active','pending') ORDER BY o.exit_time DESC `;
    const trades = await queryDatabase(sql);
    return res.status(200).json({ success: true, trades: trades[0] });
  } catch (error) {
    console.error("Error fetching BUY trades:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Demo buytrade trade 

const demoBuyTrade = async (req, res) => {
  try {
    const sql = `SELECT o.*,u.email, u.is_lp_added  FROM ${TABLES.DEMO_USERS_ORDERS} o LEFT JOIN ${TABLES.REGISTER} u ON u.id = o.user_id  WHERE o.type = 'BUY' AND o.order_status NOT IN ('active','pending') ORDER BY o.exit_time DESC `;
    const trades = await queryDatabase(sql);
    return res.status(200).json({ success: true, trades: trades[0] });
  } catch (error) {
    console.error("Error fetching BUY trades:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// selltrade trade 

const selltrade = async (req, res) => {
  try {
    const sql = `SELECT o.*,u.email, u.is_lp_added FROM ${TABLES.LIVE_USERS_ORDERS} o LEFT JOIN ${TABLES.REGISTER} u ON u.id = o.user_id WHERE o.type = 'SELL' AND o.order_status NOT IN ('active','pending') ORDER BY o.exit_time DESC`;
    const trades = await queryDatabase(sql);
    return res.status(200).json({ success: true, trades: trades[0] });
  } catch (error) {
    console.error("Error fetching BUY trades:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Sell Demo trade

const demoSellTrade = async (req, res) => {
  try {
    const sql = `SELECT o.*,u.email, u.is_lp_added FROM ${TABLES.DEMO_USERS_ORDERS} o LEFT JOIN ${TABLES.REGISTER} u ON u.id = o.user_id WHERE o.type = 'SELL' AND o.order_status NOT IN ('active','pending') ORDER BY o.exit_time DESC`;
    const trades = await queryDatabase(sql);
    return res.status(200).json({ success: true, trades: trades[0] });
  } catch (error) {
    console.error("Error fetching BUY trades:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// active trade 

const getActiveOrders = async (req, res) => {
  try {
     const sql = `SELECT o.*, u.email, u.is_lp_added FROM ${TABLES.LIVE_USERS_ORDERS} o LEFT JOIN ${TABLES.REGISTER} u ON u.id= o.user_id  WHERE o.order_status = 'active' ORDER BY created_at DESC`;
    const [orders] = await queryDatabase(sql);
    return res.status(200).json({ success: true, message: "Active Orders Fetched succussfully", trades: orders });
  } catch (error) {
    console.error("Error fetching active trades:", error);
    return res.status(500).json({ success: false, message: "Could not able to fetched active trades Server error" });
  }
};

const getLpUsersActiveOrders = async (req, res) => {
  try {
    const sql = `
      SELECT 
        o.*, 
        u.email, 
        u.is_lp_added
      FROM ${TABLES.LIVE_USERS_ORDERS} o
      LEFT JOIN ${TABLES.REGISTER} u 
        ON u.id = o.user_id
      WHERE 
        o.order_status = 'active'
        AND u.is_lp_added = 1
      ORDER BY o.created_at DESC
    `;

    const [orders] = await queryDatabase(sql);

    return res.status(200).json({
      success: true,
      message: "LP users active orders fetched successfully",
      trades: orders,
    });

  } catch (error) {
    console.error("Error fetching LP users active orders:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch LP users active orders",
    });
  }
};

const getUserActiveOrders = async (req, res) => {
    const { userId } = req.params;

    try {
        const query = `
            SELECT * 
            FROM live_users_orders 
            WHERE user_id = ? AND order_status = 'active'
            ORDER BY created_at DESC
        `;

        const [rows] = await queryDatabase(query, [userId]);

        return res.json({
            status: "success",
            data: rows
        });

    } catch (error) {
        console.error("Error fetching active orders:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch active orders",
        });
    }
};

const getUserPendingOrders = async (req, res) => {
    const { userId } = req.params;

    try {
        const query = `
            SELECT * 
            FROM live_users_orders 
            WHERE user_id = ? AND order_status = 'pending'
            ORDER BY created_at DESC
        `;

        const [rows] = await queryDatabase(query, [userId]);

        return res.json({
            status: "success",
            data: rows
        });

    } catch (error) {
        console.error("Error fetching active orders:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch active orders",
        });
    }
};


const getCancelledOrders = async (req, res) => {
  try {
    const sql = `SELECT * FROM ${TABLES.LIVE_USERS_ORDERS} WHERE order_status IN ('cancelled','completed') ORDER BY exit_time DESC`;
    const trades = await queryDatabase(sql);
    return res.status(200).json({ success: true, trades: trades[0] });
  } catch (error) {
    console.error("Error fetching pending trades:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getDemoCancelledOrders = async (req, res) => {
  const { userId } = req.params;
  try {
    const sql = `SELECT * FROM ${TABLES.DEMO_USERS_ORDERS}             WHERE user_id = ? 
              AND (order_status = 'cancelled' OR order_status = 'completed')
            ORDER BY exit_time DESC`;
    const trades = await queryDatabase(sql, [userId]);
        return res.json({
            status: "success",
            data: trades[0]
        });

    } catch (error) {
        console.error("Error fetching cancelled orders:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch cancelled orders",
        });
    }
};

const getUserCancelledOrders = async (req, res) => {
    const { userId } = req.params;

    try {
        const query = `
            SELECT * 
            FROM live_users_orders 
            WHERE user_id = ? 
              AND (order_status = 'cancelled' OR order_status = 'completed')
            ORDER BY exit_time DESC
        `;

        const [rows] = await queryDatabase(query, [userId]);

        return res.json({
            status: "success",
            data: rows
        });

    } catch (error) {
        console.error("Error fetching cancelled orders:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to fetch cancelled orders",
        });
    }
};



module.exports = {getPendingOrdersAdmin,buytrade,demoBuyTrade,selltrade,demoSellTrade,getActiveOrders,getUserPendingOrders,getUserActiveOrders,getCancelledOrders,getDemoCancelledOrders,getUserCancelledOrders,getLpUsersActiveOrders}
