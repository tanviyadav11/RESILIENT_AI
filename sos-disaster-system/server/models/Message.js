const mongoose = require('mongoose');

const messageSchema = mongoose.Schema(
    {
        sosRequestId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'SOSRequest'
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        senderRole: {
            type: String,
            required: true,
            enum: ['citizen', 'authority', 'admin']
        },
        content: {
            type: String,
            required: true,
            maxlength: 500
        },
        isRead: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Index for faster queries
messageSchema.index({ sosRequestId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
