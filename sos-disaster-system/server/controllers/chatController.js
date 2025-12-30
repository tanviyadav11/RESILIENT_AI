const asyncHandler = require('express-async-handler');
const Message = require('../models/Message');
const SOSRequest = require('../models/SOSRequest');

// @desc    Get all messages for a specific SOS request
// @route   GET /api/chat/:sosRequestId
// @access  Private
const getMessages = asyncHandler(async (req, res) => {
    const { sosRequestId } = req.params;

    // Verify SOS request exists
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
        res.status(404);
        throw new Error('SOS request not found');
    }

    // Get all messages for this SOS request
    const messages = await Message.find({ sosRequestId })
        .populate('senderId', 'name role')
        .sort({ createdAt: 1 });

    res.json(messages);
});

// @desc    Send a new message
// @route   POST /api/chat/:sosRequestId
// @access  Private
const sendMessage = asyncHandler(async (req, res) => {
    const { sosRequestId } = req.params;
    const { content, senderId, senderRole } = req.body;

    // Validate input
    if (!content || !senderId || !senderRole) {
        res.status(400);
        throw new Error('Please provide all required fields');
    }

    // Verify SOS request exists
    const sosRequest = await SOSRequest.findById(sosRequestId);
    if (!sosRequest) {
        res.status(404);
        throw new Error('SOS request not found');
    }

    // Create message
    const message = await Message.create({
        sosRequestId,
        senderId,
        senderRole,
        content: content.trim()
    });

    // Populate sender info
    const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'name role');

    res.status(201).json(populatedMessage);
});

// @desc    Mark messages as read
// @route   PATCH /api/chat/:sosRequestId/read
// @access  Private
const markMessagesAsRead = asyncHandler(async (req, res) => {
    const { sosRequestId } = req.params;
    const { readerId } = req.body;

    // Mark all messages in this SOS request as read (except user's own messages)
    await Message.updateMany(
        {
            sosRequestId,
            senderId: { $ne: readerId },
            isRead: false
        },
        { isRead: true }
    );

    res.json({ message: 'Messages marked as read' });
});

// @desc    Get unread message count for a user
// @route   GET /api/chat/unread/:userId
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Get all SOS requests for this user
    const sosRequests = await SOSRequest.find({ userId });
    const sosRequestIds = sosRequests.map(req => req._id);

    // Count unread messages (messages sent by others)
    const unreadCount = await Message.countDocuments({
        sosRequestId: { $in: sosRequestIds },
        senderId: { $ne: userId },
        isRead: false
    });

    res.json({ unreadCount });
});

module.exports = {
    getMessages,
    sendMessage,
    markMessagesAsRead,
    getUnreadCount
};
