import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';
import './SOSSubmission.css';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map clicks
function LocationMarker({ position, setLocation, fetchAddress }) {
    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;
            setLocation({ latitude: lat, longitude: lng });
            fetchAddress(lat, lng);
        },
    });

    return position.latitude ? (
        <Marker position={[position.latitude, position.longitude]} />
    ) : null;
}

const SOSSubmission = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [location, setLocation] = useState({ latitude: null, longitude: null, address: '' });
    const [description, setDescription] = useState('');
    const [type, setType] = useState('flood');
    const [severity, setSeverity] = useState('medium');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);

    // Check if user is citizen
    useEffect(() => {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

        if (userInfo.role === 'authority' || userInfo.role === 'admin') {
            navigate('/admin');
            return;
        }
    }, [navigate]);

    const fetchAddress = async (lat, lon) => {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            if (data && data.display_name) {
                setLocation(prev => ({ ...prev, address: data.display_name }));
            }
        } catch (error) {
            console.error("Error fetching address:", error);
        }
    };

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setLocation({
                        latitude,
                        longitude,
                        address: ''
                    });
                    fetchAddress(latitude, longitude);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    setMessage({ text: "Could not get location. Please enable GPS.", type: "error" });
                }
            );
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!location.latitude) {
            setMessage({ text: "Location is required!", type: "error" });
            return;
        }

        setLoading(true);

        // Get user info from localStorage
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

        const formData = new FormData();
        formData.append('latitude', location.latitude);
        formData.append('longitude', location.longitude);
        formData.append('address', location.address || ''); // Added address
        formData.append('description', description);
        formData.append('type', type);
        formData.append('severity', severity);
        formData.append('userId', userInfo._id || userInfo.id); // Add userId
        if (image) {
            formData.append('image', image);
        }

        try {
            await api.post('/sos', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Trigger Success Screen
            setShowSuccess(true);

            // Clean up
            setDescription('');
            setImage(null);

            // Redirect back to dashboard after 4 seconds (to show off the animation)
            setTimeout(() => {
                navigate('/dashboard');
            }, 4000);
        } catch (error) {
            console.error('SOS Error:', error);
            console.error('Error response:', error.response);

            // Show detailed error message
            const errorMsg = error.response?.data?.message
                || error.response?.data?.error
                || error.message
                || "Failed to send SOS. Please try again.";

            setMessage({ text: errorMsg, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        navigate('/dashboard');
    };

    return (
        <div className="sos-form-container">
            <div className="form-header">
                <button className="back-button" onClick={handleBack}>
                    ← {t('backToDashboard')}
                </button>
                <h1 className="sos-title">🚨 {t('sosReport')}</h1>
            </div>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="sos-form">
                <div className="form-group">
                    <label>{t('location')} *</label>
                    <div className="location-display">
                        {location.address ? (
                            <div className="address-box">
                                <span className="address-text">📍 {location.address}</span>
                                <span className="coords-text">({location.latitude.toFixed(6)}, {location.longitude.toFixed(6)})</span>
                            </div>
                        ) : location.latitude ? (
                            <span>📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
                        ) : (
                            <span>{t('detectingLocation')}</span>
                        )}
                    </div>
                    {location.latitude && (
                        <div className="map-picker-container">
                            <MapContainer center={[location.latitude, location.longitude]} zoom={15} className="sos-map-container">
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <LocationMarker position={location} setLocation={setLocation} fetchAddress={fetchAddress} />
                            </MapContainer>
                            <p className="map-instruction">{t('clickToAdjustLocation')}</p>
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label>{t('emergencyType')} *</label>
                    <div className="emergency-type-grid">
                        <div
                            className={`emergency-card ${type === 'flood' ? 'active' : ''}`}
                            onClick={() => setType('flood')}
                        >
                            <div className="emergency-icon">🌊</div>
                            <div className="emergency-label">{t('flood')}</div>
                        </div>
                        <div
                            className={`emergency-card ${type === 'earthquake' ? 'active' : ''}`}
                            onClick={() => setType('earthquake')}
                        >
                            <div className="emergency-icon">🌍</div>
                            <div className="emergency-label">{t('earthquake')}</div>
                        </div>
                        <div
                            className={`emergency-card ${type === 'storm' ? 'active' : ''}`}
                            onClick={() => setType('storm')}
                        >
                            <div className="emergency-icon">⛈️</div>
                            <div className="emergency-label">{t('storm')}</div>
                        </div>
                        <div
                            className={`emergency-card ${type === 'landslide' ? 'active' : ''}`}
                            onClick={() => setType('landslide')}
                        >
                            <div className="emergency-icon">🪨</div>
                            <div className="emergency-label">{t('landslide')}</div>
                        </div>
                        <div
                            className={`emergency-card ${type === 'wildfire' ? 'active' : ''}`}
                            onClick={() => setType('wildfire')}
                        >
                            <div className="emergency-icon">🔥</div>
                            <div className="emergency-label">{t('wildfire')}</div>
                        </div>
                        <div
                            className={`emergency-card ${type === 'avalanche' ? 'active' : ''}`}
                            onClick={() => setType('avalanche')}
                        >
                            <div className="emergency-icon">🏔️</div>
                            <div className="emergency-label">{t('avalanche')}</div>
                        </div>
                        <div
                            className={`emergency-card ${type === 'heat-wave' ? 'active' : ''}`}
                            onClick={() => setType('heat-wave')}
                        >
                            <div className="emergency-icon">🌡️</div>
                            <div className="emergency-label">{t('heatWave')}</div>
                        </div>
                        <div
                            className={`emergency-card ${type === 'cold-wave' ? 'active' : ''}`}
                            onClick={() => setType('cold-wave')}
                        >
                            <div className="emergency-icon">❄️</div>
                            <div className="emergency-label">{t('coldWave')}</div>
                        </div>
                        <div
                            className={`emergency-card ${type === 'sinkhole' ? 'active' : ''}`}
                            onClick={() => setType('sinkhole')}
                        >
                            <div className="emergency-icon">🕳️</div>
                            <div className="emergency-label">{t('sinkhole')}</div>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label>{t('severityLevel')}</label>
                    <div className="severity-selection">
                        <div
                            className={`severity-btn severity-low ${severity === 'low' ? 'active' : ''}`}
                            onClick={() => setSeverity('low')}
                        >
                            <div className="severity-icon">🟢</div>
                            <div className="severity-label">{t('low')}</div>
                        </div>
                        <div
                            className={`severity-btn severity-medium ${severity === 'medium' ? 'active' : ''}`}
                            onClick={() => setSeverity('medium')}
                        >
                            <div className="severity-icon">🟡</div>
                            <div className="severity-label">{t('medium')}</div>
                        </div>
                        <div
                            className={`severity-btn severity-high ${severity === 'high' ? 'active' : ''}`}
                            onClick={() => setSeverity('high')}
                        >
                            <div className="severity-icon">🟠</div>
                            <div className="severity-label">{t('high')}</div>
                        </div>
                        <div
                            className={`severity-btn severity-critical ${severity === 'critical' ? 'active' : ''}`}
                            onClick={() => setSeverity('critical')}
                        >
                            <div className="severity-icon">🔴</div>
                            <div className="severity-label">{t('critical')}</div>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label>{t('description')}</label>
                    <textarea
                        rows="4"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('describeEmergency')}
                    ></textarea>
                </div>

                <div className="form-group">
                    <label>{t('uploadImage')}</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImage(e.target.files[0])}
                    />
                    {image && (
                        <p className="file-name">{t('selected')}: {image.name}</p>
                    )}
                </div>

                <button
                    type="submit"
                    className="btn-submit"
                    disabled={loading || !location.latitude}
                >
                    {loading ? t('sendingSOS') : `🚨 ${t('sendSOS')}`}
                </button>

                {!location.latitude && (
                    <p className="info-text">⏳ {t('waitingGPS')}</p>
                )}
            </form>

            {/* Success Overlay (Paytm Style) */}
            {showSuccess && (
                <div className="success-overlay">
                    <div className="success-card">
                        <div className="checkmark-wrapper">
                            <div className="checkmark-circle">
                                <div className="checkmark-stem"></div>
                                <div className="checkmark-kick"></div>
                            </div>
                        </div>
                        <div className="success-text-content">
                            <h2 className="success-title">{t('sosSentSuccessfully')}</h2>
                            <p className="success-description">{t('helpIsOnWay')}</p>
                            <div className="success-details">
                                <div className="detail-item">
                                    <span className="detail-label">{t('type')}:</span>
                                    <span className="detail-value">{t(type)}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-label">{t('priority')}:</span>
                                    <span className="detail-value" style={{ color: severity === 'critical' ? '#ef4444' : '#fbbf24' }}>
                                        {t(severity)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="redirect-timer">
                            {t('redirectingToDashboard')}...
                        </div>
                    </div>
                    {/* Confetti Particles */}
                    <div className="confetti"></div>
                    <div className="confetti"></div>
                    <div className="confetti"></div>
                    <div className="confetti"></div>
                    <div className="confetti"></div>
                </div>
            )}
        </div>
    );
};

export default SOSSubmission;
