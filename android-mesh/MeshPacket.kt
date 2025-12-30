package com.disaster.mesh

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.*
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.experimental.xor
import org.json.JSONObject

/**
 * Bluetooth Mesh Packet
 * 
 * Binary packet structure for mesh network communication.
 * Total size: 34 bytes (header + CRC) + variable payload
 */
data class MeshPacket(
    val protocolVersion: Byte = 0x01,
    val messageType: MessageType,
    val messageUuid: UUID,
    var hopCount: Byte = 0,
    var ttl: Byte = 5,
    val timestamp: Long,
    val senderUuid: ByteArray,
    val payload: ByteArray
) {
    
    enum class MessageType(val value: Byte) {
        SOS(0x01),
        DIRECT(0x02),
        RELAY(0x03),
        ACK(0x04);
        
        companion object {
            fun fromByte(value: Byte): MessageType {
                return values().find { it.value == value } 
                    ?: throw IllegalArgumentException("Unknown message type: $value")
            }
        }
    }
    
    /**
     * Serialize packet to binary format
     */
    fun toBytes(): ByteArray {
        val payloadLength = payload.size.toShort()
        val headerSize = 32
        val buffer = ByteBuffer.allocate(headerSize + 2 + payload.size)
            .order(ByteOrder.BIG_ENDIAN)
        
        // Write header
        buffer.put(protocolVersion)
        buffer.put(messageType.value)
        
        // Message UUID (16 bytes)
        val uuidBytes = uuidToBytes(messageUuid)
        buffer.put(uuidBytes)
        
        // Hop and TTL
        buffer.put(hopCount)
        buffer.put(ttl)
        
        // Timestamp (4 bytes)
        buffer.putInt((timestamp / 1000).toInt())
        
        // Sender UUID (6 bytes - truncated)
        buffer.put(senderUuid.copyOf(6))
        
        // Payload length
        buffer.putShort(payloadLength)
        
        // Calculate CRC
        val headerBytes = buffer.array().copyOfRange(0, headerSize)
        val crc = calculateCRC16(headerBytes + payload)
        buffer.putShort(crc)
        
        // Add payload
        buffer.put(payload)
        
        return buffer.array()
    }
    
    /**
     * Calculate message hash for duplicate detection
     */
    fun calculateHash(): String {
        val data = messageUuid.toString() + senderUuid.joinToString("")
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(data.toByteArray())
            .joinToString("") { "%02x".format(it) }
            .substring(0, 16)
    }
    
    /**
     * Encrypt payload using AES-128-CBC
     */
    fun encryptPayload(jsonPayload: String, networkKey: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        val keySpec = SecretKeySpec(networkKey.copyOf(16), "AES")
        
        // Use first 16 bytes of message UUID as IV
        val iv = uuidToBytes(messageUuid).copyOf(16)
        val ivSpec = IvParameterSpec(iv)
        
        cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec)
        return cipher.doFinal(jsonPayload.toByteArray(Charsets.UTF_8))
    }
    
    /**
     * Decrypt payload
     */
    fun decryptPayload(networkKey: ByteArray): String {
        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        val keySpec = SecretKeySpec(networkKey.copyOf(16), "AES")
        
        val iv = uuidToBytes(messageUuid).copyOf(16)
        val ivSpec = IvParameterSpec(iv)
        
        cipher.init(Cipher.DECRYPT_MODE, keySpec, ivSpec)
        val decrypted = cipher.doFinal(payload)
        return String(decrypted, Charsets.UTF_8)
    }
    
    companion object {
        /**
         * Deserialize packet from binary data
         */
        fun fromBytes(data: ByteArray): MeshPacket {
            val buffer = ByteBuffer.wrap(data).order(ByteOrder.BIG_ENDIAN)
            
            // Read header
            val protocolVersion = buffer.get()
            val messageType = MessageType.fromByte(buffer.get())
            
            // Message UUID
            val uuidBytes = ByteArray(16)
            buffer.get(uuidBytes)
            val messageUuid = bytesToUuid(uuidBytes)
            
            // Hop and TTL
            val hopCount = buffer.get()
            val ttl = buffer.get()
            
            // Timestamp
            val timestamp = buffer.int.toLong() * 1000
            
            // Sender UUID
            val senderUuid = ByteArray(6)
            buffer.get(senderUuid)
            
            // Payload length
            val payloadLength = buffer.short.toInt()
            
            // Verify CRC
            val receivedCrc = buffer.short
            val headerBytes = data.copyOfRange(0, 32)
            val payloadBytes = data.copyOfRange(36, 36 + payloadLength)
            val calculatedCrc = calculateCRC16(headerBytes + payloadBytes)
            
            if (receivedCrc != calculatedCrc) {
                throw IllegalArgumentException("CRC mismatch: expected $calculatedCrc, got $receivedCrc")
            }
            
            // Read payload
            val payload = ByteArray(payloadLength)
            buffer.get(payload)
            
            return MeshPacket(
                protocolVersion = protocolVersion,
                messageType = messageType,
                messageUuid = messageUuid,
                hopCount = hopCount,
                ttl = ttl,
                timestamp = timestamp,
                senderUuid = senderUuid,
                payload = payload
            )
        }
        
        /**
         * Create SOS broadcast packet
         */
        fun createSOS(
            senderUuid: ByteArray,
            content: String,
            location: Pair<Double, Double>,
            sosType: String,
            networkKey: ByteArray
        ): MeshPacket {
            val messageUuid = UUID.randomUUID()
            val timestamp = System.currentTimeMillis()
            
            val payloadJson = JSONObject().apply {
                put("type", "SOS")
                put("sender", senderUuid.joinToString("") { "%02x".format(it) })
                put("recipient", "broadcast")
                put("content", content)
                put("location", JSONObject().apply {
                    put("lat", location.first)
                    put("lng", location.second)
                })
                put("priority", 5)
                put("timestamp", timestamp / 1000)
                put("sosType", sosType)
            }.toString()
            
            val packet = MeshPacket(
                messageType = MessageType.SOS,
                messageUuid = messageUuid,
                hopCount = 0,
                ttl = 5,
                timestamp = timestamp,
                senderUuid = senderUuid,
                payload = ByteArray(0)
            )
            
            val encryptedPayload = packet.encryptPayload(payloadJson, networkKey)
            return packet.copy(payload = encryptedPayload)
        }
        
        /**
         * Create direct message packet
         */
        fun createDirectMessage(
            senderUuid: ByteArray,
            recipientUuid: ByteArray,
            content: String,
            networkKey: ByteArray
        ): MeshPacket {
            val messageUuid = UUID.randomUUID()
            val timestamp = System.currentTimeMillis()
            
            val payloadJson = JSONObject().apply {
                put("type", "DIRECT")
                put("sender", senderUuid.joinToString("") { "%02x".format(it) })
                put("recipient", recipientUuid.joinToString("") { "%02x".format(it) })
                put("content", content)
                put("priority", 3)
                put("timestamp", timestamp / 1000)
            }.toString()
            
            val packet = MeshPacket(
                messageType = MessageType.DIRECT,
                messageUuid = messageUuid,
                hopCount = 0,
                ttl = 5,
                timestamp = timestamp,
                senderUuid = senderUuid,
                payload = ByteArray(0)
            )
            
            val encryptedPayload = packet.encryptPayload(payloadJson, networkKey)
            return packet.copy(payload = encryptedPayload)
        }
        
        /**
         * Create ACK packet
         */
        fun createAck(
            senderUuid: ByteArray,
            recipientUuid: ByteArray,
            originalMessageId: UUID,
            networkKey: ByteArray
        ): MeshPacket {
            val messageUuid = UUID.randomUUID()
            val timestamp = System.currentTimeMillis()
            
            val payloadJson = JSONObject().apply {
                put("type", "ACK")
                put("sender", senderUuid.joinToString("") { "%02x".format(it) })
                put("recipient", recipientUuid.joinToString("") { "%02x".format(it) })
                put("originalMessageId", originalMessageId.toString())
                put("timestamp", timestamp / 1000)
            }.toString()
            
            val packet = MeshPacket(
                messageType = MessageType.ACK,
                messageUuid = messageUuid,
                hopCount = 0,
                ttl = 5,
                timestamp = timestamp,
                senderUuid = senderUuid,
                payload = ByteArray(0)
            )
            
            val encryptedPayload = packet.encryptPayload(payloadJson, networkKey)
            return packet.copy(payload = encryptedPayload)
        }
        
        /**
         * CRC-16-CCITT calculation
         */
        private fun calculateCRC16(data: ByteArray): Short {
            var crc = 0xFFFF
            
            for (byte in data) {
                crc = crc xor (byte.toInt() and 0xFF shl 8)
                for (i in 0 until 8) {
                    crc = if (crc and 0x8000 != 0) {
                        crc shl 1 xor 0x1021
                    } else {
                        crc shl 1
                    }
                }
            }
            
            return (crc and 0xFFFF).toShort()
        }
        
        /**
         * Convert UUID to byte array
         */
        private fun uuidToBytes(uuid: UUID): ByteArray {
            val buffer = ByteBuffer.wrap(ByteArray(16))
            buffer.putLong(uuid.mostSignificantBits)
            buffer.putLong(uuid.leastSignificantBits)
            return buffer.array()
        }
        
        /**
         * Convert byte array to UUID
         */
        private fun bytesToUuid(bytes: ByteArray): UUID {
            val buffer = ByteBuffer.wrap(bytes)
            val mostSigBits = buffer.long
            val leastSigBits = buffer.long
            return UUID(mostSigBits, leastSigBits)
        }
    }
    
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        
        other as MeshPacket
        
        if (messageUuid != other.messageUuid) return false
        if (!senderUuid.contentEquals(other.senderUuid)) return false
        
        return true
    }
    
    override fun hashCode(): Int {
        var result = messageUuid.hashCode()
        result = 31 * result + senderUuid.contentHashCode()
        return result
    }
}
