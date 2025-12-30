const mongoose = require('mongoose');

const sosRequestSchema = mongoose.Schema({
    location: {
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
        },
    },
    imageUrl: {
        type: String,
    },
    description: {
        type: String,
    },
    type: {
        type: String,
        enum: ['flood', 'earthquake', 'storm', 'landslide', 'wildfire', 'avalanche', 'heat-wave', 'cold-wave', 'sinkhole'],
        default: 'flood',
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
    },
    status: {
        type: String,
        enum: ['pending', 'dispatched', 'resolved'],
        default: 'pending',
    },
    actionLog: [{
        status: String,
        note: String,
        updatedBy: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    userId: {
        type: String, // Could be linked to a User model if auth is implemented
    },
}, {
    timestamps: true,
});

const SOSRequest = mongoose.model('SOSRequest', sosRequestSchema);

module.exports = SOSRequest;
