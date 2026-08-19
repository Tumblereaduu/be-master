const { queryDatabase } = require('../config/db');
const { TABLES } = require('../config/tables');

/**
 * Returns the correct table (live or demo) based on user_id and tableType.
 * 
 * @param {number} user_id 
 * @param {"FAVOURITES" | "WALLET" | "ORDERS" } tableType 
 * @returns {string} The table name // | "POSITIONS" | "HISTORY"
 */
async function getAccountTable(user_id, tableType) {
  // user account type
  const [rows] = await queryDatabase(
    `SELECT account_type FROM ${TABLES.REGISTER} WHERE id = ? LIMIT 1`,
    [user_id]
  );

  if (rows.length === 0) {
    throw new Error("User not found");
  }

  const accountType = rows[0].account_type; // "demo" | "live"

  // table name dynamically
  const tableKey = `${accountType.toUpperCase()}_${tableType}`;

  if (!TABLES[tableKey]) {
    throw new Error(`Table not found for key: ${tableKey}`);
  }

  return TABLES[tableKey];
}

module.exports = { getAccountTable };
