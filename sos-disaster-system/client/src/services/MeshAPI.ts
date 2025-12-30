/**
 * Mesh API Service
 * 
 * TypeScript wrapper for React Native bridge to native Bluetooth mesh module.
 * Provides JavaScript API for mesh networking functionality.
 */

class MeshAPI {
    constructor() {
        this.listeners = new Map();
        this.isNative = typeof window !== 'undefined' && window.BluetoothMesh;

        if (this.isNative) {
            this._setupNativeBridge();
        } else {
            console.warn('Bluetooth Mesh: Native module not found, using mock implementation');
            this._setupMockImplementation();
        }
    }

    /**
     * Setup native bridge for React Native
     */
    _setupNativeBridge() {
        const { BluetoothMesh } = window;

        // Listen to native events
        BluetoothMesh.addEventListener('messageReceived', (event) => {
            this._emit('messageReceived', event.message);
        });

        BluetoothMesh.addEventListener('messageSent', (event) => {
            this._emit('messageSent', event.messageId, event.success);
        });

        BluetoothMesh.addEventListener('ackReceived', (event) => {
            this._emit('ackReceived', event.originalMessageId);
        });

        BluetoothMesh.addEventListener('peerDiscovered', (event) => {
            this._emit('peerDiscovered', event.peer);
        });

        BluetoothMesh.addEventListener('peerLost', (event) => {
            this._emit('peerLost', event.peer);
        });

        BluetoothMesh.addEventListener('peerConnected', (event) => {
            this._emit('peerConnected', event.peer);
        });

        BluetoothMesh.addEventListener('peerDisconnected', (event) => {
            this._emit('peerDisconnected', event.peer);
        });

        BluetoothMesh.addEventListener('statusChange', (event) => {
            this._emit('statusChange', event.status);
        });

        BluetoothMesh.addEventListener('routingUpdate', (event) => {
            this._emit('routingUpdate', event.entry);
        });
    }

    /**
     * Setup mock implementation for web testing
     */
    _setupMockImplementation() {
        this.mockPeers = [];
        this.mockMessages = [];
        this.mockRoutingLog = [];
        this.mockStatus = 'inactive';

        // Simulate some peers for testing
        setTimeout(() => {
            this.mockPeers = [
                {
                    uuid: 'abc123def456',
                    name: 'Device-A',
                    rssi: -55,
                    lastSeen: Date.now(),
                    status: 'ACTIVE',
                    meshVersion: 1
                },
                {
                    uuid: 'def456abc789',
                    name: 'Device-B',
                    rssi: -68,
                    lastSeen: Date.now(),
                    status: 'ACTIVE',
                    meshVersion: 1
                }
            ];

            this.mockPeers.forEach(peer => {
                this._emit('peerDiscovered', peer);
            });
        }, 1000);
    }

    /**
     * Start mesh networking
     */
    async startMesh() {
        if (this.isNative) {
            return await window.BluetoothMesh.startMesh();
        } else {
            console.log('Mock: Starting mesh networking');
            this.mockStatus = 'active';
            this._emit('statusChange', 'active');
            return true;
        }
    }

    /**
     * Stop mesh networking
     */
    async stopMesh() {
        if (this.isNative) {
            return await window.BluetoothMesh.stopMesh();
        } else {
            console.log('Mock: Stopping mesh networking');
            this.mockStatus = 'inactive';
            this._emit('statusChange', 'inactive');
            return true;
        }
    }

