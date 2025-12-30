-- Bluetooth Mesh Network Database Schema
-- SQLite database for local message storage and mesh state

-- Create tables for mesh networking
-- Version: 1.0

-- ============================================================================
-- MESH MESSAGES TABLE
-- Stores all sent and received mesh messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesh_messages (
    id TEXT PRIMARY KEY,                    -- Message UUID
    type TEXT NOT NULL,                     -- SOS, DIRECT, RELAY, ACK
    sender_uuid TEXT NOT NULL,              -- Sender device UUID
    recipient_uuid TEXT,                    -- Recipient UUID (NULL for broadcast)
    content TEXT,                           -- Message content (encrypted)
    timestamp INTEGER NOT NULL,             -- Unix timestamp (milliseconds)
    hop_count INTEGER DEFAULT 0,            -- Number of hops traversed
    ttl INTEGER DEFAULT 5,                  -- Time-to-live (remaining hops)
    direction TEXT NOT NULL,                -- incoming, outgoing
    status TEXT DEFAULT 'pending',          -- pending, sent, delivered, failed
    location_lat REAL,                      -- Latitude (for SOS messages)
    location_lng REAL,                      -- Longitude (for SOS messages)
    sos_type TEXT,                          -- SOS type (MEDICAL, FIRE, etc.)
    priority INTEGER DEFAULT 3,             -- Message priority (1-5)
    created_at INTEGER NOT NULL,            -- Local creation timestamp
    updated_at INTEGER NOT NULL,            -- Last update timestamp
    synced_to_server INTEGER DEFAULT 0      -- 0 = not synced, 1 = synced
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_type ON mesh_messages(type);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON mesh_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON mesh_messages(sender_uuid);
CREATE INDEX IF NOT EXISTS idx_messages_status ON mesh_messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_synced ON mesh_messages(synced_to_server);

-- ============================================================================
-- MESH PEERS TABLE
-- Tracks discovered and known mesh peers
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesh_peers (
    uuid TEXT PRIMARY KEY,                  -- Peer device UUID
    name TEXT,                              -- Device name
    rssi INTEGER,                           -- Signal strength (dBm)
    last_seen INTEGER NOT NULL,             -- Last contact timestamp
    first_seen INTEGER NOT NULL,            -- First discovery timestamp
    status TEXT DEFAULT 'ACTIVE',           -- ACTIVE, LOW_BATTERY, HIGH_LOAD
    mesh_version INTEGER DEFAULT 1,         -- Protocol version
    connection_count INTEGER DEFAULT 0,     -- Number of successful connections
    message_count INTEGER DEFAULT 0,        -- Messages exchanged
    is_connected INTEGER DEFAULT 0,         -- 0 = disconnected, 1 = connected
    latitude REAL,                          -- Last known latitude
    longitude REAL,                         -- Last known longitude
    created_at INTEGER NOT NULL,            -- First seen timestamp
    updated_at INTEGER NOT NULL             -- Last update timestamp
);

-- Indexes for peer queries
CREATE INDEX IF NOT EXISTS idx_peers_last_seen ON mesh_peers(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_peers_status ON mesh_peers(status);
CREATE INDEX IF NOT EXISTS idx_peers_connected ON mesh_peers(is_connected);

-- ============================================================================
-- MESH ROUTING CACHE TABLE
-- Duplicate detection and routing history
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesh_routing_cache (
    message_hash TEXT PRIMARY KEY,          -- SHA-256 hash of message
    message_id TEXT NOT NULL,               -- Original message UUID
    sender_uuid TEXT NOT NULL,              -- Sender UUID
    timestamp INTEGER NOT NULL,             -- Receipt timestamp
    hop_count INTEGER DEFAULT 0,            -- Hop count when received
    action TEXT NOT NULL,                   -- delivered, relayed, dropped
    ttl INTEGER,                            -- TTL when processed
    expires_at INTEGER NOT NULL             -- Cache expiration timestamp
);

-- Index for cache cleanup
CREATE INDEX IF NOT EXISTS idx_routing_expires ON mesh_routing_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_routing_message ON mesh_routing_cache(message_id);

-- ============================================================================
-- STORE AND FORWARD QUEUE TABLE
-- Messages waiting to be forwarded when peers become available
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesh_forward_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,               -- Message UUID
    packet_data BLOB NOT NULL,              -- Serialized packet
    retry_count INTEGER DEFAULT 0,          -- Number of retry attempts
    max_retries INTEGER DEFAULT 20,         -- Maximum retries
    next_retry_at INTEGER NOT NULL,         -- Next retry timestamp
    created_at INTEGER NOT NULL,            -- Queue entry timestamp
    expires_at INTEGER NOT NULL,            -- Message expiration
    priority INTEGER DEFAULT 3              -- Queue priority
);

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_forward_next_retry ON mesh_forward_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_forward_expires ON mesh_forward_queue(expires_at);
CREATE INDEX IF NOT EXISTS idx_forward_priority ON mesh_forward_queue(priority DESC);

-- ============================================================================
-- MESH STATISTICS TABLE
-- Track mesh network performance and usage
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesh_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_type TEXT NOT NULL,                -- message_sent, message_received, peer_discovered, etc.
    value INTEGER DEFAULT 1,                -- Numeric value
    metadata TEXT,                          -- JSON metadata
    timestamp INTEGER NOT NULL              -- Event timestamp
);

