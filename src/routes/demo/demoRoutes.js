const express = require('express');
const router = express.Router();
const { checkDemoServer } = require('../../controllers/demo/demoController');

router.get('/', checkDemoServer);

module.exports = router;
