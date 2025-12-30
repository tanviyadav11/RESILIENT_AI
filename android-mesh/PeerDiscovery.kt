package com.disaster.mesh

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import android.util.Log
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.*

/**
 * Peer Discovery using BLE Advertisement & Scanning
 * 
 * Discovers nearby mesh nodes and maintains neighbor table.
 */
class PeerDiscovery(
    private val context: Context,
    private val deviceUuid: ByteArray,
    private val onPeerDiscovered: (MeshPeer) -> Unit,
    private val onPeerLost: (MeshPeer) -> Unit
) {
    
    companion object {
        private const val TAG = "PeerDiscovery"
        
        // Custom service UUID for mesh network
        val MESH_SERVICE_UUID: UUID = UUID.fromString("0000FE50-0000-1000-8000-00805F9B34FB")
        
        private const val SCAN_INTERVAL_ACTIVE_MS = 2000L // 2 seconds
        private const val SCAN_INTERVAL_IDLE_MS = 10000L // 10 seconds
        private const val PEER_TIMEOUT_MS = 30000L // 30 seconds
        private const val ADVERTISE_INTERVAL_MS = 1000L // 1 Hz
    }
    
    data class MeshPeer(
        val uuid: ByteArray,
        val name: String,
        val rssi: Int,
        val lastSeen: Long,
        val status: NodeStatus,
        val meshVersion: Byte
    ) {
        enum class NodeStatus(val value: Byte) {
            ACTIVE(0x01),
            LOW_BATTERY(0x02),
            HIGH_LOAD(0x03)
        }
        
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is MeshPeer) return false
            return uuid.contentEquals(other.uuid)
        }
        
        override fun hashCode(): Int = uuid.contentHashCode()
    }
    
    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager.adapter
    private val bleScanner: BluetoothLeScanner? = bluetoothAdapter?.bluetoothLeScanner
    private val bleAdvertiser: BluetoothLeAdvertiser? = bluetoothAdapter?.bluetoothLeAdvertiser
    
    // Neighbor table
    private val peers = ConcurrentHashMap<String, MeshPeer>()
    
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var isScanning = false
    private var isAdvertising = false
    
    /**
     * Start peer discovery (scanning + advertising)
     */
    fun start() {
        startScanning()
        startAdvertising()
        startPeerHealthCheck()
        Log.d(TAG, "Peer discovery started")
    }
    
    /**
     * Stop peer discovery
     */
    fun stop() {
        stopScanning()
        stopAdvertising()
        scope.cancel()
        peers.clear()
        Log.d(TAG, "Peer discovery stopped")
    }
    
    /**
     * Start BLE scanning for nearby mesh nodes
     */
    private fun startScanning() {
        if (isScanning || bleScanner == null) return
        
        val scanSettings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
            .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
            .setReportDelay(0)
            .build()
        
        val scanFilter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(MESH_SERVICE_UUID))
            .build()
        
        try {
            bleScanner.startScan(listOf(scanFilter), scanSettings, scanCallback)
            isScanning = true
            Log.d(TAG, "BLE scanning started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for BLE scanning", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start BLE scanning", e)
        }
    }
    
    /**
     * Stop BLE scanning
     */
    private fun stopScanning() {
        if (!isScanning || bleScanner == null) return
        
        try {
            bleScanner.stopScan(scanCallback)
            isScanning = false
            Log.d(TAG, "BLE scanning stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop BLE scanning", e)
        }
    }
    
    /**
     * Scan callback
     */
    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            handleScanResult(result)
        }
        
        override fun onBatchScanResults(results: List<ScanResult>) {
            results.forEach { handleScanResult(it) }
        }
        
        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE scan failed with error code: $errorCode")
            isScanning = false
        }
    }
    
    /**
     * Handle scan result
     */
    private fun handleScanResult(result: ScanResult) {
        val scanRecord = result.scanRecord ?: return
        val serviceData = scanRecord.serviceData[ParcelUuid(MESH_SERVICE_UUID)] ?: return
        
        if (serviceData.size < 8) return
        
        try {
            // Parse advertisement data
            val peerUuid = serviceData.copyOfRange(0, 6)
            val nodeStatus = MeshPeer.NodeStatus.values()
                .find { it.value == serviceData[6] } ?: MeshPeer.NodeStatus.ACTIVE
            val meshVersion = serviceData[7]
            
            val deviceName = result.device?.name ?: "Unknown"
            val rssi = result.rssi
            
            val peer = MeshPeer(
                uuid = peerUuid,
                name = deviceName,
                rssi = rssi,
                lastSeen = System.currentTimeMillis(),
                status = nodeStatus,
                meshVersion = meshVersion
            )
            
            val peerKey = peerUuid.joinToString("") { "%02x".format(it) }
            val isNewPeer = !peers.containsKey(peerKey)
            
            peers[peerKey] = peer
            
            if (isNewPeer) {
                onPeerDiscovered(peer)
                Log.d(TAG, "New peer discovered: $deviceName (RSSI: $rssi)")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing scan result", e)
        }
    }
    
    /**
     * Start BLE advertising
     */
    private fun startAdvertising() {
        if (isAdvertising || bleAdvertiser == null) return
        
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setConnectable(true)
            .setTimeout(0)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .build()
        
        // Prepare advertisement data
        val nodeStatus = MeshPeer.NodeStatus.ACTIVE.value
        val meshVersion: Byte = 0x01
        val serviceData = deviceUuid.copyOf(6) + byteArrayOf(nodeStatus, meshVersion)
        
        val advertiseData = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .addServiceUuid(ParcelUuid(MESH_SERVICE_UUID))
            .addServiceData(ParcelUuid(MESH_SERVICE_UUID), serviceData)
            .build()
        
        val scanResponse = AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .build()
        
        try {
            bleAdvertiser.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback)
            isAdvertising = true
            Log.d(TAG, "BLE advertising started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for BLE advertising", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start BLE advertising", e)
        }
    }
    
    /**
     * Stop BLE advertising
     */
    private fun stopAdvertising() {
        if (!isAdvertising || bleAdvertiser == null) return
        
        try {
            bleAdvertiser.stopAdvertising(advertiseCallback)
            isAdvertising = false
            Log.d(TAG, "BLE advertising stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop BLE advertising", e)
        }
    }
    
    /**
     * Advertise callback
     */
    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
            Log.d(TAG, "BLE advertising started successfully")
        }
        
        override fun onStartFailure(errorCode: Int) {
            Log.e(TAG, "BLE advertising failed with error code: $errorCode")
            isAdvertising = false
        }
    }
    
    /**
     * Start peer health check (remove stale peers)
     */
    private fun startPeerHealthCheck() {
        scope.launch {
            while (true) {
                delay(10000) // Check every 10 seconds
                
                val now = System.currentTimeMillis()
                val stalePeers = peers.values.filter { 
                    now - it.lastSeen > PEER_TIMEOUT_MS 
                }
                
                stalePeers.forEach { peer ->
                    val key = peer.uuid.joinToString("") { "%02x".format(it) }
                    peers.remove(key)
                    onPeerLost(peer)
                    Log.d(TAG, "Peer lost (timeout): ${peer.name}")
                }
            }
        }
    }
    
    /**
     * Get all active peers
     */
    fun getPeers(): List<MeshPeer> {
        return peers.values.toList()
    }
    
    /**
     * Get peer count
     */
    fun getPeerCount(): Int {
        return peers.size
    }
    
    /**
     * Find peer by UUID
     */
    fun findPeer(uuid: ByteArray): MeshPeer? {
        val key = uuid.joinToString("") { "%02x".format(it) }
        return peers[key]
    }
}
