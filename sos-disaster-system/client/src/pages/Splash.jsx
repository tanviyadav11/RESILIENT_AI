import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import './Splash.css';

const Splash = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Redirect to login after 3 seconds
        const timer = setTimeout(() => {
            navigate('/login');
        }, 3000);

        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="splash-container">
            <div className="splash-content">
                <div className="logo-wrapper">
                    <img src={logo} alt="ResilientAI Logo" className="splash-logo" />
                </div>
                <h1 className="splash-title">ResilientAI</h1>
                <p className="splash-subtitle">Disaster Management System</p>
                <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    );
};

export default Splash;
