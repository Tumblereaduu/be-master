const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");

const normalizeDomain = (domain) => {
    return domain
        ?.trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/:\d+$/, "")
        .replace(/\/+$/, "");
};

const getCurrentTenant = async (req, res) => {
    try {
        console.log("=================================");
        console.log("HOSTNAME:", req.hostname);
        console.log("HOST:", req.headers.host);
        console.log("ORIGIN:", req.headers.origin);
        console.log("=================================");

        const hostname = normalizeDomain(req.hostname);

        console.log("NORMALIZED DOMAIN:", hostname);

        const sql = `
            SELECT
                id,
                master_id,
                admin_name,
                company_name,
                admin_domain,
                logo,
                primary_color,
                secondary_color,
                status
            FROM ${TABLES.ADMINS}
            WHERE admin_domain = ?
              AND status = 'active'
              AND deleted_at IS NULL
            LIMIT 1
        `;

        const [rows] = await queryDatabase(sql, [hostname]);

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Tenant not found"
            });
        }

        const tenant = rows[0];

        return res.status(200).json({
            status: "success",
            data: {
                tenant_id: tenant.id,
                master_id: tenant.master_id,
                admin_name: tenant.admin_name,
                company_name: tenant.company_name,
                domain: tenant.admin_domain,
                logo: tenant.logo,
                primary_color: tenant.primary_color,
                secondary_color: tenant.secondary_color
            }
        });

    } catch (error) {
        console.error("Get current tenant error:", error);

        return res.status(500).json({
            status: "error",
            message: "Server error resolving tenant"
        });
    }
};

module.exports = {
    getCurrentTenant
};