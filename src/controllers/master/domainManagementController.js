const { queryDatabase } = require("../../config/db");
const { TABLES } = require("../../config/tables");

const normalizeDomain = (domain) => {
    if (!domain) return "";

    return domain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/:\d+$/, "")
        .replace(/^www\./, "")
        .replace(/\/+$/, "");
};


// ============================================================
// GET ALL DOMAINS
// GET /api/master/domains
// ============================================================
const listAllDomains = async (req, res) => {
    try {
        const masterId =
            req.user?.master_id || req.user?.id;

        const role = req.user?.role;

        if (role !== "master") {
            return res.status(403).json({
                status: "error",
                message: "Access denied. Master role required."
            });
        }

        const page =
            parseInt(req.query.page, 10) || 1;

        const limit =
            parseInt(req.query.limit, 10) || 10;

        const offset =
            (page - 1) * limit;

        const search =
            (req.query.search || "").trim();

        const status =
            req.query.status || "";

        let whereClause = `
            WHERE master_id = ?
              AND deleted_at IS NULL
              AND admin_domain IS NOT NULL
              AND TRIM(admin_domain) != ''
        `;

        const params = [masterId];

        if (search) {
            whereClause += `
                AND (
                    admin_name LIKE ?
                    OR company_name LIKE ?
                    OR email_id LIKE ?
                    OR admin_domain LIKE ?
                )
            `;

            const searchTerm = `%${search}%`;

            params.push(
                searchTerm,
                searchTerm,
                searchTerm,
                searchTerm
            );
        }

        if (status) {
            whereClause += `
                AND status = ?
            `;

            params.push(status);
        }

        // Count
        const countSql = `
            SELECT COUNT(*) AS total
            FROM ${TABLES.ADMINS}
            ${whereClause}
        `;

        const [countRows] =
            await queryDatabase(
                countSql,
                params
            );

        const total =
            Number(countRows?.[0]?.total || 0);

        // Data
        const dataSql = `
            SELECT
                id,
                admin_name,
                company_name,
                email_id,
                admin_domain,
                status,
                created_at,
                updated_at
            FROM ${TABLES.ADMINS}
            ${whereClause}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `;

        const dataParams = [
            ...params,
            limit,
            offset
        ];

        const [rows] =
            await queryDatabase(
                dataSql,
                dataParams
            );

        const domains = (rows || []).map((row) => ({
            id: row.id,
            admin_id: row.id,
            admin_name: row.admin_name,
            company_name: row.company_name,
            email_id: row.email_id,
            domain: normalizeDomain(
                row.admin_domain
            ),
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));

        return res.status(200).json({
            status: "success",
            message: "Domains retrieved successfully",
            data: {
                domains,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages:
                        Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error(
            "List domains error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message: "Server error retrieving domains"
        });
    }
};


// ============================================================
// GET DOMAIN BY ID
// GET /api/master/domains/:id
// ============================================================
const getDomainById = async (req, res) => {
    try {
        const masterId =
            req.user?.master_id || req.user?.id;

        const role = req.user?.role;

        const domainId = req.params.id;

        if (role !== "master") {
            return res.status(403).json({
                status: "error",
                message: "Access denied. Master role required."
            });
        }

        if (!domainId) {
            return res.status(400).json({
                status: "error",
                message: "Domain ID is required"
            });
        }

        const sql = `
            SELECT
                id,
                admin_name,
                company_name,
                email_id,
                phone,
                admin_domain,
                status,
                logo,
                primary_color,
                secondary_color,
                created_at,
                updated_at
            FROM ${TABLES.ADMINS}
            WHERE id = ?
              AND master_id = ?
              AND deleted_at IS NULL
            LIMIT 1
        `;

        const [rows] =
            await queryDatabase(
                sql,
                [domainId, masterId]
            );

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Domain not found"
            });
        }

        return res.status(200).json({
            status: "success",
            data: {
                ...rows[0],
                domain: normalizeDomain(
                    rows[0].admin_domain
                )
            }
        });

    } catch (error) {
        console.error(
            "Get domain error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message: "Server error retrieving domain"
        });
    }
};

