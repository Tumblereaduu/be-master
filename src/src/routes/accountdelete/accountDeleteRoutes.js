const express = require("express");
const router = express.Router();

const accountDeleteController = require("../../controllers/accountdelete/accountDeleteController");


router.post( "/account-delete-request", accountDeleteController.createAccountDeleteRequest);

router.get( "/admin/account-delete-requests/stats", accountDeleteController.getAccountDeleteRequestStats);

router.get( "/admin/account-delete-requests", accountDeleteController.getAccountDeleteRequests);

router.get( "/admin/account-delete-requests/:id", accountDeleteController.getAccountDeleteRequestById);

router.patch("/admin/account-delete-requests/:id", accountDeleteController.updateAccountDeleteRequest);

module.exports = router;
