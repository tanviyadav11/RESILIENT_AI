"""
Bluetooth Mesh Protocol Implementation for Python

Provides message packet structure, encryption/decryption,
and serialization for RFCOMM-based mesh networking.
"""

import struct
import hashlib
import json
import time
import uuid
from typing import Dict, Tuple, Optional
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad


class MessageType:
    """Message type constants"""
    SOS = 0x01
    DIRECT = 0x02
    RELAY = 0x03
    ACK = 0x04


class MeshPacket:
    """
    Bluetooth Mesh Packet
    
    Binary packet structure matching the Android implementation.
    """
    
    PROTOCOL_VERSION = 0x01
    HEADER_SIZE = 32
    CRC_SIZE = 2
    
    def __init__(
        self,
        message_type: int,
        message_uuid: uuid.UUID,
        hop_count: int = 0,
        ttl: int = 5,
        timestamp: int = None,
        sender_uuid: bytes = None,
        payload: bytes = b''
    ):
        self.protocol_version = self.PROTOCOL_VERSION
        self.message_type = message_type
        self.message_uuid = message_uuid
        self.hop_count = hop_count
        self.ttl = ttl
        self.timestamp = timestamp or int(time.time())
        self.sender_uuid = sender_uuid or b'\x00' * 6
        self.payload = payload
    
    def to_bytes(self) -> bytes:
        """Serialize packet to binary format"""
        # Build header
        header = struct.pack(
            '>BB16sBBI6sH',
            self.protocol_version,
            self.message_type,
            self.message_uuid.bytes,
            self.hop_count,
            self.ttl,
            self.timestamp,
            self.sender_uuid[:6],
            len(self.payload)
        )
        
        # Calculate CRC
        crc = self._calculate_crc16(header + self.payload)
        crc_bytes = struct.pack('>H', crc)
        
        return header + crc_bytes + self.payload
    
    @classmethod
    def from_bytes(cls, data: bytes) -> 'MeshPacket':
        """Deserialize packet from binary data"""
        if len(data) < cls.HEADER_SIZE + cls.CRC_SIZE:
            raise ValueError("Packet too small")
        
        # Unpack header
        header = data[:cls.HEADER_SIZE]
        (
            protocol_version,
            message_type,
            message_uuid_bytes,
            hop_count,
            ttl,
            timestamp,
            sender_uuid,
            payload_length
        ) = struct.unpack('>BB16sBBI6sH', header)
        
        # Verify CRC
        crc_offset = cls.HEADER_SIZE
        received_crc = struct.unpack('>H', data[crc_offset:crc_offset + 2])[0]
        payload = data[crc_offset + 2:crc_offset + 2 + payload_length]
        calculated_crc = cls._calculate_crc16(header + payload)
        
        if received_crc != calculated_crc:
            raise ValueError(f"CRC mismatch: expected {calculated_crc}, got {received_crc}")
        
        # Create packet
        message_uuid = uuid.UUID(bytes=message_uuid_bytes)
        
        return cls(
            message_type=message_type,
            message_uuid=message_uuid,
            hop_count=hop_count,
            ttl=ttl,
            timestamp=timestamp,
            sender_uuid=sender_uuid,
            payload=payload
        )
    
    def encrypt_payload(self, json_payload: Dict, network_key: bytes) -> bytes:
        """Encrypt payload using AES-128-CBC"""
        # Use first 16 bytes of message UUID as IV
        iv = self.message_uuid.bytes[:16]
        
        # Ensure network key is 16 bytes
        key = network_key[:16].ljust(16, b'\x00')
        
        # Create cipher
        cipher = AES.new(key, AES.MODE_CBC, iv)
        
        # Encrypt
        plaintext = json.dumps(json_payload).encode('utf-8')
        ciphertext = cipher.encrypt(pad(plaintext, AES.block_size))
        
        return ciphertext
    
    def decrypt_payload(self, network_key: bytes) -> Dict:
        """Decrypt payload"""
        # Use first 16 bytes of message UUID as IV
        iv = self.message_uuid.bytes[:16]
        
        # Ensure network key is 16 bytes
        key = network_key[:16].ljust(16, b'\x00')
        
        # Create cipher
        cipher = AES.new(key, AES.MODE_CBC, iv)
        
        # Decrypt
        plaintext = unpad(cipher.decrypt(self.payload), AES.block_size)
        return json.loads(plaintext.decode('utf-8'))
    
    def calculate_hash(self) -> str:
        """Calculate message hash for duplicate detection"""
        data = self.message_uuid.hex + self.sender_uuid.hex()
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    @staticmethod
    def _calculate_crc16(data: bytes) -> int:
        """CRC-16-CCITT calculation"""
        crc = 0xFFFF
        
        for byte in data:
            crc ^= (byte << 8)
            for _ in range(8):
                if crc & 0x8000:
                    crc = (crc << 1) ^ 0x1021
                else:
                    crc <<= 1
                crc &= 0xFFFF
        
        return crc
    
    @classmethod
    def create_sos(
        cls,
        sender_uuid: bytes,
        content: str,
        location: Tuple[float, float],
        sos_type: str,
        network_key: bytes
    ) -> 'MeshPacket':
        """Create SOS broadcast packet"""
        message_uuid = uuid.uuid4()
        timestamp = int(time.time())
        
        payload_json = {
            "type": "SOS",
            "sender": sender_uuid.hex(),
            "recipient": "broadcast",
            "content": content,
            "location": {
                "lat": location[0],
                "lng": location[1]
            },
            "priority": 5,
            "timestamp": timestamp,
            "sosType": sos_type
        }
        
        packet = cls(
            message_type=MessageType.SOS,
            message_uuid=message_uuid,
            hop_count=0,
            ttl=5,
            timestamp=timestamp,
            sender_uuid=sender_uuid
        )
        
        packet.payload = packet.encrypt_payload(payload_json, network_key)
        return packet
    
    @classmethod
    def create_direct_message(
        cls,
        sender_uuid: bytes,
        recipient_uuid: bytes,
        content: str,
        network_key: bytes
    ) -> 'MeshPacket':
        """Create direct message packet"""
        message_uuid = uuid.uuid4()
        timestamp = int(time.time())
        
        payload_json = {
            "type": "DIRECT",
            "sender": sender_uuid.hex(),
            "recipient": recipient_uuid.hex(),
            "content": content,
            "priority": 3,
            "timestamp": timestamp
        }
        
        packet = cls(
            message_type=MessageType.DIRECT,
            message_uuid=message_uuid,
            hop_count=0,
            ttl=5,
            timestamp=timestamp,
            sender_uuid=sender_uuid
        )
        
        packet.payload = packet.encrypt_payload(payload_json, network_key)
        return packet
    
    @classmethod
    def create_ack(
        cls,
        sender_uuid: bytes,
        recipient_uuid: bytes,
        original_message_id: uuid.UUID,
        network_key: bytes
    ) -> 'MeshPacket':
        """Create ACK packet"""
        message_uuid = uuid.uuid4()
        timestamp = int(time.time())
        
        payload_json = {
            "type": "ACK",
            "sender": sender_uuid.hex(),
            "recipient": recipient_uuid.hex(),
            "originalMessageId": str(original_message_id),
            "timestamp": timestamp
        }
        
        packet = cls(
            message_type=MessageType.ACK,
            message_uuid=message_uuid,
            hop_count=0,
            ttl=5,
            timestamp=timestamp,
            sender_uuid=sender_uuid
        )
        
        packet.payload = packet.encrypt_payload(payload_json, network_key)
        return packet
    
    def __repr__(self) -> str:
        return (
            f"MeshPacket(type={self.message_type}, uuid={self.message_uuid}, "
            f"hop={self.hop_count}, ttl={self.ttl})"
        )