    /**
     * Send SOS broadcast
     * @param {string} content - Emergency message content
     * @param {object} location - {lat, lng} coordinates
     * @param {string} sosType - SOS type (MEDICAL, FIRE, FLOOD, EARTHQUAKE)
     * @returns {Promise<string>} Message UUID
     */
    async sendSOS(content, location, sosType) {
        if (this.isNative) {
            return await window.BluetoothMesh.sendSOS(content, location, sosType);
        } else {
            console.log('Mock: Sending SOS', { content, location, sosType });
            const messageId = this._generateUUID();

            const routingEntry = {
                id: messageId,
                messageId,
                type: 'SOS',
                sender: 'YOU',
                recipient: 'broadcast',
                content,
                hopCount: 0,
                ttl: 5,
                timestamp: Date.now(),
                direction: 'outgoing',
                path: ['YOU']
            };

            this.mockRoutingLog.unshift(routingEntry);
            this._emit('routingUpdate', routingEntry);

            setTimeout(() => {
                this._emit('messageSent', messageId, true);
            }, 500);

            return messageId;
        }
    }

    /**
     * Send direct message to specific peer
     * @param {string} recipientUuid - Recipient device UUID
     * @param {string} content - Message content
     * @returns {Promise<string>} Message UUID
     */
    async sendMessage(recipientUuid, content) {
        if (this.isNative) {
            return await window.BluetoothMesh.sendMessage(recipientUuid, content);
        } else {
            console.log('Mock: Sending message', { recipientUuid, content });
            const messageId = this._generateUUID();

            const isBroadcast = recipientUuid === 'broadcast';
            const routingEntry = {
                id: messageId,
                messageId,
                type: isBroadcast ? 'BROADCAST' : 'DIRECT',
                sender: 'YOU',
                recipient: recipientUuid,
                content,
                hopCount: 0,
                ttl: 5,
                timestamp: Date.now(),
                direction: 'outgoing',
                path: ['YOU']
            };

            this.mockRoutingLog.unshift(routingEntry);
            this._emit('routingUpdate', routingEntry);

            setTimeout(() => {
                this._emit('messageSent', messageId, true);
            }, 500);

            // Simulate receiving message if not broadcast
            if (!isBroadcast) {
                setTimeout(() => {
                    const ack = {
                        id: this._generateUUID(),
                        type: 'ACK',
                        originalMessageId: messageId,
                        timestamp: Date.now()
                    };
                    this._emit('ackReceived', messageId);
                }, 1500);
            }

            return messageId;
        }
    }

    /**
     * Get list of nearby peers
     * @returns {Promise<Array>} List of peer objects
     */
    async getPeers() {
        if (this.isNative) {
            return await window.BluetoothMesh.getPeers();
        } else {
            return this.mockPeers;
        }
    }

    /**
     * Get received messages
     * @returns {Promise<Array>} List of messages
     */
    async getMessages() {
        if (this.isNative) {
            return await window.BluetoothMesh.getMessages();
        } else {
            return this.mockMessages;
        }
    }

    /**
     * Get routing log
     * @returns {Promise<Array>} Routing log entries
     */
    async getRoutingLog() {
        if (this.isNative) {
            return await window.BluetoothMesh.getRoutingLog();
        } else {
            return this.mockRoutingLog;
        }
    }

    /**
     * Get mesh statistics
     * @returns {Promise<object>} Statistics object
     */
    async getStatistics() {
        if (this.isNative) {
            return await window.BluetoothMesh.getStatistics();
        } else {
            return {
                isRunning: this.mockStatus === 'active',
                peerCount: this.mockPeers.length,
                messageCount: this.mockMessages.length,
                routingEntries: this.mockRoutingLog.length
            };
        }
    }

    /**
     * Set network encryption key
     * @param {string} key - 16-character encryption key
     */
    async setNetworkKey(key) {
        if (this.isNative) {
            return await window.BluetoothMesh.setNetworkKey(key);
        } else {
            console.log('Mock: Setting network key');
            return true;
        }
    }

    /**
     * Register event listener
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Unregister event listener
     * @param {string} event - Event name
     * @param {function} callback - Callback function
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Emit event to listeners
     * @private
     */
    _emit(event, ...args) {
        if (!this.listeners.has(event)) return;

        this.listeners.get(event).forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        });
    }

    /**
     * Generate UUID v4
     * @private
     */
    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Export singleton instance
const meshAPI = new MeshAPI();
export default meshAPI;

// Export class for custom instances
export { MeshAPI };
