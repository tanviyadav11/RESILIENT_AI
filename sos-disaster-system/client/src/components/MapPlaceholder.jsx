import React from 'react';

const MapPlaceholder = ({ requests }) => {
    return (
        <div style={{
            backgroundColor: '#e9ecef',
            height: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            border: '2px dashed #adb5bd'
        }}>
            <div style={{ textAlign: 'center', color: '#495057' }}>
                <h3>Live Map View</h3>
                <p>Map integration (Google Maps / Leaflet) goes here.</p>
                <p>Plotting {requests.length} active SOS requests.</p>
            </div>
        </div>
    );
};

export default MapPlaceholder;
