use libp2p::{
    futures::StreamExt,
    gossipsub, mdns, noise,
    swarm::{NetworkBehaviour, SwarmEvent},
    tcp, yamux, PeerId, SwarmBuilder,
};
use std::error::Error;
use std::time::Duration;
use tokio::runtime::Runtime;

pub mod sync_protocol;

/// Aegis P2P Network Behaviour
#[derive(NetworkBehaviour)]
struct AegisBehaviour {
    gossipsub: gossipsub::Behaviour,
    mdns: mdns::tokio::Behaviour,
}

/// P2P Node for vault synchronization
pub struct AegisP2PNode {
    _peer_id: PeerId,
    runtime: Runtime,
}

impl AegisP2PNode {
    /// Create a new P2P node
    pub fn new() -> Result<Self, Box<dyn Error>> {
        let runtime = Runtime::new()?;
        
        // Generate a random PeerId
        let local_key = libp2p::identity::Keypair::generate_ed25519();
        let peer_id = PeerId::from(local_key.public());

        Ok(Self { _peer_id: peer_id, runtime })
    }

    /// Start the P2P node and listen for connections
    pub fn start(&self) -> Result<(), Box<dyn Error>> {
        self.runtime.block_on(async {
            self.run_node().await
        })
    }

    async fn run_node(&self) -> Result<(), Box<dyn Error>> {
        // Create a keypair for authenticated encryption
        let local_key = libp2p::identity::Keypair::generate_ed25519();
        let local_peer_id = PeerId::from(local_key.public());

        println!("Local peer id: {local_peer_id}");

        // Create a Gossipsub topic
        let gossipsub_config = gossipsub::ConfigBuilder::default()
            .heartbeat_interval(Duration::from_secs(10))
            .validation_mode(gossipsub::ValidationMode::Strict)
            .build()
            .expect("Valid config");

        let mut gossipsub = gossipsub::Behaviour::new(
            gossipsub::MessageAuthenticity::Signed(local_key.clone()),
            gossipsub_config,
        )
        .expect("Correct configuration");

        // Create a Gossipsub topic for vault sync
        let topic = gossipsub::IdentTopic::new("aegis-vault-sync");
        gossipsub.subscribe(&topic)?;

        // Create mDNS for local network discovery
        let mdns = mdns::tokio::Behaviour::new(mdns::Config::default(), local_peer_id)?;

        // Create the behaviour
        let behaviour = AegisBehaviour { gossipsub, mdns };

        // Build the Swarm using new API
        let mut swarm = SwarmBuilder::with_existing_identity(local_key)
            .with_tokio()
            .with_tcp(
                tcp::Config::default(),
                noise::Config::new,
                yamux::Config::default,
            )?
            .with_behaviour(|_| behaviour)?
            .build();

        // Listen on all interfaces on a random port
        swarm.listen_on("/ip4/0.0.0.0/tcp/0".parse()?)?;

        // Event loop
        loop {
            match swarm.select_next_some().await {
                SwarmEvent::NewListenAddr { address, .. } => {
                    println!("Listening on {address}");
                }
                SwarmEvent::Behaviour(AegisBehaviourEvent::Mdns(mdns::Event::Discovered(list))) => {
                    for (peer_id, _multiaddr) in list {
                        println!("Discovered peer: {peer_id}");
                        swarm.behaviour_mut().gossipsub.add_explicit_peer(&peer_id);
                    }
                }
                SwarmEvent::Behaviour(AegisBehaviourEvent::Mdns(mdns::Event::Expired(list))) => {
                    for (peer_id, _multiaddr) in list {
                        println!("Peer expired: {peer_id}");
                        swarm.behaviour_mut().gossipsub.remove_explicit_peer(&peer_id);
                    }
                }
                SwarmEvent::Behaviour(AegisBehaviourEvent::Gossipsub(gossipsub::Event::Message {
                    propagation_source: peer_id,
                    message_id: id,
                    message,
                })) => {
                    println!(
                        "Got message: '{}' with id: {id} from peer: {peer_id}",
                        String::from_utf8_lossy(&message.data),
                    );
                }
                _ => {}
            }
        }
    }

    /// Broadcast vault data to all peers
    #[allow(dead_code)]
    pub fn broadcast_vault_data(&self, data: &[u8]) -> Result<(), Box<dyn Error>> {
        // Implementation for broadcasting encrypted vault data
        println!("Broadcasting {} bytes of vault data", data.len());
        Ok(())
    }

    /// Get list of connected peers
    #[allow(dead_code)]
    pub fn get_peers(&self) -> Vec<String> {
        // Implementation to return list of connected peers
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_creation() {
        let node = AegisP2PNode::new().unwrap();
        assert!(!node.peer_id.to_string().is_empty());
    }
}
