"""
Test Simulation for 5-Device Chain Mesh Network

Simulates a 5-device chain (A→B→C→D→E) where not all devices
are in direct range of each other, demonstrating multi-hop routing.
"""

import time
import uuid
from mesh_node import MeshNode
from mesh_protocol import MeshPacket


class SimulatedMeshNetwork:
    """Simulates a mesh network with controlled topology"""
    
    def __init__(self):
        self.nodes = {}
        self.topology = {}  # node -> list of reachable nodes
        self.message_log = []
    
    def add_node(self, name: str, device_uuid: bytes = None) -> MeshNode:
        """Add a node to the simulation"""
        node = MeshNode(
            device_uuid=device_uuid or uuid.uuid4().bytes[:6],
            network_key=b"DisasterMeshNet!",
            port=0  # Using in-memory simulation, no actual sockets
        )
        
        # Override broadcast to use simulated topology
        original_broadcast = node._broadcast_packet
        
        def simulated_broadcast(packet_data):
            # Send to neighbors according to topology
            neighbors = self.topology.get(name, [])
            for neighbor_name in neighbors:
                neighbor = self.nodes.get(neighbor_name)
                if neighbor:
                    # Simulate packet reception
                    neighbor._process_received_packet(packet_data, name)
        
        node._broadcast_packet = simulated_broadcast
        
        # Set message received callback
        def on_message(packet, payload):
            self.message_log.append({
                "node": name,
                "message_id": str(packet.message_uuid),
                "hop_count": packet.hop_count,
                "content": payload.get("content", ""),
                "timestamp": time.time()
            })
            print(f"[{name}] Received message (hop {packet.hop_count}): {payload.get('content', '')}")
        
        node.on_message_received = on_message
        node.is_running = True  # Manually set since we're not starting full node
        
        self.nodes[name] = node
        return node
    
    def set_topology(self, topology: dict):
        """
        Set network topology
        Example: {
            "A": ["B"],
            "B": ["A", "C"],
            "C": ["B", "D"],
            "D": ["C", "E"],
            "E": ["D"]
        }
        """
        self.topology = topology
        print("Topology set:")
        for node, neighbors in topology.items():
            print(f"  {node} -> {neighbors}")
    
    def send_sos_from(self, node_name: str, content: str):
        """Send SOS from a specific node"""
        node = self.nodes.get(node_name)
        if not node:
            print(f"Node {node_name} not found")
            return
        
        packet = MeshPacket.create_sos(
            sender_uuid=node.device_uuid,
            content=content,
            location=(28.6139, 77.2090),
            sos_type="EMERGENCY",
            network_key=node.network_key
        )
        
        print(f"\n[{node_name}] Sending SOS: {content}")
        print(f"Message UUID: {packet.message_uuid}")
        
        # Initiate broadcast
        node._broadcast_packet(packet.to_bytes())
    
    def print_message_log(self):
        """Print message reception log"""
        print("\n" + "="*60)
        print("MESSAGE PROPAGATION LOG")
        print("="*60)
        
        if not self.message_log:
            print("No messages received")
            return
        
        # Group by message ID
        by_message = {}
        for entry in self.message_log:
            msg_id = entry["message_id"]
            if msg_id not in by_message:
                by_message[msg_id] = []
            by_message[msg_id].append(entry)
        
        for msg_id, entries in by_message.items():
            print(f"\nMessage ID: {msg_id}")
            print(f"Content: {entries[0]['content']}")
            print(f"Propagation Path:")
            
            # Sort by hop count
            entries.sort(key=lambda x: x["hop_count"])
            
            path = []
            for entry in entries:
                print(f"  Hop {entry['hop_count']}: Node {entry['node']}")
                path.append(entry['node'])
            
            print(f"  Visual Path: {' → '.join(path)}")
    
    def get_coverage(self) -> dict:
        """Get coverage statistics"""
        total_nodes = len(self.nodes)
        reached_nodes = len(set(entry['node'] for entry in self.message_log))
        
        return {
            "total_nodes": total_nodes,
            "reached_nodes": reached_nodes,
            "coverage_percent": (reached_nodes / total_nodes * 100) if total_nodes > 0 else 0,
            "total_messages": len(self.message_log)
        }


