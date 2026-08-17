// routes/order.routes.js
const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/orders/orderController");
const verifyToken = require("../../config/verifyToken");

// Place a new order
router.post("/place", verifyToken, orderController.placeOrder);

router.post("/close/all/positions", verifyToken, orderController.closeAllTrades);

router.post("/close/all/profit/positions", verifyToken, orderController.closeAllProfitTrades);

router.post("/close/all/loss/positions", verifyToken, orderController.closeAllLossTrades);

router.post("/close/all/buy/positions", verifyToken, orderController.closeAllBuyTrades);

router.post("/close/all/sell/positions", verifyToken, orderController.closeAllSellTrades);

router.post("/close/pending/:id", verifyToken, orderController.closePendingOrder);

// Get all orders (optionally filtered by user_id)
router.get("/user", verifyToken, orderController.getOrders);

// Get order by ID
router.get("/:id", verifyToken, orderController.getOrderById);

// Close an order manually
router.post("/:id/close", verifyToken, orderController.closeOrder);

// Update Take Profit or Stop Loss
router.put("/:id/tp-sl", verifyToken, orderController.updateTpSl);

// Remove Tp and SL
router.put("/remove/:id/tp-sl", verifyToken, orderController.removeTpSl);

router.put('/order/update/:id', verifyToken, orderController.updateOrder);

// Get active, pending, completed, cancelled orders by User ID
router.get("/", verifyToken, orderController.getOrdersByUserID);

// hide order
router.put('/:id/hide', verifyToken, orderController.hideOrder);

// restore order
router.put('/:id/unhide', verifyToken, orderController.restoreOrder);

module.exports = router;
