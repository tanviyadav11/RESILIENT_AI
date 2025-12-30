package com.disaster.mesh

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothProfile
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import kotlinx.coroutines.*
import org.json.JSONObject
import java.util.*
import java.util.concurrent.ConcurrentHashMap

/**
 * Main Bluetooth Mesh Network Manager
 * 
 * Public API for mesh networking. Coordinates peer discovery,
 * routing, and message transmission.
 */
class MeshNetworkManager(
    private val context: Context,
    private val deviceUuid: ByteArray = generateDeviceUuid(),
    private val networkKey: ByteArray = getDefaultNetworkKey()
) {
    
    companion object {
        private const val TAG = "MeshNetworkManager"
        
        /**
         * Generate unique device UUID
         */
        fun generateDeviceUuid(): ByteArray {
            return UUID.randomUUID().toString()
                .replace("-", "")
                .take(12)
                .chunked(2)
                .map { it.toInt(16).toByte() }
                .toByteArray()
        }
        
        /**
         * Get default network key (should be replaced with secure key)
         */
        fun getDefaultNetworkKey(): ByteArray {
            val key = "DisasterMeshNet!" // 16 characters = 128 bits
            return key.toByteArray(Charsets.UTF_8)
        }
    }
    
    // Components
    private var peerDiscovery: PeerDiscovery? = null
    private var routingEngine: RoutingEngine? = null
    private var meshService: BluetoothMeshService? = null
    private var serviceBound = false
    
    // GATT connections to peers
    private val peerConnections = ConcurrentHashMap<String, BluetoothGatt>()
    
    // Message listeners
    private val messageListeners = mutableListOf<MessageListener>()
    private val peerListeners = mutableListOf<PeerListener>()
    
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var isRunning = false
    
    /**
     * Message listener interface
     */
    interface MessageListener {
        fun onMessageReceived(message: MeshMessage)
        fun onMessageSent(messageId: UUID, success: Boolean)
        fun onAckReceived(originalMessageId: UUID)
    }
    
    /**
     * Peer listener interface
     */
    interface PeerListener {
        fun onPeerDiscovered(peer: PeerDiscovery.MeshPeer)
        fun onPeerLost(peer: PeerDiscovery.MeshPeer)
        fun onPeerConnected(peer: PeerDiscovery.MeshPeer)
        fun onPeerDisconnected(peer: PeerDiscovery.MeshPeer)
    }
    
    /**
     * Mesh message data class
     */
    data class MeshMessage(
        val id: UUID,
        val type: String,
        val sender: String,
        val recipient: String,
        val content: String,
        val timestamp: Long,
        val hopCount: Int,
        val location: Pair<Double, Double>? = null,
        val sosType: String? = null,
        val priority: Int = 3
    )
    
    /**
     * Service connection
     */
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as BluetoothMeshService.MeshServiceBinder
            meshService = binder.getService()
            meshService?.setMeshNetworkManager(this@MeshNetworkManager)
            serviceBound = true
            Log.d(TAG, "Mesh service connected")
        }
        
        override fun onServiceDisconnected(name: ComponentName?) {
            meshService = null
            serviceBound = false
            Log.d(TAG, "Mesh service disconnected")
        }
    }
    
    /**
     * Start mesh networking
     */
    fun startMesh() {
        if (isRunning) {
            Log.w(TAG, "Mesh already running")
            return
        }
        
        try {
            // Start background service
            val intent = Intent(context, BluetoothMeshService::class.java).apply {
                action = BluetoothMeshService.ACTION_START_MESH
            }
            context.startService(intent)
            context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            
            // Initialize routing engine
            routingEngine = RoutingEngine(
                deviceUuid = deviceUuid,
                networkKey = networkKey,
                onMessageReceived = ::handleIncomingMessage,
                onRelayMessage = ::relayMessage
            )
            routingEngine?.start()
            
            // Initialize peer discovery
            peerDiscovery = PeerDiscovery(
                context = context,
                deviceUuid = deviceUuid,
                onPeerDiscovered = ::handlePeerDiscovered,
                onPeerLost = ::handlePeerLost
            )
            peerDiscovery?.start()
            
            isRunning = true
            Log.i(TAG, "Mesh networking started")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start mesh", e)
            throw MeshException("Failed to start mesh networking", e)
        }
    }
    
    /**
     * Stop mesh networking
     */
    fun stopMesh() {
        if (!isRunning) {
            Log.w(TAG, "Mesh not running")
            return
        }
        
        try {
            peerDiscovery?.stop()
            routingEngine?.stop()
            
            // Disconnect all GATT connections
            peerConnections.values.forEach { it.close() }
            peerConnections.clear()
            
            // Stop service
            if (serviceBound) {
                context.unbindService(serviceConnection)
                serviceBound = false
            }
            
            val intent = Intent(context, BluetoothMeshService::class.java).apply {
                action = BluetoothMeshService.ACTION_STOP_MESH
            }
            context.startService(intent)
            
            isRunning = false
            scope.cancel()
            
            Log.i(TAG, "Mesh networking stopped")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping mesh", e)
        }
    }
    
    /**
     * Send SOS broadcast
     */
    fun sendSOS(
        content: String,
        location: Pair<Double, Double>,
        sosType: String
    ): UUID {
        if (!isRunning) {
            throw MeshException("Mesh not running")
        }
        
        val packet = MeshPacket.createSOS(
            senderUuid = deviceUuid,
            content = content,
            location = location,
            sosType = sosType,
            networkKey = networkKey
        )
        
        broadcastPacket(packet)
        Log.i(TAG, "SOS broadcast sent: ${packet.messageUuid}")
        
        return packet.messageUuid
    }
    
    /**
     * Send direct message
     */
    fun sendMessage(recipientUuid: ByteArray, content: String): UUID {
        if (!isRunning) {
            throw MeshException("Mesh not running")
        }
        
        val packet = MeshPacket.createDirectMessage(
            senderUuid = deviceUuid,
            recipientUuid = recipientUuid,
            content = content,
            networkKey = networkKey
        )
        
        broadcastPacket(packet)
        Log.i(TAG, "Direct message sent: ${packet.messageUuid}")
        
        return packet.messageUuid
    }
    
    /**
     * Get list of nearby peers
     */
    fun getPeers(): List<PeerDiscovery.MeshPeer> {
        return peerDiscovery?.getPeers() ?: emptyList()
    }
    
    /**
     * Get peer count
     */
    fun getPeerCount(): Int {
        return peerDiscovery?.getPeerCount() ?: 0
    }
    
    /**
     * Add message listener
     */
    fun addMessageListener(listener: MessageListener) {
        messageListeners.add(listener)
    }
    
    /**
     * Remove message listener
     */
    fun removeMessageListener(listener: MessageListener) {
        messageListeners.remove(listener)
    }
    
    /**
     * Add peer listener
     */
    fun addPeerListener(listener: PeerListener) {
        peerListeners.add(listener)
    }
    
    /**
     * Remove peer listener
     */
    fun removePeerListener(listener: PeerListener) {
        peerListeners.remove(listener)
    }
    
    /**
     * Handle incoming message from routing engine
     */
    private fun handleIncomingMessage(packet: MeshPacket, payloadJson: JSONObject) {
        val message = MeshMessage(
            id = packet.messageUuid,
            type = payloadJson.getString("type"),
            sender = payloadJson.getString("sender"),
            recipient = payloadJson.getString("recipient"),
            content = payloadJson.optString("content", ""),
            timestamp = payloadJson.getLong("timestamp") * 1000,
            hopCount = packet.hopCount.toInt(),
            location = if (payloadJson.has("location")) {
                val loc = payloadJson.getJSONObject("location")
                Pair(loc.getDouble("lat"), loc.getDouble("lng"))
            } else null,
            sosType = payloadJson.optString("sosType", null),
            priority = payloadJson.optInt("priority", 3)
        )
        
        // Notify listeners
        messageListeners.forEach { it.onMessageReceived(message) }
        
        // Handle ACK
        if (message.type == "ACK") {
            val originalMsgId = UUID.fromString(payloadJson.getString("originalMessageId"))
            messageListeners.forEach { it.onAckReceived(originalMsgId) }
        }
    }
    
    /**
     * Relay message to peers
     */
    private fun relayMessage(packet: MeshPacket) {
        broadcastPacket(packet)
    }
    
    /**
     * Broadcast packet to all connected peers
     */
    private fun broadcastPacket(packet: MeshPacket) {
        val packetBytes = packet.toBytes()
        
        scope.launch {
            val peers = getPeers()
            
            if (peers.isEmpty()) {
                // No peers available, add to store-and-forward
                routingEngine?.addToStoreAndForward(packet)
                Log.d(TAG, "No peers available, added to store-and-forward")
            } else {
                peers.forEach { peer ->
                    try {
                        sendPacketToPeer(peer, packetBytes)
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to send to peer: ${peer.name}", e)
                    }
                }
            }
        }
    }
    
    /**
     * Send packet to specific peer via GATT
     */
    private fun sendPacketToPeer(peer: PeerDiscovery.MeshPeer, packetBytes: ByteArray) {
        val peerKey = peer.uuid.joinToString("") { "%02x".format(it) }
        val gatt = peerConnections[peerKey]
        
        if (gatt != null && gatt.connect()) {
            // Send via existing connection
            writePacketToGatt(gatt, packetBytes)
        } else {
            // Create new connection (this is simplified; actual implementation would manage connections better)
            Log.d(TAG, "Need to establish GATT connection to ${peer.name}")
        }
    }
    
    /**
     * Write packet to GATT characteristic
     */
    private fun writePacketToGatt(gatt: BluetoothGatt, packetBytes: ByteArray) {
        val service = gatt.getService(BluetoothMeshService.MESH_GATT_SERVICE_UUID)
        val characteristic = service?.getCharacteristic(BluetoothMeshService.MESSAGE_CHARACTERISTIC_UUID)
        
        characteristic?.let {
            it.value = packetBytes
            gatt.writeCharacteristic(it)
        }
    }
    
    /**
     * Handle peer discovered
     */
    private fun handlePeerDiscovered(peer: PeerDiscovery.MeshPeer) {
        peerListeners.forEach { it.onPeerDiscovered(peer) }
        updateServiceNotification()
    }
    
    /**
     * Handle peer lost
     */
    private fun handlePeerLost(peer: PeerDiscovery.MeshPeer) {
        val peerKey = peer.uuid.joinToString("") { "%02x".format(it) }
        peerConnections[peerKey]?.close()
        peerConnections.remove(peerKey)
        
        peerListeners.forEach { it.onPeerLost(peer) }
        updateServiceNotification()
    }
    
    /**
     * Callback from service: peer connected via GATT
     */
    fun onPeerConnected(device: BluetoothDevice) {
        // Find corresponding MeshPeer
        val peer = peerDiscovery?.getPeers()?.find {
            device.address.replace(":", "").takeLast(12) == 
            it.uuid.joinToString("") { "%02x".format(it) }
        }
        
        peer?.let {
            peerListeners.forEach { listener -> listener.onPeerConnected(it) }
        }
    }
    
    /**
     * Callback from service: peer disconnected
     */
    fun onPeerDisconnected(device: BluetoothDevice) {
        val peer = peerDiscovery?.getPeers()?.find {
            device.address.replace(":", "").takeLast(12) == 
            it.uuid.joinToString("") { "%02x".format(it) }
        }
        
        peer?.let {
            peerListeners.forEach { listener -> listener.onPeerDisconnected(it) }
        }
    }
    
    /**
     * Callback from service: packet received
     */
    fun onPacketReceived(packetBytes: ByteArray) {
        try {
            val packet = MeshPacket.fromBytes(packetBytes)
            routingEngine?.processPacket(packet)
        } catch (e: Exception) {
            Log.e(TAG, "Error processing received packet", e)
        }
    }
    
    /**
     * Update service notification
     */
    private fun updateServiceNotification() {
        meshService?.updateNotification(getPeerCount())
    }
    
    /**
     * Get mesh statistics
     */
    fun getStatistics(): Map<String, Any> {
        val routing = routingEngine?.getStatistics() ?: emptyMap()
        return mapOf(
            "isRunning" to isRunning,
            "peerCount" to getPeerCount(),
            "deviceUuid" to deviceUuid.joinToString("") { "%02x".format(it) }
        ) + routing
    }
    
    /**
     * Mesh exception
     */
    class MeshException(message: String, cause: Throwable? = null) : Exception(message, cause)
}
