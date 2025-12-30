const axios = require('axios');

// @desc    Get current disaster alerts (Mocked external API)
// @route   GET /api/disasters/alerts
// @access  Public
const getDisasterAlerts = async (req, res) => {
    try {
        // In a real app, fetch from GDACS, USGS, or OpenWeatherMap
        // const response = await axios.get('EXTERNAL_API_URL');

        // Mock Data
        const alerts = [
            {
                id: 1,
                title: "Heavy Rainfall Warning",
                severity: "High",
                location: "Mumbai, India",
                description: "Heavy rainfall expected in the next 24 hours. Avoid low-lying areas.",
                timestamp: new Date()
            },
            {
                id: 2,
                title: "Heatwave Alert",
                severity: "Moderate",
                location: "Delhi, India",
                description: "Temperatures expected to cross 45°C. Stay hydrated.",
                timestamp: new Date()
            }
        ];

        res.json(alerts);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching alerts' });
    }
};

module.exports = { getDisasterAlerts };