def test_5_device_chain():
    """Test 5-device chain scenario"""
    print("\n" + "="*60)
    print("5-DEVICE CHAIN MESH TEST")
    print("="*60)
    print("\nScenario: Devices A, B, C, D, E in a chain")
    print("Only adjacent devices can communicate directly")
    print("SOS sent from A should reach E via multi-hop routing\n")
    
    # Create simulation
    sim = SimulatedMeshNetwork()
    
    # Add 5 nodes
    sim.add_node("A")
    sim.add_node("B")
    sim.add_node("C")
    sim.add_node("D")
    sim.add_node("E")
    
    # Set chain topology (A-B-C-D-E)
    sim.set_topology({
        "A": ["B"],
        "B": ["A", "C"],
        "C": ["B", "D"],
        "D": ["C", "E"],
        "E": ["D"]
    })
    
    # Send SOS from A
    time.sleep(0.5)
    sim.send_sos_from("A", "Medical emergency at location A!")
    
    # Wait for propagation
    time.sleep(1)
    
    # Print results
    sim.print_message_log()
    
    coverage = sim.get_coverage()
    print(f"\n" + "="*60)
    print("COVERAGE STATISTICS")
    print("="*60)
    print(f"Total Nodes: {coverage['total_nodes']}")
    print(f"Reached Nodes: {coverage['reached_nodes']}")
    print(f"Coverage: {coverage['coverage_percent']:.1f}%")
    print(f"Total Hops: {coverage['total_messages']}")
    
    # Verify all nodes received the message
    if coverage['reached_nodes'] == coverage['total_nodes']:
        print("\n✓ SUCCESS: Message reached all nodes via multi-hop routing!")
    else:
        print("\n✗ FAILURE: Message did not reach all nodes")


def test_mesh_topology():
    """Test more complex mesh topology"""
    print("\n" + "="*60)
    print("COMPLEX MESH TOPOLOGY TEST")
    print("="*60)
    print("""
    Network Topology:
         A
        / \\
       B   C
       |   |
       D   E
        \\ /
         F
    """)
    
    sim = SimulatedMeshNetwork()
    
    # Add nodes
    for node_name in ["A", "B", "C", "D", "E", "F"]:
        sim.add_node(node_name)
    
    # Set mesh topology
    sim.set_topology({
        "A": ["B", "C"],
        "B": ["A", "D"],
        "C": ["A", "E"],
        "D": ["B", "F"],
        "E": ["C", "F"],
        "F": ["D", "E"]
    })
    
    # Send SOS from A
    time.sleep(0.5)
    sim.send_sos_from("A", "Fire emergency reported!")
    
    # Wait for propagation
    time.sleep(1)
    
    # Print results
    sim.print_message_log()
    
    coverage = sim.get_coverage()
    print(f"\n" + "="*60)
    print("COVERAGE STATISTICS")
    print("="*60)
    print(f"Total Nodes: {coverage['total_nodes']}")
    print(f"Reached Nodes: {coverage['reached_nodes']}")
    print(f"Coverage: {coverage['coverage_percent']:.1f}%")
    
    if coverage['reached_nodes'] == coverage['total_nodes']:
        print("\n✓ SUCCESS: Message reached all nodes in mesh!")
    else:
        print("\n✗ FAILURE: Message did not reach all nodes")


def test_duplicate_detection():
    """Test duplicate detection"""
    print("\n" + "="*60)
    print("DUPLICATE DETECTION TEST")
    print("="*60)
    
    sim = SimulatedMeshNetwork()
    
    # Create triangle topology (message loops back)
    sim.add_node("A")
    sim.add_node("B")
    sim.add_node("C")
    
    sim.set_topology({
        "A": ["B", "C"],
        "B": ["A", "C"],
        "C": ["A", "B"]
    })
    
    # Send message
    sim.send_sos_from("A", "Test duplicate detection")
    
    time.sleep(1)
    
    # Each node should receive once only (not in infinite loop)
    sim.print_message_log()
    
    # Count receptions per node
    receptions_per_node = {}
    for entry in sim.message_log:
        node = entry['node']
        receptions_per_node[node] = receptions_per_node.get(node, 0) + 1
    
    print(f"\n" + "="*60)
    print("DUPLICATE DETECTION RESULTS")
    print("="*60)
    for node, count in receptions_per_node.items():
        print(f"Node {node}: {count} reception(s)")
    
    max_receptions = max(receptions_per_node.values()) if receptions_per_node else 0
    if max_receptions == 1:
        print("\n✓ SUCCESS: No duplicates detected (each node received once)")
    else:
        print(f"\n✗ FAILURE: Duplicates detected (max {max_receptions} receptions)")


if __name__ == "__main__":
    print("\nBluetooth Mesh Network Simulation")
    print("Testing multi-hop routing and duplicate detection\n")
    
    # Run test scenarios
    test_5_device_chain()
    print("\n" + "="*60 + "\n")
    
    test_mesh_topology()
    print("\n" + "="*60 + "\n")
    
    test_duplicate_detection()
    
    print("\n" + "="*60)
    print("ALL TESTS COMPLETED")
    print("="*60)
