const mongoose = require('mongoose');

const shelterSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    location: {
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
        },
        address: {
            type: String,
        }
    },
    capacity: {
        type: Number,
        required: true,
    },
    currentOccupancy: {
        type: Number,
        default: 0,
    },
    type: {
        type: String,
        enum: ['general', 'medical', 'women-children', 'pet-friendly'],
        default: 'general',
    },
    contactNumber: {
        type: String,
    }
}, {
    timestamps: true,
});

const Shelter = mongoose.model('Shelter', shelterSchema);

module.exports = Shelter;
