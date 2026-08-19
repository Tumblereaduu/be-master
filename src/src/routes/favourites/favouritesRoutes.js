const express = require("express");
const favouritesController = require("../../controllers/favourites/favouritesController");
const router = express.Router();
const verifyToken = require("../../config/verifyToken");


// Add a symbol to favorites
router.post("/add",verifyToken, favouritesController.addFavorite);

// Remove a symbol from favorites
router.delete("/remove",verifyToken, favouritesController.removeFavorite);

// Get all favorites for a user
router.get("/user/:user_id",verifyToken, favouritesController.getFavorites);

module.exports = router;
