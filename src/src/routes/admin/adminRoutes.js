const express = require('express');
const router = express.Router();
const adminController = require("../../controllers/admin/adminController")

router.post('/', adminController.addAdmin);
router.post('/login', adminController.adminLogin);
router.get('/admins',adminController.getAdmin);
router.get("/admin/:id",adminController.getAdminById);
router.put("/admin/update/:id",adminController.updateAdmin);

module.exports = router;
