// Spread values for currency pairs (in pips)
// For gold (XAU/USD), the spread is different
const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");

let SPREAD_VALUES = {}; 

async function loadSpreadValuesFromDB() {
  try {
    console.log("Loading spread values from database...");

    const sql = `SELECT symbol, spread, status FROM ${TABLES.ADMIN_SPREAD}`;
    const [rows] = await queryDatabase(sql);

    // console.log("Raw DB rows:", rows);

    const newSpreadValues = {};

    rows.forEach(row => {
      if (row.status === "active") {
        newSpreadValues[row.symbol.toUpperCase()] = parseFloat(row.spread);
      }
    });

    SPREAD_VALUES = newSpreadValues;

    // console.log("SPREAD_VALUES updated:", SPREAD_VALUES);
    // console.log("------------------------------------------------------");

  } catch (err) {
    console.error("Failed to load spread values:", err);
  }
}


function getSpread(symbol) {
    // Validate and normalize symbol
    let normalizedSymbol = null;

    if (typeof symbol === "string") {
        normalizedSymbol = symbol.trim().toUpperCase();
    } else if (symbol && typeof symbol === "object") {
        // Handle cases where the whole trade/instrument object is passed
        const rawSymbol =
            symbol.symbol ??
            symbol.Symbol ??
            symbol.instrument ??
            symbol.instrument_symbol;

        if (typeof rawSymbol === "string") {
            normalizedSymbol = rawSymbol.trim().toUpperCase();
        }
    }

    // Prevent invalid symbol from reaching SPREAD_VALUES
    if (!normalizedSymbol) {
        console.error("[getSpread] Invalid symbol received:", {
            symbol,
            type: typeof symbol,
            isArray: Array.isArray(symbol),
        });

        return 3;
    }

    console.log(`Getting spread for: ${normalizedSymbol}`);
    console.log("Current SPREAD_VALUES:", SPREAD_VALUES);

    return SPREAD_VALUES[normalizedSymbol] ?? 3;
}

// Get spread in decimal (price units)
function getSpreadInPrice(symbol, spreadPips) {
  // For most forex pairs, 1 pip = 0.0001 (for 4 decimal places)
  // For JPY pairs, 1 pip = 0.01 (for 2 decimal places)
  // For XAU/USD, 1 pip = 0.01 (for 2 decimal places)
  
  // xau/usd also
  // const jpyPairs = ['USD/JPY', 'EUR/JPY', 'GBP/JPY'];
  // const isJpy = jpyPairs.includes(symbol) || symbol === 'XAU/USD';
  
  // const pipValue = isJpy ? 0.01 : 0.0001;
  // return spreadPips * pipValue;

  // xauusd
  const jpyPairs = ['USD/JPY', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'CHF/JPY']; // !JPY pairs
  const rawSymbol = symbol.toUpperCase().replace("/", ""); // ! ADD '/' To the B_PAIR
  const B_PAIR = ['US30USD', "BTCUSD", "ETHUSD"]; // !BINANCE PAIRS
  const isJpy = jpyPairs.includes(symbol) || symbol === 'XAU/USD' || symbol === 'XPD/USD' || symbol === 'XAG/USD' || symbol === 'XCU/USD'  // !Gold, Silver, Copper and paladium
  
  const pipValue = isJpy ? 0.01 : B_PAIR.includes(rawSymbol) ? 1 : 0.0001;
  const spreadInPrice = spreadPips * pipValue;

  // Round to the correct precision (e.g. 5 decimals for forex)
  return parseFloat(spreadInPrice.toFixed(5));
}

