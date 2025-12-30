const express = require('express');
const router = express.Router();
const {
    getMessages,
    sendMessage,
    markMessagesAsRead,
    getUnreadCount
} = require('../controllers/chatController');

// Get all messages for an SOS request
router.get('/:sosRequestId', getMessages);

// Send a new message
router.post('/:sosRequestId', sendMessage);

// Mark messages as read
router.patch('/:sosRequestId/read', markMessagesAsRead);

// Get unread count for a user
router.get('/unread/:userId', getUnreadCount);

module.exports = router;
