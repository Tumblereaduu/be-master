const { queryDatabase } = require('../../config/db');
const { TABLES } = require('../../config/tables');

// Fetch details 
const getPhoneEmail = async (req, res) => {
    try {
        const sql = `SELECT description,whatsapp_number,email FROM ${TABLES.ADMIN_CONTACT} WHERE id = 1`;
        const result = await queryDatabase(sql);

        return res.status(200).json({
            message: "Details fetched successfully",
            data: result[0]
        });
    } catch (error) {
        console.log("Fetch error", error);
        return res.status(500).json({ message: "Fetch Server Error" });
    }
}

// Insert details
const addPhoneEmail = async (req, res) => {

    try {
        const { description, whatsapp_number, email } = req.body;

        if (!description || !whatsapp_number || !email) {
            return res.status(400).json({
                message: "All fields required!"
            });
        }

        const sql = `INSERT INTO ${TABLES.ADMIN_CONTACT} (description,whatsapp_number,email,created_at,updated_at)
                    VALUES (?,?,?,NOW(),NOW())`;

        await queryDatabase(sql, [description, whatsapp_number, email]);
        return res.status(200).json({
            message: "Inserted contact details successfully"
        });
    } catch (error) {
        console.error("Error while inserting Email and phone", error);
        return res.status(500).json({ message: "Contact Server Error" });
    }
}

// Update details 
const updateEmail = async (req, res) => {
    try {
        const { description, whatsapp_number, email } = req.body;
        if (!description || !whatsapp_number || !email) {
            return res.status(500).json({
                message: "All feilds are required"
            });
        }

        const sql = `UPDATE ${TABLES.ADMIN_CONTACT} SET description = ?, whatsapp_number=?,email = ?,updated_at=NOW() WHERE id=1`;
        await queryDatabase(sql, [description, whatsapp_number, email])

        return res.status(200).json({
            message: "Contact Details updated successfully"
        });
    } catch (error) {
        console.error("Update Error:", error);
        return res.status(500).json({ message: "Update Server Error" });
    }
}

module.exports = { getPhoneEmail, addPhoneEmail ,updateEmail};
