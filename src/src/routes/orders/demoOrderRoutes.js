// routes/order.routes.js
const express = require("express");
const router = express.Router();
const demoOrderController = require("../../controllers/orders/demoOrderController");
const verifyToken = require("../../config/verifyToken");

// Place a new order
router.post("/place", verifyToken, demoOrderController.placeOrder);

router.post("/close/all/positions", demoOrderController.closeAllTrades);

router.post("/close/all/profit/positions", demoOrderController.closeAllProfitTrades);

router.post("/close/all/loss/positions", demoOrderController.closeAllLossTrades);

router.post("/close/all/buy/positions", demoOrderController.closeAllBuyTrades);

router.post("/close/all/sell/positions", demoOrderController.closeAllSellTrades);

router.post("/close/pending/:id", demoOrderController.closePendingOrder);

// Get all orders (optionally filtered by user_id)
router.get("/user", verifyToken, demoOrderController.getOrders);

// Get order by ID
router.get("/:id", demoOrderController.getOrderById);

router.put('/order/update/:id', demoOrderController.updateOrder);

// Close an order manually
router.post("/:id/close", demoOrderController.closeOrder);

// Update Take Profit or Stop Loss
router.put("/:id/tp-sl", verifyToken, demoOrderController.updateTpSl);

// Remove Tp and SL
router.put("/remove/:id/tp-sl", demoOrderController.removeTpSl);

// Get active, pending, completed, cancelled orders by User ID
router.get("/", demoOrderController.getOrdersByUserID);

module.exports = router;
