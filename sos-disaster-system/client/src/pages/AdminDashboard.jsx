import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import MapComponent from '../components/MapComponent';
import ChatWindow from '../components/ChatWindow';
import io from 'socket.io-client';

const ENDPOINT = 'http://localhost:5000'; // Updated port

const AdminDashboard = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [requests, setRequests] = useState([]);
    const [filter, setFilter] = useState('all');
    const [socket, setSocket] = useState(null);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(''); // 'dispatch' or 'resolve'
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [actionNote, setActionNote] = useState('');
    const [resourceUnit, setResourceUnit] = useState('');
    const [activeChatRequest, setActiveChatRequest] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [unreadMessages, setUnreadMessages] = useState({}); // { requestId: count }
    const [focusLocation, setFocusLocation] = useState(null);

    // Check if user is authorized (authority or admin only)
    useEffect(() => {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        setCurrentUser(userInfo);

        // Redirect citizens to SOS page
        if (!userInfo.role || userInfo.role === 'citizen') {
            navigate('/sos');
            return;
        }
    }, [navigate]);

    useEffect(() => {
        const newSocket = io(ENDPOINT);
        setSocket(newSocket);

        // Listen for new SOS
        newSocket.on('new-sos', (newRequest) => {
            setRequests((prev) => {
                // Add new request and re-sort
                const updated = [newRequest, ...prev];
                return sortRequests(updated);
            });
            // Optional: Play alert sound
            const audio = new Audio('/alert.mp3'); // Ensure this file exists or remove
            audio.play().catch(e => console.log('Audio play failed', e));
        });

        // Listen for updates
        newSocket.on('update-sos', (updatedRequest) => {
            setRequests((prev) => {
                const updated = prev.map(req => req._id === updatedRequest._id ? updatedRequest : req);
                return sortRequests(updated);
            });
        });

        // Listen for global new messages
        newSocket.on('global-new-message', ({ sosRequestId, message }) => {
            setRequests(prev => {
                const request = prev.find(r => r._id === sosRequestId);
                if (request && message.senderRole === 'citizen') {
                    // Update focus location to pin the source
                    setFocusLocation([request.location.latitude, request.location.longitude]);

                    // Update unread count
                    setUnreadMessages(prevUnread => ({
                        ...prevUnread,
                        [sosRequestId]: (prevUnread[sosRequestId] || 0) + 1
                    }));
                }
                return prev;
            });
        });

        return () => newSocket.close();
    }, []);

    useEffect(() => {
        fetchRequests();
    }, [filter]);

    const sortRequests = (reqs) => {
        const severityOrder = { 'critical': 1, 'high': 2, 'medium': 3, 'low': 4 };
        return [...reqs].sort((a, b) => {
            const severityA = severityOrder[a.severity] || 3;
            const severityB = severityOrder[b.severity] || 3;
            if (severityA !== severityB) return severityA - severityB;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    };

    const fetchRequests = async () => {
        try {
            const params = filter !== 'all' ? { type: filter } : {};
            const response = await api.get('/sos', { params });
            // Backend already sorts, but client-side sort ensures consistency with socket updates
            setRequests(sortRequests(response.data));
        } catch (error) {
            console.error("Error fetching requests:", error);
        }
    };

    const openModal = (req, type) => {
        setSelectedRequest(req);
        setModalType(type);
        setModalOpen(true);
        setActionNote('');
        setResourceUnit('');
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedRequest(null);
    };

    const handleActionSubmit = async () => {
        if (!selectedRequest) return;

        const newStatus = modalType === 'dispatch' ? 'dispatched' : 'resolved';
        const note = modalType === 'dispatch'
            ? `Dispatched: ${resourceUnit}. Note: ${actionNote}`
            : `Resolved. Note: ${actionNote}`;

        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

        try {
            await api.patch(`/sos/${selectedRequest._id}/status`, {
                status: newStatus,
                note: note,
                updatedBy: userInfo.name || 'Admin'
            });
            closeModal();
            // Socket will handle the UI update
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    // Calculate stats for visualization
    const stats = {
        critical: requests.filter(r => r.severity === 'critical' && r.status !== 'resolved').length,
        high: requests.filter(r => r.severity === 'high' && r.status !== 'resolved').length,
        medium: requests.filter(r => r.severity === 'medium' && r.status !== 'resolved').length,
        low: requests.filter(r => r.severity === 'low' && r.status !== 'resolved').length,
        total: requests.filter(r => r.status !== 'resolved').length || 1
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return '#ef4444';
            case 'high': return '#f97316';
            case 'medium': return '#fbbf24';
            case 'low': return '#10b981';
            default: return '#6b7280';
        }
    };

    const handleProfileClick = () => {
        navigate('/profile');
    };

    return (
        <div className="admin-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 className="admin-title" style={{ color: 'var(--text-primary)', marginBottom: '25px', fontSize: '32px', fontWeight: '800' }}>
                🛡️ {t('authorityDashboard') || t('emergencyDashboard')}
            </h1>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        <option value="all">{t('allTypes') || 'All Types'}</option>
                        <option value="flood">🌊 {t('flood')}</option>
                        <option value="earthquake">🌍 {t('earthquake')}</option>
                        <option value="storm">⛈️ {t('storm')}</option>
                        <option value="landslide">🪨 {t('landslide')}</option>
                        <option value="wildfire">🔥 {t('wildfire')}</option>
                        <option value="avalanche">🏔️ {t('avalanche')}</option>
                        <option value="heat-wave">🌡️ {t('heatWave')}</option>
                        <option value="cold-wave">❄️ {t('coldWave')}</option>
                        <option value="sinkhole">🕳️ {t('sinkhole')}</option>
                    </select>
                </div>
                <button
                    onClick={handleProfileClick}
                    style={{
                        background: 'var(--bg-secondary)',
                        border: 'none',
                        fontSize: '18px',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.background = 'var(--hover-bg)';
                        e.target.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'var(--bg-secondary)';
                        e.target.style.color = 'var(--text-secondary)';
                    }}
                >
                    👤
                </button>
            </div>

            {/* Severity Visualization */}
            <div className="card" style={{ marginBottom: '30px', padding: '20px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3>{t('activeEmergencyDistribution')}</h3>
                <div style={{ display: 'flex', height: '40px', borderRadius: '20px', overflow: 'hidden', marginTop: '15px' }}>
                    {stats.critical > 0 && <div style={{ width: `${(stats.critical / stats.total) * 100}%`, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>{t('critical')} ({stats.critical})</div>}
                    {stats.high > 0 && <div style={{ width: `${(stats.high / stats.total) * 100}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>{t('high')} ({stats.high})</div>}
                    {stats.medium > 0 && <div style={{ width: `${(stats.medium / stats.total) * 100}%`, background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px', textShadow: '0 0 2px rgba(0,0,0,0.2)' }}>{t('medium')} ({stats.medium})</div>}
                    {stats.low > 0 && <div style={{ width: `${(stats.low / stats.total) * 100}%`, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>{t('low')} ({stats.low})</div>}
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div> {t('critical')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f97316' }}></div> {t('high')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24' }}></div> {t('medium')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div> {t('low')}</div>
                </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
                <MapComponent requests={requests} focusLocation={focusLocation} />
            </div>

            <div className="card" style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px' }}>
                <h3>{t('incomingSOS')}</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                <th style={{ padding: '15px' }}>{t('priority')}</th>
                                <th style={{ padding: '15px' }}>{t('time')}</th>
                                <th style={{ padding: '15px' }}>{t('type')}</th>
                                <th style={{ padding: '15px' }}>{t('location')}</th>
                                <th style={{ padding: '15px' }}>{t('description')}</th>
                                <th style={{ padding: '15px' }}>{t('status')}</th>
                                <th style={{ padding: '15px' }}>{t('chat')}</th>
                                <th style={{ padding: '15px' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((req) => (
                                <React.Fragment key={req._id}>
                                    <tr style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: req.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                backgroundColor: getSeverityColor(req.severity),
                                                color: 'white',
                                                fontWeight: 'bold',
                                                fontSize: '0.8rem',
                                                textTransform: 'uppercase',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                            }}>
                                                {req.severity || 'MEDIUM'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px' }}>{new Date(req.createdAt).toLocaleTimeString()}</td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                padding: '6px 12px',
                                                borderRadius: '20px',
                                                backgroundColor: req.type === 'fire' ? '#ffeba8' : '#e3f2fd',
                                                color: req.type === 'fire' ? '#d35400' : '#0984e3',
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem'
                                            }}>
                                                {req.type.charAt(0).toUpperCase() + req.type.slice(1)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', maxWidth: '200px', fontSize: '0.85rem' }}>
                                            {req.location.address ? (
                                                <span title={req.location.address}>{req.location.address.split(',').slice(0, 3).join(',')}...</span>
                                            ) : (
                                                `${req.location.latitude.toFixed(4)}, ${req.location.longitude.toFixed(4)}`
                                            )}
                                        </td>
                                        <td style={{ padding: '15px' }}>{req.description}</td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                color: req.status === 'resolved' ? '#2ed573' : req.status === 'dispatched' ? '#ffa502' : '#ff4757',
                                                fontWeight: 'bold'
                                            }}>
                                                {t(`status${req.status.charAt(0).toUpperCase() + req.status.slice(1)}`)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px', position: 'relative' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveChatRequest(req);
                                                    setUnreadMessages(prev => {
                                                        const updated = { ...prev };
                                                        delete updated[req._id];
                                                        return updated;
                                                    });
                                                    setFocusLocation([req.location.latitude, req.location.longitude]);
                                                }}
                                                style={{
                                                    backgroundColor: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    width: '32px',
                                                    height: '32px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    position: 'relative'
                                                }}
                                                title={t('chat')}
                                            >
                                                💬
                                                {unreadMessages[req._id] > 0 && (
                                                    <span style={{
                                                        position: 'absolute',
                                                        top: '-5px',
                                                        right: '-5px',
                                                        background: '#ef4444',
                                                        color: 'white',
                                                        borderRadius: '50%',
                                                        width: '18px',
                                                        height: '18px',
                                                        fontSize: '10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        border: '2px solid white',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {unreadMessages[req._id]}
                                                    </span>
                                                )}
                                            </button>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            {req.status === 'pending' && (
                                                <button
                                                    onClick={() => openModal(req, 'dispatch')}
                                                    style={{ backgroundColor: '#ffa502', color: 'white', padding: '8px 16px', fontSize: '0.8rem', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                                >
                                                    {t('dispatch')}
                                                </button>
                                            )}
                                            {req.status === 'dispatched' && (
                                                <button
                                                    onClick={() => openModal(req, 'resolve')}
                                                    style={{ backgroundColor: '#2ed573', color: 'white', padding: '8px 16px', fontSize: '0.8rem', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                                >
                                                    {t('resolve')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {/* Action History Row (Simplified for now) */}
                                    {req.actionLog && req.actionLog.length > 0 && (
                                        <tr>
                                            <td colSpan="8" style={{ padding: '10px 15px 15px 15px', fontSize: '0.85rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' }}>
                                                <strong>{t('history')}: </strong>
                                                {req.actionLog.map((log, idx) => (
                                                    <span key={idx} style={{ marginRight: '15px' }}>
                                                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.note} ({log.updatedBy})
                                                    </span>
                                                ))}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Action Modal */}
            {modalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{ background: 'var(--bg-card)', padding: '30px', borderRadius: '12px', width: '400px', maxWidth: '90%', border: '1px solid var(--border-color)' }}>
                        <h3>{modalType === 'dispatch' ? t('dispatchUnits') : t('resolveEmergency')}</h3>

                        {modalType === 'dispatch' && (
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('resourceUnit')}</label>

                                {/* Quick Select Buttons */}
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                    {[
                                        { label: `🚑 ${t('ambulance')}`, value: 'Ambulance' },
                                        { label: `🚒 ${t('fireTruck')}`, value: 'Fire Truck' },
                                        { label: `🚓 ${t('police')}`, value: 'Police Patrol' },
                                        { label: `🚁 ${t('rescue')}`, value: 'Rescue Team' },
                                        { label: `🚤 ${t('boat')}`, value: 'Rescue Boat' }
                                    ].map((item) => (
                                        <button
                                            key={item.value}
                                            onClick={() => setResourceUnit(item.value)}
                                            style={{
                                                padding: '6px 10px',
                                                fontSize: '0.8rem',
                                                borderRadius: '15px',
                                                border: '1px solid var(--border-color)',
                                                background: resourceUnit.includes(item.value) ? 'var(--hover-bg)' : 'var(--bg-card)',
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                <input
                                    type="text"
                                    value={resourceUnit}
                                    onChange={(e) => setResourceUnit(e.target.value)}
                                    placeholder={t('resourceUnitPlaceholder')}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('notes')}</label>
                            <textarea
                                value={actionNote}
                                onChange={(e) => setActionNote(e.target.value)}
                                placeholder={t('notesPlaceholder')}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', minHeight: '80px', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                onClick={closeModal}
                                style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleActionSubmit}
                                style={{
                                    padding: '10px 20px', borderRadius: '6px', border: 'none', color: 'white', cursor: 'pointer',
                                    background: modalType === 'dispatch' ? '#ffa502' : '#2ed573'
                                }}
                            >
                                {t('confirm')} {modalType === 'dispatch' ? t('dispatch') : t('resolve')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Window */}
            {activeChatRequest && currentUser && currentUser._id && (
                <ChatWindow
                    sosRequestId={activeChatRequest._id}
                    currentUser={currentUser}
                    onClose={() => setActiveChatRequest(null)}
                />
            )}
        </div>
    );
};

export default AdminDashboard;
