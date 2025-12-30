const Shelter = require('../models/Shelter');

// @desc    Get all shelters or filter by proximity (mocked proximity for now)
// @route   GET /api/shelters
// @access  Public
const getShelters = async (req, res) => {
    try {
        // In a real app, use geospatial queries ($near) with MongoDB
        // const { latitude, longitude, radius } = req.query;

        const shelters = await Shelter.find({});
        res.json(shelters);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create a new shelter
// @route   POST /api/shelters
// @access  Private (Admin)
const createShelter = async (req, res) => {
    try {
        const { name, latitude, longitude, address, capacity, type, contactNumber } = req.body;

        const shelter = new Shelter({
            name,
            location: { latitude, longitude, address },
            capacity,
            type,
            contactNumber
        });

        const createdShelter = await shelter.save();
        res.status(201).json(createdShelter);
    } catch (error) {
        res.status(400).json({ message: 'Invalid Shelter data', error: error.message });
    }
};

module.exports = {
    getShelters,
    createShelter,
};
