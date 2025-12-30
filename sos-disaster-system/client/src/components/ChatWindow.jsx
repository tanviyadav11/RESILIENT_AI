import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import io from 'socket.io-client';
import api from '../services/api';
import './ChatWindow.css';

const ENDPOINT = 'http://localhost:5000';

const ChatWindow = ({ sosRequestId, onClose, currentUser }) => {
    const { t } = useLanguage();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [typing, setTyping] = useState(false);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const socketRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch existing messages
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                const { data } = await api.get(`/chat/${sosRequestId}`);
                setMessages(data);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching messages:', error);
                setLoading(false);
            }
        };

        fetchMessages();

        // Mark messages as read
        const markAsRead = async () => {
            try {
                await api.patch(`/chat/${sosRequestId}/read`, {
                    readerId: currentUser._id
                });
            } catch (error) {
                console.error('Error marking messages as read:', error);
            }
        };
        markAsRead();
    }, [sosRequestId, currentUser._id]);

    // Socket.io setup
    useEffect(() => {
        socketRef.current = io(ENDPOINT);

        // Join chat room
        socketRef.current.emit('join-chat-room', sosRequestId);

        // Listen for new messages
        socketRef.current.on('new-message', (message) => {
            setMessages((prev) => [...prev, message]);
        });

        // Listen for typing indicator
        socketRef.current.on('user-typing', ({ userName, isTyping }) => {
            if (isTyping) {
                setTyping(`${userName} ${t('isTyping')}...`);
            } else {
                setTyping(false);
            }
        });

        return () => {
            socketRef.current.emit('leave-chat-room', sosRequestId);
            socketRef.current.disconnect();
        };
    }, [sosRequestId, t]);

    // Handle send message
    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim()) return;

        const messageData = {
            content: newMessage,
            senderId: currentUser._id,
            senderRole: currentUser.role
        };

        try {
            // Save to database
            const { data } = await api.post(`/chat/${sosRequestId}`, messageData);

            // Add to local state
            setMessages((prev) => [...prev, data]);

            // Emit via socket for real-time delivery
            socketRef.current.emit('send-message', {
                sosRequestId,
                message: data
            });

            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    // Handle typing
    const handleTyping = () => {
        socketRef.current.emit('typing', {
            sosRequestId,
            userName: currentUser.name,
            isTyping: true
        });

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Stop typing indicator after 2 seconds
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current.emit('typing', {
                sosRequestId,
                userName: currentUser.name,
                isTyping: false
            });
        }, 2000);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="chat-window-overlay" onClick={onClose}>
            <div className="chat-window" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="chat-header">
                    <div>
                        <h3>{t('chat')}</h3>
                        <span className="chat-subtitle">SOS #{sosRequestId.slice(-6)}</span>
                    </div>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Messages */}
                <div className="chat-messages">
                    {loading ? (
                        <div className="chat-loading">{t('loading')}...</div>
                    ) : messages.length === 0 ? (
                        <div className="no-messages">{t('noMessages')}</div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={msg._id || index}
                                className={`message ${msg.senderId._id === currentUser._id ? 'sent' : 'received'}`}
                            >
                                <div className="message-sender">{msg.senderId.name}</div>
                                <div className="message-content">{msg.content}</div>
                                <div className="message-time">{formatTime(msg.createdAt)}</div>
                            </div>
                        ))
                    )}
                    {typing && <div className="typing-indicator">{typing}</div>}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form className="chat-input-form" onSubmit={handleSendMessage}>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => {
                            setNewMessage(e.target.value);
                            handleTyping();
                        }}
                        placeholder={t('typeMessage')}
                        className="chat-input"
                        maxLength={500}
                    />
                    <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
                        ➤
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatWindow;
