const { queryDatabase } = require("../config/db");
const { TABLES } = require("../config/tables");

const normalizeDomain = (domain) => {
    if (!domain) return null;

    return domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/:\d+$/, "")
        .replace(/\/+$/, "");
};

const tenantDomainMiddleware = async (req, res, next) => {
    try {
        let hostname = req.hostname;

        // Development
        if (
            hostname === "localhost" ||
            hostname === "127.0.0.1"
        ) {
            return next();
        }

        hostname = normalizeDomain(hostname);

        console.log("Incoming tenant domain:", hostname);

        const sql = `
            SELECT
                id,
                master_id,
                admin_name,
                company_name,
                email_id,
                phone,
                admin_domain,
                logo,
                primary_color,
                secondary_color,
                permission,
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
                message: "This domain is not registered with the SaaS platform"
            });
        }

        const tenant = rows[0];

        // Attach tenant information to request
        req.tenant = tenant;
        req.tenantId = tenant.id;
        req.masterId = tenant.master_id;

        next();

    } catch (error) {
        console.error(
            "Tenant domain middleware error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message: "Unable to resolve tenant domain"
        });
    }
};

module.exports = tenantDomainMiddleware;