const SOSRequest = require('../models/SOSRequest');

// @desc    Create a new SOS request
// @route   POST /api/sos
// @access  Public
const createSOS = async (req, res) => {
    try {
        console.log('=== SOS Request Received ===');
        console.log('Body:', req.body);
        console.log('File:', req.file);

        const { latitude, longitude, description, type, severity, userId } = req.body;

        console.log('Parsed data:', { latitude, longitude, description, type, severity, userId });

        // === AI Triaging / Deduplication Logic ===
        // Check for existing active requests from the same user of the same type within the last 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const existingRequest = await SOSRequest.findOne({
            userId: userId,
            type: type,
            status: { $in: ['pending', 'dispatched'] }, // Only check active requests
            createdAt: { $gte: tenMinutesAgo }
        });

        if (existingRequest) {
            console.log('Duplicate SOS request detected. Returning existing request:', existingRequest._id);
            return res.status(200).json({
                ...existingRequest.toObject(),
                message: 'Duplicate request detected. Help is already on the way for your previous alert.'
            });
        }

        const imageUrl = req.file ? req.file.path : null;

        const sosRequest = new SOSRequest({
            location: { latitude, longitude },
            imageUrl,
            description,
            type,
            severity: severity || 'medium', // Default to medium if not provided
            userId
        });

        const createdSOS = await sosRequest.save();

        console.log('SOS saved successfully:', createdSOS._id);

        // Emit socket event
        if (req.io) {
            req.io.emit('new-sos', createdSOS);
        }

        res.status(201).json(createdSOS);
    } catch (error) {
        console.error('=== SOS Creation Error ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(400).json({ message: 'Invalid SOS data', error: error.message });
    }
};

// @desc    Get all SOS requests
// @route   GET /api/sos
// @access  Private (Admin)
const getSOSRequests = async (req, res) => {
    try {
        const { status, type } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;

        // Custom sort order for severity
        const severityOrder = {
            'critical': 1,
            'high': 2,
            'medium': 3,
            'low': 4
        };

        // Get requests
        let requests = await SOSRequest.find(filter);

        // Sort in memory because MongoDB simple sort doesn't support custom order easily without aggregation
        // Sorting by Severity (Ascending order of importance value) -> Then by Time (Newest first)
        requests.sort((a, b) => {
            const severityA = severityOrder[a.severity] || 3; // Default to medium (3)
            const severityB = severityOrder[b.severity] || 3;

            if (severityA !== severityB) {
                return severityA - severityB; // Lower number = Higher priority
            }

            // If severity is same, sort by time (newest first)
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update SOS request status
// @route   PATCH /api/sos/:id/status
// @access  Private (Admin)
const updateSOSStatus = async (req, res) => {
    try {
        const { status, note, updatedBy } = req.body;
        const sosRequest = await SOSRequest.findById(req.params.id);

        if (sosRequest) {
            sosRequest.status = status;

            // Add to action log
            sosRequest.actionLog.push({
                status: status,
                note: note || `Status updated to ${status}`,
                updatedBy: updatedBy || 'Admin',
                timestamp: new Date()
            });

            const updatedSOS = await sosRequest.save();

            // Emit update event
            if (req.io) {
                req.io.emit('update-sos', updatedSOS);
            }

            res.json(updatedSOS);
        } else {
            res.status(404).json({ message: 'SOS Request not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Invalid status update', error: error.message });
    }
};

// @desc    Get SOS requests for a specific user
// @route   GET /api/sos/user
// @access  Private
const getUserSOSRequests = async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const requests = await SOSRequest.find({ userId }).sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createSOS,
    getSOSRequests,
    updateSOSStatus,
    getUserSOSRequests,
};
