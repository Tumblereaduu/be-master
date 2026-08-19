// routes/order.routes.js
const express = require("express");
const router = express.Router();
const orderController = require("../../controllers/orders/orderController");
const verifyToken = require("../../config/verifyToken");

// Place a new order
router.post("/place", verifyToken, orderController.placeOrder);

router.post("/close/all/positions", orderController.closeAllTrades);

router.post("/close/all/profit/positions", orderController.closeAllProfitTrades);

router.post("/close/all/loss/positions", orderController.closeAllLossTrades);

router.post("/close/all/buy/positions", orderController.closeAllBuyTrades);

router.post("/close/all/sell/positions", orderController.closeAllSellTrades);

router.post("/close/pending/:id", orderController.closePendingOrder);

// Get all orders (optionally filtered by user_id)
router.get("/user", verifyToken, orderController.getOrders);

// Get order by ID
router.get("/:id", orderController.getOrderById);

// Close an order manually
router.post("/:id/close", orderController.closeOrder);

// Update Take Profit or Stop Loss
router.put("/:id/tp-sl", verifyToken, orderController.updateTpSl);

// Remove Tp and SL
router.put("/remove/:id/tp-sl", orderController.removeTpSl);

router.put('/order/update/:id', orderController.updateOrder);

// Get active, pending, completed, cancelled orders by User ID
router.get("/", orderController.getOrdersByUserID);

// hide order
router.put('/:id/hide', orderController.hideOrder);

// restore order
router.put('/:id/unhide', orderController.restoreOrder);

module.exports = router;
