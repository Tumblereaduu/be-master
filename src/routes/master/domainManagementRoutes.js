const express = require("express");
const router = express.Router();
const domainManagementController = require("../../controllers/master/domainManagementController");
const verifyToken = require("../../config/verifyToken");
const {allowMaster} = require("../../middleware/rbacMiddleware");

// ============================================================
// DOMAIN MANAGEMENT ROUTES
// Master only
// ============================================================

// GET /api/master/domains
router.get("/",verifyToken,allowMaster,domainManagementController.listAllDomains);

// GET /api/master/domains/:id
router.get("/:id",verifyToken,allowMaster,domainManagementController.getDomainById);

module.exports = router;
