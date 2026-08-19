const express = require('express');
const router = express.Router();
const bannerController = require("../../controllers/banner/bannerController");
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.get("/view",bannerController.viewBanner);
router.post("/", upload.single("image"), bannerController.createBanner);
router.put("/toggle/:id",bannerController.toggleButton);
router.delete("/delete/:id",bannerController.deleteBanner);

module.exports = router;
