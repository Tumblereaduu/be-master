const express = require("express");
const demoFavouritesController = require("../../controllers/favourites/demofavouritesController");
const router = express.Router();
const verifyToken = require("../../config/verifyToken");


// Add a symbol to favorites
router.post("/add",verifyToken, demoFavouritesController.addFavorite);

// Remove a symbol from favorites
router.delete("/remove",verifyToken, demoFavouritesController.removeFavorite);

// Get all favorites for a user
router.get("/user/:user_id",verifyToken, demoFavouritesController.getFavorites);

module.exports = router;
