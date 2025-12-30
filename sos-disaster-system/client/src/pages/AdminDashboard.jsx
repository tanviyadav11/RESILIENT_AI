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
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                    >
                        <option value="all">All Types</option>
                        <option value="flood">🌊 Flood</option>
                        <option value="earthquake">🌍 Earthquake</option>
                        <option value="storm">⛈️ Storm</option>
                        <option value="landslide">🪨 Landslide</option>
                        <option value="wildfire">🔥 Wildfire</option>
                        <option value="avalanche">🏔️ Avalanche</option>
                        <option value="heat-wave">🌡️ Heat Wave</option>
                        <option value="cold-wave">❄️ Cold Wave</option>
                        <option value="sinkhole">🕳️ Sinkhole</option>
                    </select>
                </div>
                <button
                    onClick={handleProfileClick}
                    style={{
                        background: '#f1f5f9',
                        border: 'none',
                        fontSize: '18px',
                        color: '#475569',
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
                        e.target.style.background = '#e2e8f0';
                        e.target.style.color = '#1e293b';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = '#f1f5f9';
                        e.target.style.color = '#475569';
                    }}
                >
                    👤
                </button>
            </div>

            {/* Severity Visualization */}
            <div className="card" style={{ marginBottom: '30px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <h3>{t('activeEmergencyDistribution')}</h3>
                <div style={{ display: 'flex', height: '40px', borderRadius: '20px', overflow: 'hidden', marginTop: '15px' }}>
                    {stats.critical > 0 && <div style={{ width: `${(stats.critical / stats.total) * 100}%`, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>{t('critical')} ({stats.critical})</div>}
                    {stats.high > 0 && <div style={{ width: `${(stats.high / stats.total) * 100}%`, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>{t('high')} ({stats.high})</div>}
                    {stats.medium > 0 && <div style={{ width: `${(stats.medium / stats.total) * 100}%`, background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px', textShadow: '0 0 2px rgba(0,0,0,0.2)' }}>{t('medium')} ({stats.medium})</div>}
                    {stats.low > 0 && <div style={{ width: `${(stats.low / stats.total) * 100}%`, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>{t('low')} ({stats.low})</div>}
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '14px', color: '#666' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></div> {t('critical')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f97316' }}></div> {t('high')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fbbf24' }}></div> {t('medium')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></div> {t('low')}</div>
                </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
                <MapComponent requests={requests} />
            </div>

            <div className="card" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '20px' }}>
                <h3>{t('incomingSOS')}</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left', color: '#666' }}>
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
                                    <tr style={{ borderBottom: '1px solid #f1f1f1', backgroundColor: req.severity === 'critical' ? '#fff5f5' : 'transparent' }}>
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
                                                {req.type.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px' }}>{req.location.latitude.toFixed(4)}, {req.location.longitude.toFixed(4)}</td>
                                        <td style={{ padding: '15px' }}>{req.description}</td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                color: req.status === 'resolved' ? '#2ed573' : req.status === 'dispatched' ? '#ffa502' : '#ff4757',
                                                fontWeight: 'bold'
                                            }}>
                                                {req.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <button
                                                onClick={() => setActiveChatRequest(req)}
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
                                                    justifyContent: 'center'
                                                }}
                                                title={t('chat')}
                                            >
                                                💬
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
                                            <td colSpan="7" style={{ padding: '0 15px 15px 15px', fontSize: '0.85rem', color: '#666' }}>
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
                    <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '400px', maxWidth: '90%' }}>
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
                                                border: '1px solid #ddd',
                                                background: resourceUnit.includes(item.value) ? '#e3f2fd' : 'white',
                                                color: resourceUnit.includes(item.value) ? '#0984e3' : '#666',
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
                                    placeholder="e.g. Fire Engine 5, Ambulance 102"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('notes')}</label>
                            <textarea
                                value={actionNote}
                                onChange={(e) => setActionNote(e.target.value)}
                                placeholder={t('addDetails')}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minHeight: '80px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                onClick={closeModal}
                                style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}
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
            {activeChatRequest && currentUser && (
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
