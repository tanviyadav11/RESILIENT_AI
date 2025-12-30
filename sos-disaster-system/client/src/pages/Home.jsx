import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';
import logo from '../assets/logo.jpg';

const Home = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is logged in
        const userInfo = localStorage.getItem('userInfo');

        // If not logged in, redirect to login page
        if (!userInfo) {
            navigate('/login');
        }
    }, [navigate]);

    // Get user info to show personalized content
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

    const handleSOSClick = () => {
        navigate('/sos');
    };

    const handleAdminClick = () => {
        navigate('/admin');
    };

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        navigate('/login');
    };

    // Citizen Home Page
    if (userInfo.role === 'citizen') {
        return (
            <div className="home-container">
                <div className="home-content">
                    {/* Header */}
                    <div className="home-header">
                        <img src={logo} alt="ResilientAI Logo" className="app-logo" />
                        <h1 className="app-title">ResilientAI</h1>
                    </div>

                    {/* Emergency SOS Button */}
                    <div className="sos-button-section">
                        <button
                            className="emergency-sos-button"
                            onClick={handleSOSClick}
                        >
                            <div className="sos-icon">🚨</div>
                            <div className="sos-text">
                                <h2>EMERGENCY SOS</h2>
                                <p>Tap to send immediate help request</p>
                            </div>
                            <div className="pulse-ring"></div>
                        </button>
                    </div>

                    {/* Info Cards */}
                    <div className="info-cards">
                        <div className="info-card">
                            <div className="card-icon">⚡</div>
                            <h3>Instant Response</h3>
                            <p>Get help within minutes</p>
                        </div>
                        <div className="info-card">
                            <div className="card-icon">📍</div>
                            <h3>Auto Location</h3>
                            <p>We detect your location automatically</p>
                        </div>
                        <div className="info-card">
                            <div className="card-icon">🔒</div>
                            <h3>Secure & Safe</h3>
                            <p>Your data is protected</p>
                        </div>
                    </div>

                    {/* Emergency Types */}
                    <div className="emergency-types">
                        <h3>We Handle All Emergencies</h3>
                        <div className="emergency-grid">
                            <div className="emergency-type">🔥 Fire</div>
                            <div className="emergency-type">🌊 Flood</div>
                            <div className="emergency-type">🚑 Medical</div>
                            <div className="emergency-type">🚗 Accident</div>
                            <div className="emergency-type">⛈️ Storm</div>
                            <div className="emergency-type">❓ Other</div>
                        </div>
                    </div>

                    {/* Logout Button */}
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>
        );
    }

    // Authority/Admin Home Page
    return (
        <div className="home-container">
            <div className="home-content">
                <div className="home-header">
                    <img src={logo} alt="ResilientAI Logo" className="app-logo" />
                    <h1 className="app-title">ResilientAI</h1>
                </div>

                <div className="admin-button-section">
                    <button
                        className="admin-dashboard-button"
                        onClick={handleAdminClick}
                    >
                        <div className="admin-icon">📊</div>
                        <div className="admin-text">
                            <h2>ADMIN DASHBOARD</h2>
                            <p>View and manage emergency requests</p>
                        </div>
                    </button>
                </div>

                {/* Logout Button */}
                <button className="logout-btn" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Home;
