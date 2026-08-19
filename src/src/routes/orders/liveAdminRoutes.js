// routes/order.routes.js
const express = require("express");
const router = express.Router();
const liveOrderController = require("../../controllers/orders/liveOrderController");
const verifyToken = require("../../config/verifyToken");

router.get("/pending/admin", liveOrderController.getPendingOrdersAdmin);
router.get("/buytrade", liveOrderController.buytrade);
router.get("/demobuytrade", liveOrderController.demoBuyTrade);
router.get("/selltrade",liveOrderController.selltrade);
router.get("/demoselltrade",liveOrderController.demoSellTrade);
router.get("/active", liveOrderController.getActiveOrders);
router.get("/lpactive", liveOrderController.getLpUsersActiveOrders);
router.get("/cancelled", liveOrderController.getCancelledOrders);
router.get("/democancelled/:userId", liveOrderController.getDemoCancelledOrders);
router.get("/active/:userId",liveOrderController. getUserActiveOrders);
router.get("/pending/:userId",liveOrderController.getUserPendingOrders);
router.get("/cancelled/:userId",liveOrderController. getUserCancelledOrders);


module.exports = router;
