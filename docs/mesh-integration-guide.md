# Bluetooth Mesh Integration Guide

Complete guide for integrating the Bluetooth mesh module into your existing SOS disaster management application.

## Prerequisites

- **Android**: API Level 21+ (Android 5.0+), Bluetooth LE support
- **React/React Native**: Version 16.8+ (Hooks support)
- **Permissions**: Bluetooth, Location (required for BLE scanning)

---

## Step 1: Add Android Permissions

### AndroidManifest.xml

Add the following permissions to your `AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.disaster.app">

    <!-- Bluetooth permissions -->
    <uses-permission android:name="android.permission.BLUETOOTH" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
    
    <!-- BLE permissions (Android 12+) -->
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN"
        android:usesPermissionFlags="neverForLocation" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    
    <!-- Location (required for BLE scanning on Android 6-11) -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    
    <!-- Foreground service -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    
    <!-- Optional: Wake lock for background operation -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- Declare BLE feature -->
    <uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />

    <application>
        <!-- ... your existing application config ... -->
        
        <!-- Bluetooth Mesh Service -->
        <service
            android:name="com.disaster.mesh.BluetoothMeshService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="connectedDevice" />
    </application>
</manifest>
```

---

## Step 2: Add Kotlin Files to Android Project

Copy the following Kotlin files to your Android project:

```
android/
└── app/src/main/java/com/disaster/mesh/
    ├── MeshPacket.kt
    ├── RoutingEngine.kt
    ├── PeerDiscovery.kt
    ├── BluetoothMeshService.kt
    └── MeshNetworkManager.kt
```

### build.gradle Updates

Add coroutines dependency to `android/app/build.gradle`:

```gradle
dependencies {
    // ... existing dependencies ...
    
    // Kotlin Coroutines
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.6.4'
    
    // Crypto (if not already included)
    implementation 'androidx.security:security-crypto:1.1.0-alpha06'
}
```

---

## Step 3: Request Runtime Permissions

Create a permission handler in your app:

### PermissionHandler.kt (Android)

```kotlin
package com.disaster.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class PermissionHandler(private val activity: AppCompatActivity) {
    
    private val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        arrayOf(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
    } else {
        arrayOf(
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
    }
    
    private val requestPermissions =
        activity.registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            val allGranted = permissions.values.all { it }
            if (allGranted) {
                onPermissionsGranted()
            } else {
                onPermissionsDenied()
            }
        }
    
    var onPermissionsGranted: () -> Unit = {}
    var onPermissionsDenied: () -> Unit = {}
    
    fun checkAndRequestPermissions() {
        val allGranted = permissions.all {
            ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED
        }
        
        if (allGranted) {
            onPermissionsGranted()
        } else {
            requestPermissions.launch(permissions)
        }
    }
}
```

---

## Step 4: Initialize Mesh Network Manager

### In Your Application Class or Main Activity

```kotlin
package com.disaster.app

import android.app.Application
import android.util.Log
import com.disaster.mesh.MeshNetworkManager

class DisasterApp : Application() {
    
    companion object {
        lateinit var meshManager: MeshNetworkManager
            private set
    }
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize mesh manager
        meshManager = MeshNetworkManager(
            context = applicationContext,
            // Optional: custom device UUID
            // deviceUuid = getDeviceUuid(),
            // Optional: custom network key
            // networkKey = "YourSecureKey16!".toByteArray()
        )
        
        Log.d("DisasterApp", "Mesh network manager initialized")
    }
}
```

---

## Step 5: Integrate with Citizen Dashboard

### CitizenDashboard.kt (Android) or CitizenDashboard.jsx (React)

#### Option A: Android Native

