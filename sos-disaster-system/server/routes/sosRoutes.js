const express = require('express');
const router = express.Router();
const { createSOS, getSOSRequests, updateSOSStatus, getUserSOSRequests } = require('../controllers/sosController');
const upload = require('../middleware/upload');

router.route('/')
    .post(upload.single('image'), createSOS)
    .get(getSOSRequests);

router.route('/user')
    .get(getUserSOSRequests);

router.route('/:id/status')
    .patch(updateSOSStatus);

module.exports = router;
