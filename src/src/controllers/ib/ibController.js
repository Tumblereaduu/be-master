const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");

const getCommission = async (req, res) => {
  try {
    const rows = await queryDatabase(`SELECT id, lot_usd, created_at  FROM ${TABLES.ADMIN_COMMISSION} LIMIT 1`);

    return res.status(200).json({
      status: "success",
      message: "Commission Data fetched successfully",
      data: rows[0] || null
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', error:"Internal_server_commission_error", message: "Internal server commission error" });
  }
};


const updateCommission = async (req, res) => {
  try {
    let { lot_usd } = req.body;

    if (lot_usd === undefined) {
      return res.status(400).json({ status: "error", message: "lot_usd is required" });
    }

    lot_usd = Number(lot_usd);

    const [rows] = await queryDatabase(`SELECT id FROM ${TABLES.ADMIN_COMMISSION} LIMIT 1`);

    if (rows.length === 0) {
      const result = await queryDatabase(`INSERT INTO ${TABLES.ADMIN_COMMISSION} (lot_usd, created_at, updated_at) VALUES (?, NOW(), NOW())`, [lot_usd]);

      return res.status(200).json({
        status: "success",
        message: "Commission inserted successfully"
      });
    }

    const result = await queryDatabase(`UPDATE ${TABLES.ADMIN_COMMISSION} SET lot_usd = ?, updated_at = NOW() WHERE id = ?`, [lot_usd, rows[0].id]);

    return res.status(200).json({
      status: "success",
      message: "Commission updated successfully"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: "error",
      error:"Internal_server_update_commission_error",
      message: "Internal server update commission error"
    });
  }
};

module.exports = { getCommission, updateCommission };