```kotlin
package com.disaster.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.disaster.mesh.MeshNetworkManager
import kotlinx.android.synthetic.main.activity_citizen_dashboard.*

class CitizenDashboardActivity : AppCompatActivity() {
    
    private lateinit var meshManager: MeshNetworkManager
    private lateinit var permissionHandler: PermissionHandler
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_citizen_dashboard)
        
        meshManager = DisasterApp.meshManager
        permissionHandler = PermissionHandler(this)
        
        // Setup permission callbacks
        permissionHandler.onPermissionsGranted = {
            startMeshNetworking()
        }
        
        permissionHandler.onPermissionsDenied = {
            showPermissionDeniedDialog()
        }
        
        // Setup UI
        setupMeshToggle()
        setupSOSButton()
        setupMessageListeners()
        
        // Request permissions
        permissionHandler.checkAndRequestPermissions()
    }
    
    private fun startMeshNetworking() {
        try {
            meshManager.startMesh()
            updateMeshStatus(true)
            
            // Add listeners
            meshManager.addMessageListener(object : MeshNetworkManager.MessageListener {
                override fun onMessageReceived(message: MeshNetworkManager.MeshMessage) {
                    runOnUiThread {
                        handleIncomingMessage(message)
                    }
                }
                
                override fun onMessageSent(messageId: UUID, success: Boolean) {
                    runOnUiThread {
                        updateMessageStatus(messageId, success)
                    }
                }
                
                override fun onAckReceived(originalMessageId: UUID) {
                    runOnUiThread {
                        markMessageDelivered(originalMessageId)
                    }
                }
            })
            
            meshManager.addPeerListener(object : MeshNetworkManager.PeerListener {
                override fun onPeerDiscovered(peer: PeerDiscovery.MeshPeer) {
                    runOnUiThread {
                        updatePeerCount()
                    }
                }
                
                override fun onPeerLost(peer: PeerDiscovery.MeshPeer) {
                    runOnUiThread {
                        updatePeerCount()
                    }
                }
                
                override fun onPeerConnected(peer: PeerDiscovery.MeshPeer) {}
                override fun onPeerDisconnected(peer: PeerDiscovery.MeshPeer) {}
            })
            
        } catch (e: Exception) {
            Log.e("CitizenDashboard", "Failed to start mesh", e)
            showError("Failed to start mesh networking")
        }
    }
    
    private fun setupSOSButton() {
        sosButton.setOnClickListener {
            sendSOSBroadcast()
        }
    }
    
    private fun sendSOSBroadcast() {
        val location = getCurrentLocation() ?: return
        
        try {
            val messageId = meshManager.sendSOS(
                content = "Emergency SOS - Need immediate assistance!",
                location = Pair(location.latitude, location.longitude),
                sosType = "EMERGENCY"
            )
            
            showSuccess("SOS broadcast sent via mesh network")
        } catch (e: Exception) {
            showError("Failed to send SOS: ${e.message}")
        }
    }
    
    private fun updatePeerCount() {
        val peerCount = meshManager.getPeerCount()
        meshStatusText.text = "$peerCount nearby devices"
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Note: Don't stop mesh here if you want background operation
        // meshManager.stopMesh()
    }
}
```

#### Option B: React/React Native

