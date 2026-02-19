use ssh_key::{PrivateKey, LineEnding};
use ssh_key::rand_core::OsRng;
use ssh_key::private::{RsaKeypair, Ed25519Keypair, KeypairData};
use rsa::RsaPrivateKey;
use ed25519_dalek::SigningKey;
use crate::crypto::CryptoError;

pub type Result<T> = std::result::Result<T, CryptoError>;

#[derive(Debug, Clone, Copy)]
pub enum SshKeyType {
    Rsa4096,
    Ed25519,
}

pub struct SshKeyPair {
    pub private_key: String,
    pub public_key: String,
    pub fingerprint: String,
}

pub fn generate_ssh_keypair(key_type: SshKeyType, comment: &str) -> Result<SshKeyPair> {
    match key_type {
        SshKeyType::Rsa4096 => {
            let mut rng = OsRng;
            let priv_key = RsaPrivateKey::new(&mut rng, 4096)
                .map_err(|e| CryptoError::GenericError(format!("RSA generation failed: {}", e)))?;
            
            let keypair = RsaKeypair::try_from(priv_key)
                .map_err(|e| CryptoError::GenericError(format!("RSA keypair conversion failed: {}", e)))?;
            
            let ssh_priv = PrivateKey::new(KeypairData::Rsa(keypair), comment)
                .map_err(|e| CryptoError::GenericError(format!("PrivateKey creation failed: {}", e)))?;
            
            let ssh_priv_openssh = ssh_priv.to_openssh(LineEnding::LF)
                .map_err(|e| CryptoError::GenericError(format!("OpenSSH format conversion failed: {}", e)))?;
            
            let pub_key = ssh_priv.public_key();
            let ssh_pub = pub_key.to_openssh()
                .map_err(|e| CryptoError::GenericError(format!("Public key conversion failed: {}", e)))?;
                
            let fingerprint = pub_key.fingerprint(Default::default()).to_string();

            Ok(SshKeyPair {
                private_key: ssh_priv_openssh.to_string(),
                public_key: ssh_pub,
                fingerprint,
            })
        }
        SshKeyType::Ed25519 => {
            let mut rng = OsRng;
            let signing_key = SigningKey::generate(&mut rng);
            
            let keypair = Ed25519Keypair::from(signing_key);
            
            let ssh_priv = PrivateKey::new(KeypairData::Ed25519(keypair), comment)
                .map_err(|e| CryptoError::GenericError(format!("PrivateKey creation failed: {}", e)))?;
            
            let ssh_priv_openssh = ssh_priv.to_openssh(LineEnding::LF)
                .map_err(|e| CryptoError::GenericError(format!("OpenSSH format conversion failed: {}", e)))?;
            
            let pub_key = ssh_priv.public_key();
            let ssh_pub = pub_key.to_openssh()
                .map_err(|e| CryptoError::GenericError(format!("Public key conversion failed: {}", e)))?;
                
            let fingerprint = pub_key.fingerprint(Default::default()).to_string();

            Ok(SshKeyPair {
                private_key: ssh_priv_openssh.to_string(),
                public_key: ssh_pub,
                fingerprint,
            })
        }
    }
}
