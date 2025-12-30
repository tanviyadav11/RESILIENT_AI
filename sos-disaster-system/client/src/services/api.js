import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // Proxy configured in vite.config.js
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add interceptors if needed (e.g., for auth tokens)

export default api;
