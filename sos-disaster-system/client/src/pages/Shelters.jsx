import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import './Shelters.css';

const Shelters = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [location, setLocation] = useState({ latitude: null, longitude: null });

    useEffect(() => {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

        if (!userInfo.role || userInfo.role !== 'citizen') {
            navigate('/login');
            return;
        }
    }, [navigate]);

    useEffect(() => {
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

    const handleBack = () => {
        navigate('/dashboard');
    };

    const shelters = [
        {
            id: 1,
            name: t('shelter1Name'),
            address: t('shelter1Address'),
            distance: '0.8 km',
            capacity: `500 ${t('people')}`,
            facilities: [t('medicalAid'), t('food'), t('water'), t('restrooms')],
            status: 'Open',
            phone: '+1 234-567-8900'
        },
        {
            id: 2,
            name: t('shelter2Name'),
            address: t('shelter2Address'),
            distance: '1.2 km',
            capacity: `800 ${t('people')}`,
            facilities: [t('medicalAid'), t('food'), t('water'), t('sleepingAreas')],
            status: 'Open',
            phone: '+1 234-567-8901'
        },
        {
            id: 3,
            name: t('shelter3Name'),
            address: t('shelter3Address'),
            distance: '2.5 km',
            capacity: `1200 ${t('people')}`,
            facilities: [t('medicalAid'), t('food'), t('water'), t('showers'), t('security')],
            status: 'Open',
            phone: '+1 234-567-8902'
        }
    ];

    return (
        <div className="shelters-container">
            <div className="shelters-header">
                <button className="back-btn" onClick={handleBack}>
                    ← {t('backToDashboard')}
                </button>
                <h1>📍 {t('emergencyShelters')}</h1>
                <p>{t('safeLocations')}</p>
            </div>

            {location.latitude && (
                <div className="location-banner">
                    <span className="location-icon">📍</span>
                    <span>{t('yourLocation')}: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
                </div>
            )}

            <div className="shelters-content">
                <div className="shelters-count">
                    <h2>{shelters.length} {t('sheltersAvailableCount')}</h2>
                    <p>{t('sortedByDistance')}</p>
                </div>

                <div className="shelters-list">
                    {shelters.map((shelter) => (
                        <div key={shelter.id} className="shelter-card">
                            <div className="shelter-header">
                                <div className="shelter-title">
                                    <h3>{shelter.name}</h3>
                                    <span className={`status-badge ${shelter.status.toLowerCase()}`}>
                                        {shelter.status === 'Open' ? t('statusOpen') : t('statusClosed')}
                                    </span>
                                </div>
                                <div className="shelter-distance">
                                    <span className="distance-badge">{shelter.distance}</span>
                                </div>
                            </div>

                            <div className="shelter-info">
                                <div className="info-item">
                                    <span className="info-icon">📍</span>
                                    <span>{shelter.address}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-icon">👥</span>
                                    <span>{t('capacity')}: {shelter.capacity}</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-icon">📞</span>
                                    <span>{shelter.phone}</span>
                                </div>
                            </div>

                            <div className="shelter-facilities">
                                <h4>{t('availableFacilities')}:</h4>
                                <div className="facilities-list">
                                    {shelter.facilities.map((facility, index) => (
                                        <span key={index} className="facility-tag">
                                            {facility}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <button className="directions-btn">
                                🗺️ {t('getDirections')}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Shelters;
