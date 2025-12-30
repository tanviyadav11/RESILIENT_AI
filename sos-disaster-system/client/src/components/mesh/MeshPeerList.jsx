import React, { useState, useEffect } from 'react';
import './MeshPeerList.css';

/**
 * Mesh Peer List Component
 * 
 * Displays nearby mesh devices with real-time updates.
 */
const MeshPeerList = ({ meshAPI }) => {
  const [peers, setPeers] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [meshStatus, setMeshStatus] = useState('inactive');

  useEffect(() => {
    if (!meshAPI) return;

    // Subscribe to peer updates
    const handlePeerDiscovered = (peer) => {
      setPeers(prevPeers => {
        const index = prevPeers.findIndex(p => p.uuid === peer.uuid);
        if (index >= 0) {
          // Update existing peer
          const updated = [...prevPeers];
          updated[index] = peer;
          return updated;
        } else {
          // Add new peer
          return [...prevPeers, peer];
        }
      });
    };

    const handlePeerLost = (peer) => {
      setPeers(prevPeers => prevPeers.filter(p => p.uuid !== peer.uuid));
    };

    const handleMeshStatusChange = (status) => {
      setMeshStatus(status);
      setIsScanning(status === 'active');
    };

    meshAPI.on('peerDiscovered', handlePeerDiscovered);
    meshAPI.on('peerLost', handlePeerLost);
    meshAPI.on('statusChange', handleMeshStatusChange);

    // Load initial peers
    meshAPI.getPeers().then(setPeers);

    return () => {
      meshAPI.off('peerDiscovered', handlePeerDiscovered);
      meshAPI.off('peerLost', handlePeerLost);
      meshAPI.off('statusChange', handleMeshStatusChange);
    };
  }, [meshAPI]);

  const getSignalStrength = (rssi) => {
    if (rssi >= -50) return { level: 'excellent', bars: 4 };
    if (rssi >= -60) return { level: 'good', bars: 3 };
    if (rssi >= -70) return { level: 'fair', bars: 2 };
    return { level: 'weak', bars: 1 };
  };

  const getTimeSince = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return '#10b981';
      case 'LOW_BATTERY': return '#f59e0b';
      case 'HIGH_LOAD': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="mesh-peer-list">
      <div className="peer-list-header">
        <h2>Nearby Devices</h2>
        <div className={`mesh-status ${meshStatus}`}>
          <div className="status-indicator"></div>
          <span>{meshStatus === 'active' ? 'Mesh Active' : 'Mesh Inactive'}</span>
        </div>
      </div>

      <div className="peer-count">
        {peers.length} {peers.length === 1 ? 'device' : 'devices'} in range
      </div>

      {isScanning && peers.length === 0 && (
        <div className="scanning-indicator">
          <div className="spinner"></div>
          <p>Scanning for nearby devices...</p>
        </div>
      )}

      <div className="peer-list">
        {peers.map((peer) => {
          const signal = getSignalStrength(peer.rssi);
          return (
            <div key={peer.uuid} className="peer-item">
              <div className="peer-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>

              <div className="peer-info">
                <div className="peer-name">{peer.name || 'Unknown Device'}</div>
                <div className="peer-uuid">{peer.uuid.substring(0, 12)}</div>
                <div className="peer-meta">
                  <span className="last-seen">{getTimeSince(peer.lastSeen)}</span>
                  <span className="separator">•</span>
                  <span className="mesh-version">v{peer.meshVersion}</span>
                </div>
              </div>

              <div className="peer-status">
                <div className={`signal-strength ${signal.level}`}>
                  {[...Array(4)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`signal-bar ${i < signal.bars ? 'active' : ''}`}
                    ></div>
                  ))}
                </div>
                <div className="rssi-value">{peer.rssi} dBm</div>
                <div 
                  className="node-status" 
                  style={{ backgroundColor: getStatusColor(peer.status) }}
                >
                  {peer.status}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isScanning && peers.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          <p>No devices found</p>
          <small>Make sure Bluetooth is enabled and mesh is active</small>
        </div>
      )}
    </div>
  );
};

export default MeshPeerList;
