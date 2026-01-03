import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import ChatWindow from '../components/ChatWindow';
import './CitizenDashboard.css';

const CitizenDashboard = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [location, setLocation] = useState({ latitude: null, longitude: null });
    const [userInfo, setUserInfo] = useState({});
    const [sosHistory, setSosHistory] = useState([]);
    const [activeChatRequest, setActiveChatRequest] = useState(null);

    useEffect(() => {
        // Check auth and get user info
        const user = JSON.parse(localStorage.getItem('userInfo') || '{}');

        if (!user.role || user.role !== 'citizen') {
            navigate('/login');
            return;
        }

        setUserInfo(user);
        fetchSosHistory(user._id);
    }, [navigate]);

    useEffect(() => {
        // Get location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (error) => {
                    console.error("Error getting location:", error);
                }
            );
        }
    }, []);

    const fetchSosHistory = async (userId) => {
        try {
            const { data } = await api.get(`/sos/user?userId=${userId}`);
            setSosHistory(data);
        } catch (error) {
            console.error("Error fetching SOS history:", error);
        }
    };

    const handleSOSClick = () => {
        navigate('/sos');
    };

    const handleSheltersClick = () => {
        navigate('/shelters');
    };

    const handleAlertsClick = () => {
        navigate('/alerts');
    };

    const handleProfileClick = () => {
        navigate('/profile');
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'orange';
            case 'dispatched': return 'blue';
            case 'resolved': return 'green';
            default: return 'gray';
        }
    };

    return (
        <div className="citizen-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-left">
                    <div className="shield-icon">🛡️</div>
                    <div className="header-text">
                        <h1>{t('appTitle')}</h1>
                    </div>
                </div>
                <div className="header-right">
                    <button className="profile-icon-btn" onClick={handleProfileClick}>
                        👤
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="dashboard-content-centered">
                {/* SOS Section */}
                <div className="sos-container">
                    <button className="sos-main-button" onClick={handleSOSClick}>
                        <span className="sos-text">SOS</span>
                    </button>
                    <p className="sos-help-text">{t('pressHold')}</p>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons-grid">
                    {/* Status Button */}
                    <div className="action-btn-wrapper" onClick={handleAlertsClick}>
                        <div className="action-btn status-btn">
                            <span className="action-icon">🛡️</span>
                            <span className="action-label">{t('alerts')}</span>
                        </div>
                    </div>

                    {/* Shelters Button */}
                    <div className="action-btn-wrapper" onClick={handleSheltersClick}>
                        <div className="action-btn shelters-btn">
                            <span className="action-icon">📍</span>
                            <span className="action-label">{t('shelters')}</span>
                        </div>
                    </div>
                </div>

                {/* SOS History Section */}
                <div className="sos-history-section">
                    <h3>{t('mySOSAlerts')}</h3>
                    {sosHistory.length === 0 ? (
                        <p className="no-alerts-text">{t('noActiveAlerts')}</p>
                    ) : (
                        <div className="sos-history-list">
                            {sosHistory.map((sos) => (
                                <div key={sos._id} className="sos-history-card">
                                    <div className="sos-card-header">
                                        <div className="type-group">
                                            <span className="label-text">{t('type')}: </span>
                                            <span className="sos-type">{t(sos.type) || sos.type}</span>
                                        </div>
                                        <div className="status-group">
                                            <span className={`sos-status status-${sos.status}`} style={{ color: getStatusColor(sos.status) }}>
                                                {sos.status === 'pending' ? t('statusPending') :
                                                    sos.status === 'dispatched' ? t('statusDispatched') :
                                                        t('statusResolved')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="sos-card-body">
                                        <span className="sos-date">{new Date(sos.createdAt).toLocaleDateString()} {new Date(sos.createdAt).toLocaleTimeString()}</span>
                                        <button
                                            className="chat-btn-small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveChatRequest(sos);
                                            }}
                                            style={{
                                                marginLeft: 'auto',
                                                backgroundColor: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '15px',
                                                padding: '4px 10px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            💬 {t('chat')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Window */}
            {activeChatRequest && userInfo && userInfo._id && (
                <ChatWindow
                    sosRequestId={activeChatRequest._id}
                    currentUser={userInfo}
                    onClose={() => setActiveChatRequest(null)}
                />
            )}
        </div>
    );
};

export default CitizenDashboard;