const createSymbol = async (req, res) => {
  try {
    const { symbol, spread, ib_commission_percentage, category } = req.body;

    if (!symbol || !spread || !Array.isArray(category) || !ib_commission_percentage || category.length === 0) {
      return res.status(400).json({ message: "All fields required!" });
    }

    const normalizedSymbol = symbol.toUpperCase();

    const checkSql = `SELECT id FROM ${TABLES.ADMIN_SPREAD} WHERE UPPER(symbol) = ?`;
    const [existing] = await queryDatabase(checkSql,[normalizedSymbol]);
 
    if(existing.length>0){
      return res.status(400).json({
        message:"This pair is already exists"
      })
    }

    const sql = `
      INSERT INTO ${TABLES.ADMIN_SPREAD}
      (symbol, spread, ib_commission_percentage, category, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;

    await queryDatabase(sql, [symbol, spread, ib_commission_percentage, JSON.stringify(category), "active"]);

    return res.status(200).json({ message: "Spread added successfully" });

  } catch (error) {
    console.error("Error while inserting spread", error);
    return res.status(500).json({ message: "Spread Server Error" });
  }
};

const ViewSymbol = async (req, res) => {
  try {
    const sql = `SELECT * FROM ${TABLES.ADMIN_SPREAD} ORDER BY created_at DESC`;
    const spreads = await queryDatabase(sql);

    return res.status(200).json({
      message: "Spread fetched successfully",
      data: spreads
    });

  } catch (error) {
    console.error("Error while fetching", error);
    return res.status(500).json({
      message: "View Server Error"
    })
  }
}

const ViewSymbolById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `SELECT * FROM ${TABLES.ADMIN_SPREAD} WHERE id = ?`;
    const data = await queryDatabase(sql, [id]);

    if (!data.length) {
      return res.status(404).json({
        message: "Spread not found"
      });
    }

    res.status(200).json({
      message: "success",
      data: data[0],
    })

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "viewsymbol server error"
    })
  }
}

const updateSymbol = async (req, res) => {
  try {
    const { symbol, spread, ibCommission, status, category } = req.body;
    const { id } = req.params;

    const sql = `UPDATE ${TABLES.ADMIN_SPREAD} SET symbol = ?, spread = ?, ib_commission_percentage = ?, status = ?, category = ?, updated_at = NOW() WHERE id = ?`;
    await queryDatabase(sql, [symbol, spread, parseFloat(ibCommission) || 0, status, JSON.stringify(category), id]);
    res.json({ message: "Spread updated successfully" });

  } catch (error) {
    res.status(500).json({
      message: "Update Error", error
    })
  }
}

// Update only spread for individual user - separate endpoint for spread only update
const updateSpread = async (req, res) => {
  try {
    const { id } = req.params;
    const { spread } = req.body;

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "User ID is required",
      });
    }

    if (spread === undefined || spread === null || spread === '') {
      return res.status(400).json({
        status: "error",
        message: "spread value is required",
      });
    }

    const spreadValue = Number(spread);
    if (isNaN(spreadValue) || spreadValue < 0) {
      return res.status(400).json({
        status: "error",
        message: "spread must be a valid non-negative number",
      });
    }

    // Check if user exists
    const [userRows] = await queryDatabase(
      `SELECT id, spread FROM ${TABLES.REGISTER} WHERE id = ?`,
      [id]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Update spread for this individual user
    const [result] = await queryDatabase(
      `UPDATE ${TABLES.REGISTER} SET spread = ? WHERE id = ?`,
      [spreadValue, id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        status: "error",
        message: "Failed to update spread",
      });
    }

    return res.json({
      status: "success",
      message: `Spread updated to ${spreadValue} for user ${id}`,
      previous_spread: userRows[0].spread,
      new_spread: spreadValue,
    });

  } catch (error) {
    console.error("updateSpread error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update spread",
      error: error.message,
    });
  }
};

// ============ PER-PAIR SPREAD MANAGEMENT START ============

// Get all global spreads with user's individual overrides
const getUserSpreads = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ status: "error", message: "User ID is required" });
    }

    // Get all global spreads - change 'spreads' table name if your table name is different
    const [globalSpreads] = await queryDatabase(
      `SELECT id, symbol, spread, status, ib_commission_percentage, category, created_at FROM spread WHERE status = 'active' ORDER BY id ASC`
    );

    // Get user's individual spreads from user_spreads table
    const [userSpreads] = await queryDatabase(
      `SELECT spread_id, symbol, spread FROM user_spreads WHERE user_id = ?`,
      [id]
    );

    // Map user spreads by spread_id for quick lookup
    const userSpreadMap = {};
    if (userSpreads && userSpreads.length > 0) {
      userSpreads.forEach(us => {
        userSpreadMap[us.spread_id] = us.spread;
      });
    }

    // Merge: for each global spread, attach user's individual spread if exists
    const mergedData = globalSpreads.map(gs => ({
      ...gs,
      user_spread: userSpreadMap[gs.id] !== undefined ? userSpreadMap[gs.id] : null
    }));

    return res.json({
      status: "success",
      data: mergedData,
    });

  } catch (error) {
    console.error("getUserSpreads error:", error);
    return res.status(500).json({ status: "error", message: "Failed to fetch spreads" });
  }
};

// Set individual spread for a specific pair for a user (upsert)
const setUserSpread = async (req, res) => {
  try {
    const { id } = req.params;
    const { spread_id, symbol, spread } = req.body;

    if (!id || !spread_id || !symbol) {
      return res.status(400).json({ status: "error", message: "User ID, Spread ID and Symbol are required" });
    }

    if (spread === undefined || spread === null || spread === '') {
      return res.status(400).json({ status: "error", message: "Spread value is required" });
    }

    const spreadValue = Number(spread);
    if (isNaN(spreadValue) || spreadValue < 0) {
      return res.status(400).json({ status: "error", message: "Spread must be a valid non-negative number" });
    }

    // Check if user_spreads row already exists for this user + spread_id
    const [existing] = await queryDatabase(
      `SELECT id FROM user_spreads WHERE user_id = ? AND spread_id = ?`,
      [id, spread_id]
    );

    if (existing && existing.length > 0) {
      // Update existing individual spread
      await queryDatabase(
        `UPDATE user_spreads SET spread = ?, symbol = ? WHERE user_id = ? AND spread_id = ?`,
        [spreadValue, symbol, id, spread_id]
      );
    } else {
      // Insert new individual spread
      await queryDatabase(
        `INSERT INTO user_spreads (user_id, spread_id, symbol, spread) VALUES (?, ?, ?, ?)`,
        [id, spread_id, symbol, spreadValue]
      );
    }

    return res.json({
      status: "success",
      message: `Spread updated to ${spreadValue} for ${symbol}`,
    });

  } catch (error) {
    console.error("setUserSpread error:", error);
    return res.status(500).json({ status: "error", message: "Failed to set spread" });
  }
};

// Remove individual spread for a pair (reset to global default)
const removeUserSpread = async (req, res) => {
  try {
    const { id, spreadId } = req.params;

    if (!id || !spreadId) {
      return res.status(400).json({ status: "error", message: "User ID and Spread ID are required" });
    }

    const [result] = await queryDatabase(
      `DELETE FROM user_spreads WHERE user_id = ? AND spread_id = ?`,
      [id, spreadId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: "error", message: "No individual spread found to remove" });
    }

    return res.json({
      status: "success",
      message: "Individual spread removed, now using global default",
    });

  } catch (error) {
    console.error("removeUserSpread error:", error);
    return res.status(500).json({ status: "error", message: "Failed to remove spread" });
  }
};

// ============ PER-PAIR SPREAD MANAGEMENT END ============


module.exports = {
  SPREAD_VALUES,
  loadSpreadValuesFromDB,
  getSpread,
  updateSpread,
  getSpreadInPrice,
  createSymbol,
  ViewSymbol,
  ViewSymbolById,
  updateSymbol,
  getUserSpreads,
  setUserSpread,
  removeUserSpread,
};

