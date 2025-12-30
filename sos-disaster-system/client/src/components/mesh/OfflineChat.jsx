import React, { useState, useEffect, useRef } from 'react';
import './OfflineChat.css';

/**
 * Offline Chat Component
 * 
 * Provides offline mesh messaging interface with SOS broadcast.
 */
const OfflineChat = ({ meshAPI }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [selectedPeer, setSelectedPeer] = useState(null);
    const [peers, setPeers] = useState([]);
    const [messageStatus, setMessageStatus] = useState({});
    const [location, setLocation] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        // Get current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    console.error('Error getting location:', error);
                }
            );
        }
    }, []);

    useEffect(() => {
        if (!meshAPI) return;

        // Load messages from storage
        const loadedMessages = meshAPI.getMessages();
        setMessages(loadedMessages);

        // Subscribe to events
        const handleMessageReceived = (message) => {
            setMessages(prev => [...prev, {
                id: message.id,
                type: message.type,
                sender: message.sender,
                content: message.content,
                timestamp: message.timestamp,
                hopCount: message.hopCount,
                isOwn: false
            }]);

            // Update status if it's an ACK
            if (message.type === 'ACK') {
                setMessageStatus(prev => ({
                    ...prev,
                    [message.originalMessageId]: 'delivered'
                }));
            }
        };

        const handleMessageSent = (messageId, success) => {
            setMessageStatus(prev => ({
                ...prev,
                [messageId]: success ? 'sent' : 'failed'
            }));
        };

        const handlePeerDiscovered = (peer) => {
            setPeers(prev => {
                const exists = prev.find(p => p.uuid === peer.uuid);
                if (exists) return prev;
                return [...prev, peer];
            });
        };

        const handlePeerLost = (peer) => {
            setPeers(prev => prev.filter(p => p.uuid !== peer.uuid));
        };

        meshAPI.on('messageReceived', handleMessageReceived);
        meshAPI.on('messageSent', handleMessageSent);
        meshAPI.on('peerDiscovered', handlePeerDiscovered);
        meshAPI.on('peerLost', handlePeerLost);

        // Load peers
        meshAPI.getPeers().then(setPeers);

        return () => {
            meshAPI.off('messageReceived', handleMessageReceived);
            meshAPI.off('messageSent', handleMessageSent);
            meshAPI.off('peerDiscovered', handlePeerDiscovered);
            meshAPI.off('peerLost', handlePeerLost);
        };
    }, [meshAPI]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || !meshAPI) return;

        const message = {
            id: Math.random().toString(36).substring(7),
            content: inputMessage,
            timestamp: Date.now(),
            isOwn: true,
            type: selectedPeer ? 'DIRECT' : 'BROADCAST'
        };

        // Add to local messages
        setMessages(prev => [...prev, message]);
        setMessageStatus(prev => ({ ...prev, [message.id]: 'sending' }));

        // Send via mesh
        try {
            if (selectedPeer) {
                await meshAPI.sendMessage(selectedPeer.uuid, inputMessage);
            } else {
                // Broadcast to all
                await meshAPI.sendMessage('broadcast', inputMessage);
            }
            setMessageStatus(prev => ({ ...prev, [message.id]: 'sent' }));
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessageStatus(prev => ({ ...prev, [message.id]: 'failed' }));
        }

        setInputMessage('');
    };

    const handleSOSBroadcast = async () => {
        if (!meshAPI || !location) {
            alert('Location not available. Please enable location services.');
            return;
        }

        const sosType = prompt('Select SOS type:\n1. MEDICAL\n2. FIRE\n3. FLOOD\n4. EARTHQUAKE\n\nEnter number:');
        const sosTypes = ['MEDICAL', 'FIRE', 'FLOOD', 'EARTHQUAKE'];
        const selectedType = sosTypes[parseInt(sosType) - 1] || 'EMERGENCY';

        const sosMessage = prompt('Enter emergency details (optional):') || 'Emergency SOS - Need immediate assistance!';

        try {
            const messageId = await meshAPI.sendSOS(sosMessage, location, selectedType);

            setMessages(prev => [...prev, {
                id: messageId,
                type: 'SOS',
                content: sosMessage,
                sosType: selectedType,
                timestamp: Date.now(),
                isOwn: true,
                location
            }]);

            setMessageStatus(prev => ({ ...prev, [messageId]: 'sent' }));
        } catch (error) {
            console.error('Failed to send SOS:', error);
            alert('Failed to send SOS broadcast');
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'sending': return '○';
            case 'sent': return '✓';
            case 'delivered': return '✓✓';
            case 'failed': return '✗';
            default: return '';
        }
    };

    return (
        <div className="offline-chat">
            <div className="chat-header">
                <div className="chat-title">
                    <h2>Offline Mesh Chat</h2>
                    <span className="peer-indicator">
                        {peers.length} {peers.length === 1 ? 'peer' : 'peers'} online
                    </span>
                </div>

                <button className="sos-button" onClick={handleSOSBroadcast}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    SOS Broadcast
                </button>
            </div>

            {selectedPeer && (
                <div className="recipient-bar">
                    Sending to: <strong>{selectedPeer.name || selectedPeer.uuid.substring(0, 12)}</strong>
                    <button onClick={() => setSelectedPeer(null)}>✕</button>
                </div>
            )}

            <div className="messages-container">
                {messages.length === 0 ? (
                    <div className="empty-chat">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p>No messages yet</p>
                        <small>Send a message or broadcast SOS</small>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`message ${msg.isOwn ? 'own' : 'received'} ${msg.type === 'SOS' ? 'sos' : ''}`}
                        >
                            {!msg.isOwn && (
                                <div className="message-sender">
                                    {msg.sender?.substring(0, 12) || 'Unknown'}
                                    {msg.hopCount > 0 && (
                                        <span className="hop-badge">{msg.hopCount} hop{msg.hopCount > 1 ? 's' : ''}</span>
                                    )}
                                </div>
                            )}

                            {msg.type === 'SOS' && (
                                <div className="sos-badge">
                                    ⚠️ SOS - {msg.sosType}
                                </div>
                            )}

                            <div className="message-content">{msg.content}</div>

                            <div className="message-meta">
                                <span className="message-time">{formatTime(msg.timestamp)}</span>
                                {msg.isOwn && msg.type !== 'ACK' && (
                                    <span className={`message-status ${messageStatus[msg.id]}`}>
                                        {getStatusIcon(messageStatus[msg.id])}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                <select
                    className="peer-selector"
                    value={selectedPeer?.uuid || ''}
                    onChange={(e) => {
                        const peer = peers.find(p => p.uuid === e.target.value);
                        setSelectedPeer(peer || null);
                    }}
                >
                    <option value="">Broadcast to all</option>
                    {peers.map(peer => (
                        <option key={peer.uuid} value={peer.uuid}>
                            {peer.name || peer.uuid.substring(0, 12)}
                        </option>
                    ))}
                </select>

                <input
                    type="text"
                    className="chat-input"
                    placeholder={selectedPeer ? `Message ${selectedPeer.name}...` : 'Broadcast message...'}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />

                <button
                    className="send-button"
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim()}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default OfflineChat;
