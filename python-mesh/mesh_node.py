"""
Bluetooth Mesh Node Implementation

RFCOMM-based mesh node for Python, supporting peer discovery,
message routing, and multi-hop forwarding.
"""

import bluetooth
import threading
import time
import uuid
from typing import Dict, List, Callable, Optional
from collections import OrderedDict
from mesh_protocol import MeshPacket, MessageType


class MeshNode:
    """
    Bluetooth Mesh Network Node
    
    Implements mesh routing using RFCOMM sockets.
    """
    
    # Mesh service UUID
    MESH_SERVICE_UUID = "0000FE50-0000-1000-8000-00805F9B34FB"
    MESH_SERVICE_NAME = "DisasterMeshNode"
    
    def __init__(
        self,
        device_uuid: bytes = None,
        network_key: bytes = b"DisasterMeshNet!",
        port: int = 1
    ):
        self.device_uuid = device_uuid or uuid.uuid4().bytes[:6]
        self.network_key = network_key
        self.port = port
        
        # Server socket
        self.server_socket = None
        
        # Connected peers: address -> socket
        self.peer_sockets: Dict[str, bluetooth.BluetoothSocket] = {}
        
        # Duplicate detection cache (LRU)
        self.duplicate_cache: OrderedDict[str, float] = OrderedDict()
        self.cache_max_size = 500
        self.cache_ttl = 300  # 5 minutes
        
        # Store-and-forward queue
        self.store_and_forward: Dict[uuid.UUID, tuple] = {}  # msg_uuid -> (packet, retry_count)
        
        # Message callbacks
        self.on_message_received: Optional[Callable] = None
        self.on_peer_connected: Optional[Callable] = None
        self.on_peer_disconnected: Optional[Callable] = None
        
        # Running state
        self.is_running = False
        self.threads = []
    
    def start(self):
        """Start mesh node"""
        if self.is_running:
            print("Mesh node already running")
            return
        
        self.is_running = True
        
        # Start server thread
        server_thread = threading.Thread(target=self._run_server, daemon=True)
        server_thread.start()
        self.threads.append(server_thread)
        
        # Start store-and-forward thread
        retry_thread = threading.Thread(target=self._store_and_forward_loop, daemon=True)
        retry_thread.start()
        self.threads.append(retry_thread)
        
        # Start cache cleanup thread
        cleanup_thread = threading.Thread(target=self._cache_cleanup_loop, daemon=True)
        cleanup_thread.start()
        self.threads.append(cleanup_thread)
        
        print(f"Mesh node started on port {self.port}")
        print(f"Device UUID: {self.device_uuid.hex()}")
    
    def stop(self):
        """Stop mesh node"""
        self.is_running = False
        
        # Close all peer connections
        for sock in list(self.peer_sockets.values()):
            try:
                sock.close()
            except:
                pass
        self.peer_sockets.clear()
        
        # Close server socket
        if self.server_socket:
            try:
                self.server_socket.close()
            except:
                pass
        
        print("Mesh node stopped")
    
    def _run_server(self):
        """Run RFCOMM server to accept incoming connections"""
        try:
            self.server_socket = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
            self.server_socket.bind(("", self.port))
            self.server_socket.listen(5)
            
            # Advertise service
            bluetooth.advertise_service(
                self.server_socket,
                self.MESH_SERVICE_NAME,
                service_id=self.MESH_SERVICE_UUID,
                service_classes=[self.MESH_SERVICE_UUID, bluetooth.SERIAL_PORT_CLASS],
                profiles=[bluetooth.SERIAL_PORT_PROFILE]
            )
            
            print(f"Listening for connections on port {self.port}")
            
            while self.is_running:
                try:
                    client_sock, client_info = self.server_socket.accept()
                    print(f"Accepted connection from {client_info}")
                    
                    # Handle client in separate thread
                    client_thread = threading.Thread(
                        target=self._handle_client,
                        args=(client_sock, client_info),
                        daemon=True
                    )
                    client_thread.start()
                    self.threads.append(client_thread)
                    
                except Exception as e:
                    if self.is_running:
                        print(f"Error accepting connection: {e}")
        
        except Exception as e:
            print(f"Server error: {e}")
    
    def _handle_client(self, sock: bluetooth.BluetoothSocket, address: tuple):
        """Handle connected client"""
        addr = address[0]
        self.peer_sockets[addr] = sock
        
        if self.on_peer_connected:
            self.on_peer_connected(addr)
        
        try:
            while self.is_running:
                # Receive packet (first 4 bytes = length)
                length_data = sock.recv(4)
                if not length_data:
                    break
                
                packet_length = int.from_bytes(length_data, 'big')
                
                # Receive full packet
                packet_data = b''
                while len(packet_data) < packet_length:
                    chunk = sock.recv(min(1024, packet_length - len(packet_data)))
                    if not chunk:
                        break
                    packet_data += chunk
                
                if len(packet_data) == packet_length:
                    self._process_received_packet(packet_data, addr)
        
        except Exception as e:
            print(f"Error handling client {addr}: {e}")
        
        finally:
            sock.close()
            if addr in self.peer_sockets:
                del self.peer_sockets[addr]
            
            if self.on_peer_disconnected:
                self.on_peer_disconnected(addr)
            
            print(f"Connection closed: {addr}")
    
    def connect_to_peer(self, address: str) -> bool:
        """Connect to a peer node"""
        if address in self.peer_sockets:
            print(f"Already connected to {address}")
            return True
        
        try:
            # Find mesh service on peer
            services = bluetooth.find_service(uuid=self.MESH_SERVICE_UUID, address=address)
            
            if not services:
                print(f"Mesh service not found on {address}")
                return False
            
            service = services[0]
            port = service["port"]
            
            # Connect
            sock = bluetooth.BluetoothSocket(bluetooth.RFCOMM)
            sock.connect((address, port))
            
            self.peer_sockets[address] = sock
            
            if self.on_peer_connected:
                self.on_peer_connected(address)
            
            # Start receive thread
            receive_thread = threading.Thread(
                target=self._handle_client,
                args=(sock, (address, port)),
                daemon=True
            )
            receive_thread.start()
            self.threads.append(receive_thread)
            
            print(f"Connected to peer: {address}")
            return True
        
        except Exception as e:
            print(f"Failed to connect to {address}: {e}")
            return False
    
    def send_message(self, packet: MeshPacket):
        """Send message packet to all peers"""
        packet_data = packet.to_bytes()
        
        if not self.peer_sockets:
            # No peers, add to store-and-forward
            self.store_and_forward[packet.message_uuid] = (packet, 0)
            print("No peers available, message queued for store-and-forward")
            return
        
        self._broadcast_packet(packet_data)
    
    def send_sos(self, content: str, location: tuple, sos_type: str):
        """Send SOS broadcast"""
        packet = MeshPacket.create_sos(
            sender_uuid=self.device_uuid,
            content=content,
            location=location,
            sos_type=sos_type,
            network_key=self.network_key
        )
        
        self.send_message(packet)
        print(f"SOS broadcast sent: {packet.message_uuid}")
    
    def send_direct(self, recipient_uuid: bytes, content: str):
        """Send direct message"""
        packet = MeshPacket.create_direct_message(
            sender_uuid=self.device_uuid,
            recipient_uuid=recipient_uuid,
            content=content,
            network_key=self.network_key
        )
        
        self.send_message(packet)
        print(f"Direct message sent: {packet.message_uuid}")
    
    def _broadcast_packet(self, packet_data: bytes):
        """Broadcast packet to all connected peers"""
        # Prepend length
        length_prefix = len(packet_data).to_bytes(4, 'big')
        full_data = length_prefix + packet_data
        
        failed_peers = []
        
        for addr, sock in self.peer_sockets.items():
            try:
                sock.send(full_data)
            except Exception as e:
                print(f"Failed to send to {addr}: {e}")
                failed_peers.append(addr)
        
        # Clean up failed connections
        for addr in failed_peers:
            if addr in self.peer_sockets:
                try:
                    self.peer_sockets[addr].close()
                except:
                    pass
                del self.peer_sockets[addr]
    
    def _process_received_packet(self, packet_data: bytes, source: str):
        """Process received packet"""
        try:
            packet = MeshPacket.from_bytes(packet_data)
            
            # Check duplicate
            if self._is_duplicate(packet):
                print(f"Duplicate packet: {packet.message_uuid}")
                return
            
            # Validate timestamp
            if not self._is_timestamp_valid(packet.timestamp):
                print(f"Invalid timestamp: {packet.timestamp}")
                return
            
            # Decrypt payload
            payload_json = packet.decrypt_payload(self.network_key)
            
            # Mark as seen
            self._mark_as_seen(packet)
            
            # Check if for me
            recipient = payload_json.get("recipient", "")
            is_for_me = recipient == self.device_uuid.hex()
            is_broadcast = recipient == "broadcast"
            
            if is_for_me or is_broadcast:
                # Deliver to application
                if self.on_message_received:
                    self.on_message_received(packet, payload_json)
                
                print(f"Message received from {source}: {payload_json.get('content', '')}")
                
                # Send ACK if direct message
                if packet.message_type == MessageType.DIRECT and is_for_me:
                    self._send_ack(packet)
            
            # Relay if needed
            if self._should_relay(packet, is_broadcast, is_for_me):
                self._relay_packet(packet, payload_json)
        
        except Exception as e:
            print(f"Error processing packet: {e}")
    
    def _is_duplicate(self, packet: MeshPacket) -> bool:
        """Check if packet is duplicate"""
        msg_hash = packet.calculate_hash()
        return msg_hash in self.duplicate_cache
    
    def _mark_as_seen(self, packet: MeshPacket):
        """Mark packet as seen"""
        msg_hash = packet.calculate_hash()
        self.duplicate_cache[msg_hash] = time.time()
        
        # Limit cache size (LRU)
        if len(self.duplicate_cache) > self.cache_max_size:
            self.duplicate_cache.popitem(last=False)
    
    def _is_timestamp_valid(self, timestamp: int) -> bool:
        """Validate timestamp"""
        current_time = int(time.time())
        diff = abs(current_time - timestamp)
        return diff <= 300  # ±5 minutes
    
    def _should_relay(self, packet: MeshPacket, is_broadcast: bool, is_for_me: bool) -> bool:
        """Determine if packet should be relayed"""
        if packet.ttl <= 0:
            return False
        
        if packet.message_type == MessageType.SOS:
            return True
        
        if is_broadcast:
            return True
        
        if not is_for_me and packet.message_type == MessageType.DIRECT:
            return True
        
        return False
    
    def _relay_packet(self, packet: MeshPacket, payload_json: dict):
        """Relay packet to other peers"""
        # Create relay packet
        relay_packet = MeshPacket(
            message_type=MessageType.RELAY,
            message_uuid=packet.message_uuid,
            hop_count=packet.hop_count + 1,
            ttl=packet.ttl - 1,
            timestamp=packet.timestamp,
            sender_uuid=packet.sender_uuid
        )
        
        relay_packet.payload = relay_packet.encrypt_payload(payload_json, self.network_key)
        
        print(f"Relaying packet: {relay_packet.message_uuid}, hop={relay_packet.hop_count}")
        
        self._broadcast_packet(relay_packet.to_bytes())
    
    def _send_ack(self, original_packet: MeshPacket):
        """Send ACK for received message"""
        ack_packet = MeshPacket.create_ack(
            sender_uuid=self.device_uuid,
            recipient_uuid=original_packet.sender_uuid,
            original_message_id=original_packet.message_uuid,
            network_key=self.network_key
        )
        
        self._broadcast_packet(ack_packet.to_bytes())
        print(f"Sent ACK for: {original_packet.message_uuid}")
    
    def _store_and_forward_loop(self):
        """Retry sending queued messages"""
        while self.is_running:
            time.sleep(30)  # Retry every 30 seconds
            
            expired = []
            
            for msg_uuid, (packet, retry_count) in list(self.store_and_forward.items()):
                # Check expiration
                age = time.time() - packet.timestamp
                if age > 3600 or retry_count >= 20:  # 1 hour or 20 retries
                    expired.append(msg_uuid)
                    continue
                
                # Retry if peers available
                if self.peer_sockets:
                    try:
                        self._broadcast_packet(packet.to_bytes())
                        self.store_and_forward[msg_uuid] = (packet, retry_count + 1)
                        print(f"Store-and-forward retry {retry_count + 1}: {msg_uuid}")
                    except Exception as e:
                        print(f"Store-and-forward retry failed: {e}")
            
            # Remove expired
            for msg_uuid in expired:
                del self.store_and_forward[msg_uuid]
                print(f"Removed expired message: {msg_uuid}")
    
    def _cache_cleanup_loop(self):
        """Clean up expired cache entries"""
        while self.is_running:
            time.sleep(60)  # Run every minute
            
            now = time.time()
            expired_keys = [
                key for key, timestamp in self.duplicate_cache.items()
                if now - timestamp > self.cache_ttl
            ]
            
            for key in expired_keys:
                del self.duplicate_cache[key]
            
            if expired_keys:
                print(f"Cleaned {len(expired_keys)} expired cache entries")
    
    def get_statistics(self) -> dict:
        """Get mesh statistics"""
        return {
            "is_running": self.is_running,
            "peer_count": len(self.peer_sockets),
            "cache_size": len(self.duplicate_cache),
            "queued_messages": len(self.store_and_forward),
            "device_uuid": self.device_uuid.hex()
        }
