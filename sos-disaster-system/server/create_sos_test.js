const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const createSOS = async () => {
    try {
        // 0. Register (ignore error if exists)
        console.log('Registering...');
        try {
            await axios.post(`${API_URL}/auth/register`, {
                name: 'Test Citizen',
                email: 'citizen_test_chat@example.com',
                mobile: '9998887776',
                password: 'password123',
                role: 'citizen'
            });
            console.log('Registered successfully.');
        } catch (e) {
            console.log('Registration skipped (might already exist):', e.response ? e.response.data.message : e.message);
        }

        // 1. Login
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            identifier: 'citizen_test_chat@example.com',
            password: 'password123'
        });
        const { token, _id } = loginRes.data;
        console.log('Logged in. Token:', token);

        // 2. Create SOS
        console.log('Creating SOS...');
        const sosRes = await axios.post(`${API_URL}/sos`, {
            type: 'wildfire',
            description: 'Test Fire SOS for Chat Verification',
            latitude: 28.6139,
            longitude: 77.2090,
            severity: 'high',
            userId: _id
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log('SOS Created:', sosRes.data);

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
};

createSOS();
