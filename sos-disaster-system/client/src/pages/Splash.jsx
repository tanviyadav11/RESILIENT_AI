import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import './Splash.css';

const Splash = () => {
    const navigate = useNavigate();

    const handleScreenClick = () => {
        navigate('/login');
    };

    return (
        <div className="splash-container" onClick={handleScreenClick}>
            <div className="splash-content">
                <div className="logo-wrapper">
                    <img src={logo} alt="ResilientAI Logo" className="splash-logo" />
                </div>
                <h1 className="splash-title">ResilientAI</h1>
                <p className="splash-subtitle">Disaster Management System</p>

            </div>
        </div>
    );
};

export default Splash;
