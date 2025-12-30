import React, { useState, useEffect } from 'react';
import './MeshRoutingLog.css';

/**
 * Mesh Routing Log Component
 * 
 * Visualizes multi-hop message routing paths and network topology.
 */
const MeshRoutingLog = ({ meshAPI }) => {
    const [routingEntries, setRoutingEntries] = useState([]);
    const [filter, setFilter] = useState('all'); // all, sos, direct, relay
    const [selectedEntry, setSelectedEntry] = useState(null);

    useEffect(() => {
        if (!meshAPI) return;

        const handleRoutingUpdate = (entry) => {
            setRoutingEntries(prev => [entry, ...prev].slice(0, 100)); // Keep last 100
        };

        meshAPI.on('routingUpdate', handleRoutingUpdate);

        // Load initial routing log
        meshAPI.getRoutingLog().then(setRoutingEntries);

        return () => {
            meshAPI.off('routingUpdate', handleRoutingUpdate);
        };
    }, [meshAPI]);

    const filteredEntries = routingEntries.filter(entry => {
        if (filter === 'all') return true;
        return entry.type.toLowerCase() === filter;
    });

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const getTypeColor = (type) => {
        switch (type.toUpperCase()) {
            case 'SOS': return '#ef4444';
            case 'DIRECT': return '#3b82f6';
            case 'RELAY': return '#8b5cf6';
            case 'ACK': return '#10b981';
            default: return '#6b7280';
        }
    };

    const getTypeIcon = (type) => {
        switch (type.toUpperCase()) {
            case 'SOS':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                );
            case 'DIRECT':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                );
            case 'RELAY':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                );
            default:
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
        }
    };

    const renderPath = (path) => {
        if (!path || path.length === 0) return null;

        return (
            <div className="routing-path">
                {path.map((node, index) => (
                    <React.Fragment key={index}>
                        <div className="path-node">
                            <div className="node-avatar">{node.substring(0, 2).toUpperCase()}</div>
                            <div className="node-info">
                                <div className="node-name">{node}</div>
                                <div className="node-hop">Hop {index}</div>
                            </div>
                        </div>
                        {index < path.length - 1 && (
                            <div className="path-arrow">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    return (
        <div className="mesh-routing-log">
            <div className="log-header">
                <h2>Mesh Routing Log</h2>
                <div className="log-stats">
                    <span>{filteredEntries.length} entries</span>
                </div>
            </div>

            <div className="filter-tabs">
                <button
                    className={filter === 'all' ? 'active' : ''}
                    onClick={() => setFilter('all')}
                >
                    All
                </button>
                <button
                    className={filter === 'sos' ? 'active' : ''}
                    onClick={() => setFilter('sos')}
                >
                    SOS
                </button>
                <button
                    className={filter === 'direct' ? 'active' : ''}
                    onClick={() => setFilter('direct')}
                >
                    Direct
                </button>
                <button
                    className={filter === 'relay' ? 'active' : ''}
                    onClick={() => setFilter('relay')}
                >
                    Relay
                </button>
            </div>

            <div className="log-entries">
                {filteredEntries.length === 0 ? (
                    <div className="empty-log">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p>No routing entries yet</p>
                        <small>Messages will appear here as they are sent and received</small>
                    </div>
                ) : (
                    filteredEntries.map((entry, index) => (
                        <div
                            key={entry.id || index}
                            className={`log-entry ${selectedEntry === entry.id ? 'selected' : ''}`}
                            onClick={() => setSelectedEntry(selectedEntry === entry.id ? null : entry.id)}
                        >
                            <div className="entry-header">
                                <div
                                    className="entry-icon"
                                    style={{ background: getTypeColor(entry.type) }}
                                >
                                    {getTypeIcon(entry.type)}
                                </div>

                                <div className="entry-main">
                                    <div className="entry-title">
                                        <span className="entry-type">{entry.type}</span>
                                        {entry.hopCount > 0 && (
                                            <span className="hop-count">{entry.hopCount} hops</span>
                                        )}
                                    </div>
                                    <div className="entry-subtitle">
                                        Message ID: {entry.messageId?.substring(0, 16)}...
                                    </div>
                                </div>

                                <div className="entry-meta">
                                    <div className="entry-time">{formatTimestamp(entry.timestamp)}</div>
                                    {entry.direction && (
                                        <div className={`entry-direction ${entry.direction}`}>
                                            {entry.direction === 'incoming' ? '↓' : '↑'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedEntry === entry.id && (
                                <div className="entry-details">
                                    <div className="detail-row">
                                        <span className="detail-label">Sender:</span>
                                        <span className="detail-value">{entry.sender || 'Unknown'}</span>
                                    </div>

                                    {entry.recipient && (
                                        <div className="detail-row">
                                            <span className="detail-label">Recipient:</span>
                                            <span className="detail-value">{entry.recipient}</span>
                                        </div>
                                    )}

                                    {entry.content && (
                                        <div className="detail-row">
                                            <span className="detail-label">Content:</span>
                                            <span className="detail-value">{entry.content}</span>
                                        </div>
                                    )}

                                    <div className="detail-row">
                                        <span className="detail-label">TTL:</span>
                                        <span className="detail-value">{entry.ttl || 'N/A'}</span>
                                    </div>

                                    {entry.path && entry.path.length > 0 && (
                                        <div className="detail-row full-width">
                                            <span className="detail-label">Routing Path:</span>
                                            {renderPath(entry.path)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MeshRoutingLog;
