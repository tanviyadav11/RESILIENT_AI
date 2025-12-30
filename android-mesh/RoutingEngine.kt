package com.disaster.mesh

import android.util.Log
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.*
import org.json.JSONObject

/**
 * Routing Engine for Bluetooth Mesh Network
 * 
 * Implements controlled flooding algorithm with duplicate detection,
 * TTL management, and store-and-forward capabilities.
 */
class RoutingEngine(
    private val deviceUuid: ByteArray,
    private val networkKey: ByteArray,
    private val onMessageReceived: (MeshPacket, JSONObject) -> Unit,
    private val onRelayMessage: (MeshPacket) -> Unit
) {
    
    companion object {
        private const val TAG = "RoutingEngine"
        private const val DUPLICATE_CACHE_SIZE = 500
        private const val DUPLICATE_CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutes
        private const val TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000L // ±5 minutes
        private const val MAX_RETRY_ATTEMPTS = 20
        private const val RETRY_INTERVAL_MS = 30 * 1000L // 30 seconds
        private const val MESSAGE_EXPIRATION_MS = 60 * 60 * 1000L // 1 hour
    }
    
    // Duplicate detection cache: hash -> timestamp
    private val duplicateCache = ConcurrentHashMap<String, Long>()
    
    // Store-and-forward queue: message -> retry count
    private val storeAndForwardQueue = ConcurrentHashMap<MeshPacket, Int>()
    
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var isRunning = false
    
    /**
     * Start routing engine
     */
    fun start() {
        isRunning = true
        startCacheCleanup()
        startStoreAndForward()
        Log.d(TAG, "Routing engine started")
    }
    
    /**
     * Stop routing engine
     */
    fun stop() {
        isRunning = false
        scope.cancel()
        duplicateCache.clear()
        storeAndForwardQueue.clear()
        Log.d(TAG, "Routing engine stopped")
    }
    
    /**
     * Process incoming packet
     */
    fun processPacket(packet: MeshPacket): Boolean {
        try {
            // Step 1: Check duplicate
            if (isDuplicate(packet)) {
                Log.d(TAG, "Duplicate packet detected, discarding: ${packet.messageUuid}")
                return false
            }
            
            // Step 2: Validate timestamp
            if (!isTimestampValid(packet.timestamp)) {
                Log.w(TAG, "Invalid timestamp, possible replay attack: ${packet.timestamp}")
                return false
            }
            
            // Step 3: Decrypt payload
            val payloadJson = try {
                val decrypted = packet.decryptPayload(networkKey)
                JSONObject(decrypted)
            } catch (e: Exception) {
                Log.e(TAG, "Decryption failed: ${e.message}")
                return false
            }
            
            // Step 4: Add to duplicate cache
            markAsSeen(packet)
            
            // Step 5: Check if message is for this device
            val recipient = payloadJson.optString("recipient", "")
            val isForMe = recipient == deviceUuid.joinToString("") { "%02x".format(it) }
            val isBroadcast = recipient == "broadcast"
            
            if (isForMe || isBroadcast) {
                // Deliver to application layer
                onMessageReceived(packet, payloadJson)
                
                // Send ACK if direct message
                if (packet.messageType == MeshPacket.MessageType.DIRECT && isForMe) {
                    sendAck(packet)
                }
            }
            
            // Step 6: Check if we should relay
            if (shouldRelay(packet, isBroadcast, isForMe)) {
                relayPacket(packet, payloadJson)
            }
            
            return true
            
        } catch (e: Exception) {
            Log.e(TAG, "Error processing packet: ${e.message}", e)
            return false
        }
    }
    
    /**
     * Check if packet is duplicate
     */
    private fun isDuplicate(packet: MeshPacket): Boolean {
        val hash = packet.calculateHash()
        return duplicateCache.containsKey(hash)
    }
    
    /**
     * Mark packet as seen
     */
    private fun markAsSeen(packet: MeshPacket) {
        val hash = packet.calculateHash()
        duplicateCache[hash] = System.currentTimeMillis()
        
        // Limit cache size (LRU-like behavior)
        if (duplicateCache.size > DUPLICATE_CACHE_SIZE) {
            val oldest = duplicateCache.entries
                .minByOrNull { it.value }
                ?.key
            oldest?.let { duplicateCache.remove(it) }
        }
    }
    
    /**
     * Validate timestamp to prevent replay attacks
     */
    private fun isTimestampValid(timestamp: Long): Boolean {
        val currentTime = System.currentTimeMillis()
        val diff = Math.abs(currentTime - timestamp)
        return diff <= TIMESTAMP_TOLERANCE_MS
    }
    
    /**
     * Determine if packet should be relayed
     */
    private fun shouldRelay(
        packet: MeshPacket,
        isBroadcast: Boolean,
        isForMe: Boolean
    ): Boolean {
        // Don't relay if TTL is 0
        if (packet.ttl <= 0) {
            return false
        }
        
        // Always relay SOS broadcasts
        if (packet.messageType == MeshPacket.MessageType.SOS) {
            return true
        }
        
        // Relay broadcasts
        if (isBroadcast) {
            return true
        }
        
        // Relay direct messages if not for me
        if (!isForMe && packet.messageType == MeshPacket.MessageType.DIRECT) {
            return true
        }
        
        return false
    }
    
    /**
     * Relay packet to other peers
     */
    private fun relayPacket(packet: MeshPacket, payloadJson: JSONObject) {
        // Decrement TTL and increment hop count
        val relayPacket = packet.copy(
            messageType = MeshPacket.MessageType.RELAY,
            ttl = (packet.ttl - 1).toByte(),
            hopCount = (packet.hopCount + 1).toByte()
        )
        
        // Re-encrypt with updated header
        val encryptedPayload = relayPacket.encryptPayload(payloadJson.toString(), networkKey)
        val finalPacket = relayPacket.copy(payload = encryptedPayload)
        
        Log.d(TAG, "Relaying packet: ${finalPacket.messageUuid}, hop=${finalPacket.hopCount}, ttl=${finalPacket.ttl}")
        
        // Send to peers
        onRelayMessage(finalPacket)
    }
    
    /**
     * Send ACK for direct message
     */
    private fun sendAck(originalPacket: MeshPacket) {
        scope.launch {
            try {
                val ackPacket = MeshPacket.createAck(
                    senderUuid = deviceUuid,
                    recipientUuid = originalPacket.senderUuid,
                    originalMessageId = originalPacket.messageUuid,
                    networkKey = networkKey
                )
                onRelayMessage(ackPacket)
                Log.d(TAG, "Sent ACK for message: ${originalPacket.messageUuid}")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send ACK: ${e.message}", e)
            }
        }
    }
    
    /**
     * Add message to store-and-forward queue
     */
    fun addToStoreAndForward(packet: MeshPacket) {
        if (!isMessageExpired(packet)) {
            storeAndForwardQueue[packet] = 0
            Log.d(TAG, "Added to store-and-forward queue: ${packet.messageUuid}")
        }
    }
    
    /**
     * Check if message is expired
     */
    private fun isMessageExpired(packet: MeshPacket): Boolean {
        val age = System.currentTimeMillis() - packet.timestamp
        return age > MESSAGE_EXPIRATION_MS
    }
    
    /**
     * Start cache cleanup task
     */
    private fun startCacheCleanup() {
        scope.launch {
            while (isRunning) {
                delay(60_000) // Run every minute
                
                val now = System.currentTimeMillis()
                val expiredKeys = duplicateCache.entries
                    .filter { now - it.value > DUPLICATE_CACHE_TTL_MS }
                    .map { it.key }
                
                expiredKeys.forEach { duplicateCache.remove(it) }
                
                if (expiredKeys.isNotEmpty()) {
                    Log.d(TAG, "Cleaned ${expiredKeys.size} expired cache entries")
                }
            }
        }
    }
    
    /**
     * Start store-and-forward retry task
     */
    private fun startStoreAndForward() {
        scope.launch {
            while (isRunning) {
                delay(RETRY_INTERVAL_MS)
                
                val toRemove = mutableListOf<MeshPacket>()
                
                storeAndForwardQueue.forEach { (packet, retryCount) ->
                    if (isMessageExpired(packet) || retryCount >= MAX_RETRY_ATTEMPTS) {
                        toRemove.add(packet)
                        Log.d(TAG, "Removing from store-and-forward: ${packet.messageUuid}, expired or max retries")
                    } else {
                        // Attempt to relay
                        try {
                            val payloadJson = JSONObject(packet.decryptPayload(networkKey))
                            relayPacket(packet, payloadJson)
                            storeAndForwardQueue[packet] = retryCount + 1
                            Log.d(TAG, "Retry ${retryCount + 1} for: ${packet.messageUuid}")
                        } catch (e: Exception) {
                            Log.e(TAG, "Store-and-forward retry failed: ${e.message}")
                        }
                    }
                }
                
                toRemove.forEach { storeAndForwardQueue.remove(it) }
            }
        }
    }
    
    /**
     * Get routing statistics
     */
    fun getStatistics(): Map<String, Any> {
        return mapOf(
            "duplicateCacheSize" to duplicateCache.size,
            "storeAndForwardQueueSize" to storeAndForwardQueue.size,
            "isRunning" to isRunning
        )
    }
}
