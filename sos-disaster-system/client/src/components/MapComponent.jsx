import React, { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Helper component to handle map flying
function ChangeView({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.flyTo(center, zoom, {
                duration: 1.5
            });
        }
    }, [center, zoom, map]);
    return null;
}

// Custom SVG Icons for different severities
const createCustomIcon = (color) => {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="${color}">
            <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 7 13s7-7.75 7-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
            <path fill="rgba(0,0,0,0.2)" d="M12 24c-2.5 0-5-1.5-5-3 0 0 5 1 10 0 0 1.5-2.5 3-5 3z"/>
        </svg>
    `;
    return L.divIcon({
        className: 'custom-marker',
        html: svg,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });
};

const icons = {
    critical: createCustomIcon('#ef4444'), // Red
    high: createCustomIcon('#f97316'),     // Orange
    medium: createCustomIcon('#fbbf24'),   // Yellow
    low: createCustomIcon('#10b981'),      // Green
    default: createCustomIcon('#3b82f6')   // Blue
};

const MapComponent = ({ requests, focusLocation }) => {
    const { t } = useLanguage();
    // Default center (India)
    const defaultPosition = [20.5937, 78.9629];
    const center = focusLocation || (requests.length > 0 ? [requests[0].location.latitude, requests[0].location.longitude] : defaultPosition);

    return (
        <div style={{ height: '400px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)' }}>
            <MapContainer center={center} zoom={focusLocation ? 13 : 5} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <ChangeView center={center} zoom={focusLocation ? 15 : 12} />
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Street View">
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                    </LayersControl.BaseLayer>

                    <LayersControl.BaseLayer name="Satellite View">
                        <TileLayer
                            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                {/* Sort requests so Critical (high severity) are rendered LAST (on top) */}
                {[...requests].sort((a, b) => {
                    const severityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
                    return (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0);
                }).map((req) => (
                    <Marker
                        key={req._id}
                        position={[req.location.latitude, req.location.longitude]}
                        icon={icons[req.severity] || icons.default}
                        zIndexOffset={req.severity === 'critical' ? 1000 : req.severity === 'high' ? 500 : 0}
                    >
                        <Popup>
                            <div style={{ textAlign: 'center' }}>
                                <b style={{
                                    color: req.severity === 'critical' ? '#ef4444' :
                                        req.severity === 'high' ? '#f97316' :
                                            req.severity === 'medium' ? '#fbbf24' : '#10b981',
                                    textTransform: 'uppercase'
                                }}>
                                    {t(req.severity) || req.severity.toUpperCase()} {t('priority') || 'PRIORITY'}
                                </b>
                                <br />
                                <strong>{req.type.toUpperCase()}</strong>
                                <br />
                                {req.description}
                                <br />
                                {req.location.address && (
                                    <div style={{ fontSize: '0.85em', color: '#1e293b', marginBottom: '8px', fontStyle: 'italic', maxWidth: '200px', margin: '8px auto' }}>
                                        📍 {req.location.address}
                                    </div>
                                )}
                                <span style={{ fontSize: '0.85em', color: '#666' }}>
                                    {t('status') || 'Status'}: {t(`status${req.status.charAt(0).toUpperCase() + req.status.slice(1)}`)}
                                </span>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div >
    );
};

export default MapComponent;
