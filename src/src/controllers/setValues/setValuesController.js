const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");
const { SUCCESS_MESSAGES, ERROR_MESSAGES } = require("../../utils/errors");

const adminRate = async (req, res) => {
  try {
    const { minimum_deposit, minimum_withdrawal, inr_value, bit_coin_value, deposit_fee, withdrawal_fee } = req.body;

    if (!minimum_deposit || !inr_value || !minimum_withdrawal) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const now = new Date();

    //  Insert or update the single record (id = 1)
    const [result] = await queryDatabase(
      `INSERT INTO ${TABLES.ADMIN_PANEL_RATE_SETTINGS} 
        (id, minimum_deposit,minimum_withdrawal, inr_value, bit_coin_value, deposit_fee, withdrawal_fee, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         minimum_deposit = VALUES(minimum_deposit),
         minimum_withdrawal = VALUES(minimum_withdrawal),
         inr_value = VALUES(inr_value),
         bit_coin_value = VALUES(bit_coin_value),
         deposit_fee = VALUES(deposit_fee),
         withdrawal_fee = VALUES(withdrawal_fee),
         updated_at = VALUES(updated_at)`,
      [minimum_deposit, minimum_withdrawal, inr_value, bit_coin_value, deposit_fee, withdrawal_fee, now, now]
    );

    res.json({
      success: true,
      message:
        result.affectedRows > 1
          ? "Admin rate updated successfully"
          : "Admin rate created successfully",
    });
  } catch (error) {
    console.error("Error saving admin rate:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getAdminRate = async (req, res) => {
  try {
    const [rows] = await queryDatabase(`SELECT minimum_deposit, minimum_withdrawal, inr_value, bit_coin_value, deposit_fee, withdrawal_fee FROM ${TABLES.ADMIN_PANEL_RATE_SETTINGS}  WHERE id = 1`);

    if (!rows || rows.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Admin Rate will not provided"
      })
    }

    res.json({
      success: true,
      message : SUCCESS_MESSAGES.SETVALUES_CREATED,
      data: rows[0],
    });

  } catch (error) {
    console.error("Error fetching admin rate", error);
    res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

module.exports = { adminRate, getAdminRate };
