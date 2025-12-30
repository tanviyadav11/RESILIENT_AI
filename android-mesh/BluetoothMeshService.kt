package com.disaster.mesh

import android.app.*
import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.ParcelUuid
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.*
import kotlinx.coroutines.*
import org.json.JSONObject

/**
 * Background Service for Bluetooth Mesh Network
 * 
 * Runs as a foreground service to maintain mesh connectivity
 * even when the app is in background.
 */
class BluetoothMeshService : Service() {
    
    companion object {
        private const val TAG = "BluetoothMeshService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "mesh_service_channel"
        
        // GATT Service and Characteristic UUIDs
        val MESH_GATT_SERVICE_UUID: UUID = UUID.fromString("0000FE50-0000-1000-8000-00805F9B34FB")
        val MESSAGE_CHARACTERISTIC_UUID: UUID = UUID.fromString("0000FE51-0000-1000-8000-00805F9B34FB")
        
        const val ACTION_START_MESH = "com.disaster.mesh.START_MESH"
        const val ACTION_STOP_MESH = "com.disaster.mesh.STOP_MESH"
    }
    
    private val binder = MeshServiceBinder()
    private var meshNetworkManager: MeshNetworkManager? = null
    
    private val bluetoothManager by lazy {
        getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    }
    
    private var gattServer: BluetoothGattServer? = null
    private val connectedDevices = mutableSetOf<BluetoothDevice>()
    
    inner class MeshServiceBinder : Binder() {
        fun getService(): BluetoothMeshService = this@BluetoothMeshService
    }
    
    override fun onBind(intent: Intent?): IBinder {
        return binder
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        Log.d(TAG, "Bluetooth Mesh Service created")
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_MESH -> {
                startForeground(NOTIFICATION_ID, createNotification("Mesh Active", "Connected peers: 0"))
                startGattServer()
            }
            ACTION_STOP_MESH -> {
                stopMesh()
            }
        }
        
        return START_STICKY
    }
    
    /**
     * Set mesh network manager
     */
    fun setMeshNetworkManager(manager: MeshNetworkManager) {
        this.meshNetworkManager = manager
    }
    
    /**
     * Update notification with peer count
     */
    fun updateNotification(peerCount: Int, status: String = "Mesh Active") {
        val notification = createNotification(status, "Connected peers: $peerCount")
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
    
    /**
     * Start GATT server for receiving messages
     */
    private fun startGattServer() {
        try {
            val gattService = BluetoothGattService(
                MESH_GATT_SERVICE_UUID,
                BluetoothGattService.SERVICE_TYPE_PRIMARY
            )
            
            val messageCharacteristic = BluetoothGattCharacteristic(
                MESSAGE_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE or 
                BluetoothGattCharacteristic.PROPERTY_READ or
                BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_WRITE or 
                BluetoothGattCharacteristic.PERMISSION_READ
            )
            
            gattService.addCharacteristic(messageCharacteristic)
            
            gattServer = bluetoothManager.openGattServer(this, gattServerCallback)
            gattServer?.addService(gattService)
            
            Log.d(TAG, "GATT server started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied for GATT server", e)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start GATT server", e)
        }
    }
    
    /**
     * GATT server callback
     */
    private val gattServerCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(
            device: BluetoothDevice,
            status: Int,
            newState: Int
        ) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    connectedDevices.add(device)
                    Log.d(TAG, "Device connected: ${device.address}")
                    meshNetworkManager?.onPeerConnected(device)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    connectedDevices.remove(device)
                    Log.d(TAG, "Device disconnected: ${device.address}")
                    meshNetworkManager?.onPeerDisconnected(device)
                }
            }
        }
        
        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray
        ) {
            try {
                if (characteristic.uuid == MESSAGE_CHARACTERISTIC_UUID) {
                    // Received mesh packet
                    meshNetworkManager?.onPacketReceived(value)
                    
                    if (responseNeeded) {
                        gattServer?.sendResponse(
                            device,
                            requestId,
                            BluetoothGatt.GATT_SUCCESS,
                            offset,
                            value
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling write request", e)
                if (responseNeeded) {
                    gattServer?.sendResponse(
                        device,
                        requestId,
                        BluetoothGatt.GATT_FAILURE,
                        offset,
                        null
                    )
                }
            }
        }
        
        override fun onCharacteristicReadRequest(
            device: BluetoothDevice,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic
        ) {
            try {
                gattServer?.sendResponse(
                    device,
                    requestId,
                    BluetoothGatt.GATT_SUCCESS,
                    offset,
                    characteristic.value
                )
            } catch (e: Exception) {
                Log.e(TAG, "Error handling read request", e)
            }
        }
    }
    
    /**
     * Send packet to specific device
     */
    fun sendPacketToDevice(device: BluetoothDevice, packet: ByteArray) {
        // This would be implemented using GATT client connection
        // For simplicity, the actual sending is handled by MeshNetworkManager
    }
    
    /**
     * Stop mesh service
     */
    private fun stopMesh() {
        gattServer?.close()
        gattServer = null
        connectedDevices.clear()
        stopForeground(true)
        stopSelf()
        Log.d(TAG, "Mesh service stopped")
    }
    
    /**
     * Create notification channel (Android O+)
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Bluetooth Mesh Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Maintains offline mesh connectivity"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    /**
     * Create notification
     */
    private fun createNotification(title: String, content: String): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopMesh()
        Log.d(TAG, "Bluetooth Mesh Service destroyed")
    }
}
