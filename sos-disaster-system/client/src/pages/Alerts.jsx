import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './Alerts.css';

const Alerts = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    useEffect(() => {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

        if (!userInfo.role || userInfo.role !== 'citizen') {
            navigate('/login');
            return;
        }
    }, [navigate]);

    const handleBack = () => {
        navigate('/dashboard');
    };

    return (
        <div className="alerts-container">
            <div className="alerts-header">
                <button className="back-btn" onClick={handleBack}>
                    ← {t('backToDashboard')}
                </button>
                <h1>⚠️ {t('safetyAlerts')}</h1>
                <p>{t('currentAlerts')}</p>
            </div>

            <div className="alerts-content">
                {/* Current Status */}
                <div className="status-banner safe">
                    <div className="status-icon">🛡️</div>
                    <div className="status-info">
                        <h2>{t('statusSafe')}</h2>
                        <p>{t('statusSafeMsg')}</p>
                    </div>
                </div>

                {/* Alerts List */}
                <div className="alerts-section">
                    <h3>{t('recentAlerts')}</h3>
                    <div className="alert-item info">
                        <div className="alert-header">
                            <span className="alert-icon">ℹ️</span>
                            <span className="alert-type">{t('weatherAdvisory')}</span>
                            <span className="alert-time">2 hours ago</span>
                        </div>
                        <div className="alert-body">
                            <p>{t('heavyRainMsg')}</p>
                        </div>
                    </div>

                    <div className="alert-item success">
                        <div className="alert-header">
                            <span className="alert-icon">✅</span>
                            <span className="alert-type">{t('allClear')}</span>
                            <span className="alert-time">1 day ago</span>
                        </div>
                        <div className="alert-body">
                            <p>{t('floodLiftedMsg')}</p>
                        </div>
                    </div>

                    <div className="no-alerts">
                        <p>{t('noCriticalAlerts')}</p>
                    </div>
                </div>

                {/* Alert Settings */}
                <div className="alert-settings">
                    <h3>{t('alertPreferences')}</h3>
                    <div className="setting-item">
                        <label>
                            <input type="checkbox" defaultChecked />
                            <span>{t('pushNotifications')}</span>
                        </label>
                    </div>
                    <div className="setting-item">
                        <label>
                            <input type="checkbox" defaultChecked />
                            <span>{t('smsAlerts')}</span>
                        </label>
                    </div>
                    <div className="setting-item">
                        <label>
                            <input type="checkbox" defaultChecked />
                            <span>{t('emailNotifications')}</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Alerts;
