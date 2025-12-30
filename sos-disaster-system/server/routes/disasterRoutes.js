const express = require('express');
const router = express.Router();
const { getDisasterAlerts } = require('../controllers/disasterController');

router.get('/alerts', getDisasterAlerts);

module.exports = router;