```jsx
import React, { useState, useEffect } from 'react';
import meshAPI from '../services/MeshAPI';
import MeshPeerList from './mesh/MeshPeerList';
import OfflineChat from './mesh/OfflineChat';
import './CitizenDashboard.css';

const CitizenDashboard = () => {
  const [meshActive, setMeshActive] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [showOfflineChat, setShowOfflineChat] = useState(false);

  useEffect(() => {
    // Start mesh on component mount
    startMesh();

    // Cleanup on unmount
    return () => {
      // Optional: stop mesh (removes if you want background operation)
      // meshAPI.stopMesh();
    };
  }, []);

  const startMesh = async () => {
    try {
      await meshAPI.startMesh();
      setMeshActive(true);
      
      // Load initial peer count
      const peers = await meshAPI.getPeers();
      setPeerCount(peers.length);

      // Listen for peer updates
      meshAPI.on('peerDiscovered', handlePeerDiscovered);
      meshAPI.on('peerLost', handlePeerLost);
      
    } catch (error) {
      console.error('Failed to start mesh:', error);
      alert('Failed to start offline mesh network');
    }
  };

  const handlePeerDiscovered = () => {
    meshAPI.getPeers().then(peers => setPeerCount(peers.length));
  };

  const handlePeerLost = () => {
    meshAPI.getPeers().then(peers => setPeerCount(peers.length));
  };

  const handleSOSClick = async () => {
    // Get current location
    if (!navigator.geolocation) {
      alert('Location not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        try {
          await meshAPI.sendSOS(
            'Emergency SOS - Need immediate assistance!',
            location,
            'EMERGENCY'
          );
          alert('SOS broadcast sent via mesh network!');
        } catch (error) {
          console.error('Failed to send SOS:', error);
          alert('Failed to send SOS');
        }
      },
      (error) => {
        console.error('Location error:', error);
        alert('Failed to get location');
      }
    );
  };

  return (
    <div className="citizen-dashboard">
      {/* Existing dashboard content */}
      
      {/* Mesh Status Indicator */}
      <div className="mesh-status-bar">
        <div className={`mesh-indicator ${meshActive ? 'active' : 'inactive'}`}>
          <span className="indicator-dot"></span>
          <span>Offline Mesh: {meshActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="peer-count">{peerCount} nearby devices</div>
        <button onClick={() => setShowOfflineChat(!showOfflineChat)}>
          Offline Chat
        </button>
      </div>

      {/* SOS Button with Mesh Support */}
      <button className="sos-button" onClick={handleSOSClick}>
        SOS Emergency
      </button>

      {/* Optional: Show offline chat */}
      {showOfflineChat && (
        <div className="offline-chat-modal">
          <OfflineChat meshAPI={meshAPI} />
        </div>
      )}

      {/* Optional: Show peer list */}
      <MeshPeerList meshAPI={meshAPI} />
    </div>
  );
};

export default CitizenDashboard;
```

---

## Step 6: Handle SOS Integration

### Integrate with Existing SOS Submission

When online, submit to server. When offline, use mesh:

```javascript
const submitSOS = async (sosData) => {
  // Try online submission first
  if (navigator.onLine) {
    try {
      await api.post('/sos/submit', sosData);
      return { status: 'online', success: true };
    } catch (error) {
      console.log('Online submission failed, using mesh');
    }
  }

  // Fallback to mesh
  try {
    const messageId = await meshAPI.sendSOS(
      sosData.description,
      { lat: sosData.latitude, lng: sosData.longitude },
      sosData.type
    );

    // Store for later sync
    localStorage.setItem(`sos_pending_${messageId}`, JSON.stringify(sosData));

    return { status: 'mesh', success: true, messageId };
  } catch (error) {
    return { status: 'failed', success: false, error };
  }
};
```

---

## Step 7: Battery Optimization

### Configure Scan Intervals

Optimize battery life by adjusting scan intervals:

```kotlin
// In PeerDiscovery.kt, you can modify scan settings:

private fun startScanning() {
    val scanSettings = ScanSettings.Builder()
        // For aggressive scanning (high battery usage):
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        
        // For balanced mode (recommended):
        // .setScanMode(ScanSettings.SCAN_MODE_BALANCED)
        
        // For battery saving:
        // .setScanMode(ScanSettings.SCAN_MODE_LOW_POWER)
        
        .build()
    
    // ... rest of scanning code
}
```

### Adaptive Scanning

Implement adaptive scanning based on battery level:

```kotlin
fun adjustScanModeByBattery(batteryLevel: Int) {
    val scanMode = when {
        batteryLevel > 50 -> ScanSettings.SCAN_MODE_LOW_LATENCY
        batteryLevel > 20 -> ScanSettings.SCAN_MODE_BALANCED
        else -> ScanSettings.SCAN_MODE_LOW_POWER
    }
    
    // Restart scanning with new mode
    // Implementation details...
}
```

