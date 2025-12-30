import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import './Layout.css';

const Layout = ({ children }) => {
    // Get user info to show role-based navigation
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    const isLoggedIn = !!userInfo.role;
    const isCitizen = userInfo.role === 'citizen';
    const isAuthority = userInfo.role === 'authority' || userInfo.role === 'admin';

    const location = useLocation();

    return (
        <div>
            <nav className="navbar">
                <div className="container navbar-content">
                    <Link to="/" className="brand">
                        <img src={logo} alt="ResilientAI Logo" className="brand-logo" />
                        <span className="brand-name">ResilientAI</span>
                    </Link>
                    {isLoggedIn && location.pathname !== '/login' && (
                        <div>
                        </div>
                    )}
                </div>
            </nav>
            <main className="container">
                {children}
            </main>
        </div>
    );
};

export default Layout;