-- Index for statistics queries
CREATE INDEX IF NOT EXISTS idx_statistics_type ON mesh_statistics(stat_type);
CREATE INDEX IF NOT EXISTS idx_statistics_timestamp ON mesh_statistics(timestamp DESC);

-- ============================================================================
-- MESH NETWORK CONFIG TABLE
-- Store mesh network configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS mesh_config (
    key TEXT PRIMARY KEY,                   -- Config key
    value TEXT NOT NULL,                    -- Config value
    updated_at INTEGER NOT NULL             -- Last update timestamp
);

-- Insert default configuration
INSERT OR IGNORE INTO mesh_config (key, value, updated_at) VALUES
    ('network_key', 'DisasterMeshNet!', strftime('%s', 'now') * 1000),
    ('device_uuid', '', strftime('%s', 'now') * 1000),
    ('mesh_enabled', '0', strftime('%s', 'now') * 1000),
    ('ttl_default', '5', strftime('%s', 'now') * 1000),
    ('scan_mode', 'BALANCED', strftime('%s', 'now') * 1000),
    ('advertise_interval_ms', '1000', strftime('%s', 'now') * 1000),
    ('cache_size', '500', strftime('%s', 'now') * 1000),
    ('cache_ttl_ms', '300000', strftime('%s', 'now') * 1000);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Recent messages view
CREATE VIEW IF NOT EXISTS view_recent_messages AS
SELECT 
    m.id,
    m.type,
    m.sender_uuid,
    p.name AS sender_name,
    m.content,
    m.timestamp,
    m.hop_count,
    m.direction,
    m.status,
    m.sos_type
FROM mesh_messages m
LEFT JOIN mesh_peers p ON m.sender_uuid = p.uuid
ORDER BY m.timestamp DESC
LIMIT 100;

-- Active peers view
CREATE VIEW IF NOT EXISTS view_active_peers AS
SELECT 
    uuid,
    name,
    rssi,
    last_seen,
    status,
    is_connected,
    (strftime('%s', 'now') * 1000 - last_seen) AS seconds_ago
FROM mesh_peers
WHERE (strftime('%s', 'now') * 1000 - last_seen) < 30000
ORDER BY rssi DESC;

-- Pending forwards view
CREATE VIEW IF NOT EXISTS view_pending_forwards AS
SELECT 
    f.message_id,
    f.retry_count,
    f.next_retry_at,
    f.priority,
    m.type,
    m.content