---

## Step 8: Testing

### Test with Multiple Devices

1. **Install on 3+ devices**
2. **Enable mesh on all devices**
3. **Send SOS from Device A**
4. **Verify receipt on Devices B and C**
5. **Check routing logs** for hop counts

### Use Python Test Simulation

Run the test simulation:

```bash
cd python-mesh
python test_mesh.py
```

This simulates a 5-device chain and verifies multi-hop routing.

---

## API Reference

### MeshNetworkManager (Kotlin)

```kotlin
// Start mesh
meshManager.startMesh()

// Stop mesh
meshManager.stopMesh()

// Send SOS
val messageId = meshManager.sendSOS(
    content = "Emergency message",
    location = Pair(28.6139, 77.2090),
    sosType = "MEDICAL"
)

// Send direct message
val messageId = meshManager.sendMessage(
    recipientUuid = peerUuid,
    content = "Hello from mesh"
)

// Get nearby peers
val peers = meshManager.getPeers()

// Get peer count
val count = meshManager.getPeerCount()

// Add listeners
meshManager.addMessageListener(listener)
meshManager.addPeerListener(listener)
```

### MeshAPI (JavaScript/TypeScript)

```javascript
// Start mesh
await meshAPI.startMesh();

// Stop mesh
await meshAPI.stopMesh();

// Send SOS
const messageId = await meshAPI.sendSOS(
  'Emergency message',
  { lat: 28.6139, lng: 77.2090 },
  'MEDICAL'
);

// Send message
const messageId = await meshAPI.sendMessage(peerUuid, 'Hello');

// Get peers
const peers = await meshAPI.getPeers();

// Event listeners
meshAPI.on('messageReceived', (message) => {
  console.log('Received:', message);
});

meshAPI.on('peerDiscovered', (peer) => {
  console.log('New peer:', peer);
});
```

---

## Troubleshooting

### Peers Not Discovered

1. **Check Bluetooth is enabled**
2. **Verify location permission** (required for BLE scanning)
3. **Ensure devices are within range** (~10-50 meters)
4. **Check firewall/security software** isn't blocking Bluetooth

### Messages Not Relaying

1. **Verify TTL is not 0**
2. **Check duplicate cache** isn't too aggressive
3. **Ensure peers are connected** (check peer list)
4. **Verify network key matches** on all devices

### High Battery Drain

1. **Reduce scan frequency** (use BALANCED or LOW_POWER mode)
2. **Increase scan intervals** in adaptive mode
3. **Limit advertise frequency**
4. **Consider disabling mesh** when not needed

---

## Security Considerations

1. **Change default network key** before deployment
2. **Use secure key distribution** (e.g., QR code, NFC)
3. **Implement message signing** for critical SOS messages
4. **Validate timestamps** to prevent replay attacks
5. **Rate limit messages** to prevent DoS

---

## Performance Tuning

### Recommended Settings for Disaster Scenarios

```kotlin
// High reliability, higher battery usage
TTL = 5 hops
Scan Mode = LOW_LATENCY
Advertise Interval = 1 Hz
Duplicate Cache = 500 entries
Store-and-Forward Retries = 20
```

### Recommended Settings for Normal Operation

```kotlin
// Balanced reliability and battery
TTL = 3 hops
Scan Mode = BALANCED
Advertise Interval = 0.5 Hz
Duplicate Cache = 200 entries
Store-and-Forward Retries = 10
```

---

## Next Steps

1. **Test thoroughly** with multiple devices
2. **Customize UI** to match your app design
3. **Integrate with existing backend** for online/offline sync
4. **Add analytics** to track mesh usage
5. **Implement mesh health monitoring**

---

## Support

For issues or questions:
- Check logs in Android Logcat: `adb logcat | grep Mesh`
- Review routing log in UI
- Test with Python simulation first
- Verify permissions are granted
