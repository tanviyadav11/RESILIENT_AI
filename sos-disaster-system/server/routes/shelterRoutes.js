const express = require('express');
const router = express.Router();
const { getShelters, createShelter } = require('../controllers/shelterController');

router.route('/')
    .get(getShelters)
    .post(createShelter);

module.exports = router;