FROM mesh_forward_queue f
LEFT JOIN mesh_messages m ON f.message_id = m.id
WHERE f.expires_at > strftime('%s', 'now') * 1000
ORDER BY f.priority DESC, f.next_retry_at ASC;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Auto-update updated_at timestamp for messages
CREATE TRIGGER IF NOT EXISTS trigger_messages_updated_at
AFTER UPDATE ON mesh_messages
BEGIN
    UPDATE mesh_messages 
    SET updated_at = strftime('%s', 'now') * 1000
    WHERE id = NEW.id;
END;

-- Auto-update updated_at timestamp for peers
CREATE TRIGGER IF NOT EXISTS trigger_peers_updated_at
AFTER UPDATE ON mesh_peers
BEGIN
    UPDATE mesh_peers 
    SET updated_at = strftime('%s', 'now') * 1000
    WHERE uuid = NEW.uuid;
END;

-- Auto-cleanup expired routing cache
CREATE TRIGGER IF NOT EXISTS trigger_cleanup_routing_cache
AFTER INSERT ON mesh_routing_cache
BEGIN
    DELETE FROM mesh_routing_cache 
    WHERE expires_at < strftime('%s', 'now') * 1000;
END;

-- Auto-cleanup expired forward queue
CREATE TRIGGER IF NOT EXISTS trigger_cleanup_forward_queue
AFTER INSERT ON mesh_forward_queue
BEGIN
    DELETE FROM mesh_forward_queue 
    WHERE expires_at < strftime('%s', 'now') * 1000;
END;

-- ============================================================================
-- STORED PROCEDURES (Simulated with prepared statements)
-- ============================================================================

-- Common queries to prepare:

-- 1. Insert new message
-- INSERT INTO mesh_messages (id, type, sender_uuid, recipient_uuid, content, timestamp, hop_count, ttl, direction, created_at, updated_at)
-- VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- 2. Update message status
-- UPDATE mesh_messages SET status = ?, updated_at = ? WHERE id = ?;

-- 3. Get unsynced messages
-- SELECT * FROM mesh_messages WHERE synced_to_server = 0 ORDER BY timestamp DESC;

-- 4. Mark message as synced
-- UPDATE mesh_messages SET synced_to_server = 1, updated_at = ? WHERE id = ?;

-- 5. Upsert peer
-- INSERT OR REPLACE INTO mesh_peers (uuid, name, rssi, last_seen, first_seen, status, mesh_version, created_at, updated_at)
-- VALUES (?, ?, ?, ?, COALESCE((SELECT first_seen FROM mesh_peers WHERE uuid = ?), ?), ?, ?, ?, ?);

-- 6. Get active peers
-- SELECT * FROM view_active_peers;

-- 7. Check duplicate
-- SELECT EXISTS(SELECT 1 FROM mesh_routing_cache WHERE message_hash = ? AND expires_at > ?);

-- 8. Add to routing cache
-- INSERT INTO mesh_routing_cache (message_hash, message_id, sender_uuid, timestamp, hop_count, action, ttl, expires_at)
-- VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- 9. Add to forward queue
-- INSERT INTO mesh_forward_queue (message_id, packet_data, retry_count, next_retry_at, created_at, expires_at, priority)
-- VALUES (?, ?, 0, ?, ?, ?, ?);

-- 10. Get next messages to forward
-- SELECT * FROM mesh_forward_queue WHERE next_retry_at <= ? AND retry_count < max_retries ORDER BY priority DESC, next_retry_at ASC LIMIT 10;

-- ============================================================================
-- DATA RETENTION POLICY
-- ============================================================================

-- Keep messages for 30 days
-- DELETE FROM mesh_messages WHERE timestamp < strftime('%s', 'now', '-30 days') * 1000;

-- Keep peer data for 7 days after last seen
-- DELETE FROM mesh_peers WHERE last_seen < strftime('%s', 'now', '-7 days') * 1000;

-- Keep statistics for 90 days
-- DELETE FROM mesh_statistics WHERE timestamp < strftime('%s', 'now', '-90 days') * 1000;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