// ============================================================
// CREATE DOMAIN
// POST /api/master/domains
// ============================================================
const createDomain = async (req, res) => {
    try {
        const masterId =
            req.user?.master_id || req.user?.id;

        const role = req.user?.role;

        if (role !== "master") {
            return res.status(403).json({
                status: "error",
                message: "Access denied. Master role required."
            });
        }

        let {
            domain,
            client_id,
            status
        } = req.body;

        domain = normalizeDomain(domain);

        if (!domain) {
            return res.status(400).json({
                status: "error",
                message: "Domain is required"
            });
        }

        if (!client_id) {
            return res.status(400).json({
                status: "error",
                message: "Client is required"
            });
        }

        status = status || "pending";

        // Verify client belongs to current master
        const clientSql = `
            SELECT id
            FROM admins
            WHERE id = ?
              AND master_id = ?
              AND deleted_at IS NULL
            LIMIT 1
        `;

        const [clientRows] =
            await queryDatabase(
                clientSql,
                [client_id, masterId]
            );

        if (!clientRows || clientRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Client not found"
            });
        }

        // Check duplicate domain
        const duplicateSql = `
            SELECT id
            FROM domains
            WHERE LOWER(domain) = ?
            LIMIT 1
        `;

        const [duplicateRows] =
            await queryDatabase(
                duplicateSql,
                [domain]
            );

        if (
            duplicateRows &&
            duplicateRows.length > 0
        ) {
            return res.status(409).json({
                status: "error",
                message: "Domain already exists"
            });
        }

        const insertSql = `
            INSERT INTO domains
            (
                client_id,
                domain,
                status,
                ssl_status,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, 'pending', NOW(), NOW())
        `;

        const [result] =
            await queryDatabase(
                insertSql,
                [
                    client_id,
                    domain,
                    status
                ]
            );

        return res.status(201).json({
            status: "success",
            message: "Domain created successfully",
            data: {
                id: result.insertId,
                client_id,
                domain,
                status,
                ssl_status: "pending"
            }
        });

    } catch (error) {

        console.error(
            "Create domain error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message: "Server error creating domain"
        });
    }
};

// ============================================================
// UPDATE DOMAIN
// PUT /api/master/domains/:id
// ============================================================
const updateDomain = async (req, res) => {
    try {
        const masterId =
            req.user?.master_id || req.user?.id;

        const role = req.user?.role;

        const domainId =
            req.params.id;

        if (role !== "master") {
            return res.status(403).json({
                status: "error",
                message: "Access denied. Master role required."
            });
        }

        let {
            domain,
            client_id,
            status
        } = req.body;

        domain = normalizeDomain(domain);

        if (!domain) {
            return res.status(400).json({
                status: "error",
                message: "Domain is required"
            });
        }

        if (!client_id) {
            return res.status(400).json({
                status: "error",
                message: "Client is required"
            });
        }

        // Verify domain belongs to master's client
        const existingSql = `
            SELECT d.id
            FROM domains d

            INNER JOIN admins a
                ON a.id = d.client_id

            WHERE d.id = ?
              AND a.master_id = ?
              AND a.deleted_at IS NULL

            LIMIT 1
        `;

        const [existingRows] =
            await queryDatabase(
                existingSql,
                [domainId, masterId]
            );

        if (
            !existingRows ||
            existingRows.length === 0
        ) {
            return res.status(404).json({
                status: "error",
                message: "Domain not found"
            });
        }

        // Verify new client belongs to master
        const clientSql = `
            SELECT id
            FROM admins
            WHERE id = ?
              AND master_id = ?
              AND deleted_at IS NULL
            LIMIT 1
        `;

        const [clientRows] =
            await queryDatabase(
                clientSql,
                [client_id, masterId]
            );

        if (
            !clientRows ||
            clientRows.length === 0
        ) {
            return res.status(404).json({
                status: "error",
                message: "Client not found"
            });
        }

        // Duplicate domain check
        const duplicateSql = `
            SELECT id
            FROM domains
            WHERE LOWER(domain) = ?
              AND id != ?
            LIMIT 1
        `;

        const [duplicateRows] =
            await queryDatabase(
                duplicateSql,
                [domain, domainId]
            );

        if (
            duplicateRows &&
            duplicateRows.length > 0
        ) {
            return res.status(409).json({
                status: "error",
                message: "Domain already exists"
            });
        }

        const updateSql = `
            UPDATE domains
            SET
                domain = ?,
                client_id = ?,
                status = ?,
                updated_at = NOW()
            WHERE id = ?
        `;

        await queryDatabase(
            updateSql,
            [
                domain,
                client_id,
                status || "active",
                domainId
            ]
        );

        return res.status(200).json({
            status: "success",
            message: "Domain updated successfully"
        });

    } catch (error) {

        console.error(
            "Update domain error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message: "Server error updating domain"
        });
    }
};


module.exports = {
    listAllDomains,
    getDomainById,
    createDomain,
    updateDomain
};