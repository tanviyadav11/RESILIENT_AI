import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import './Profile.css';

const Profile = () => {
    const navigate = useNavigate();
    const { language, switchLanguage, t } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const [userInfo, setUserInfo] = useState({});

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!user.token && !user.role) {
            navigate('/login');
            return;
        }
        setUserInfo(user);
    }, []); // Empty dependency array - only run once on mount

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        navigate('/login');
    };

    const handleBack = () => {
        if (userInfo.role === 'authority' || userInfo.role === 'admin') {
            navigate('/admin');
        } else {
            navigate('/dashboard');
        }
    };

    return (
        <div className="profile-container">
            <div className="profile-header">
                <button className="back-button" onClick={handleBack}>
                    ← {t('backToDashboard')}
                </button>
                <h2>{t('profileSettings')}</h2>
            </div>

            <div className="profile-content">
                <div className="profile-card">
                    <div className="profile-avatar">
                        👤
                    </div>
                    <h3>{userInfo.name}</h3>
                    <p className="role-badge">{t(userInfo.role)}</p>
                </div>

                <div className="settings-section">
                    <h3>{t('accountInfo')}</h3>
                    <div className="info-group">
                        <label>{t('name')}</label>
                        <div className="info-value">{userInfo.name}</div>
                    </div>
                    <div className="info-group">
                        <label>{t('email')}</label>
                        <div className="info-value">{userInfo.email}</div>
                    </div>
                    <div className="info-group">
                        <label>{t('role')}</label>
                        <div className="info-value">{t(userInfo.role)}</div>
                    </div>
                </div>

                <div className="settings-section">
                    <h3>{t('language')}</h3>
                    <div className="language-selector">
                        <button
                            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                            onClick={() => switchLanguage('en')}
                        >
                            🇬🇧 {t('english')}
                        </button>
                        <button
                            className={`lang-btn ${language === 'hi' ? 'active' : ''}`}
                            onClick={() => switchLanguage('hi')}
                        >
                            🇮🇳 {t('hindi')}
                        </button>
                    </div>
                </div>

                <div className="settings-section">
                    <h3>{t('theme')}</h3>
                    <div className="theme-toggle-container">
                        <div className="theme-option">
                            <span className="theme-icon">☀️</span>
                            <span className="theme-label">{t('lightMode')}</span>
                        </div>
                        <label className="theme-switch">
                            <input
                                type="checkbox"
                                checked={theme === 'dark'}
                                onChange={toggleTheme}
                            />
                            <span className="theme-slider"></span>
                        </label>
                        <div className="theme-option">
                            <span className="theme-icon">🌙</span>
                            <span className="theme-label">{t('darkMode')}</span>
                        </div>
                    </div>
                </div>

                <button className="logout-button" onClick={handleLogout}>
                    {t('logout')}
                </button>
            </div>
        </div>
    );
};

export default Profile;
