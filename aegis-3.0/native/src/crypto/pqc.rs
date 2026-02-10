use pqcrypto_mlkem::mlkem768::*;
use pqcrypto_traits::kem::{PublicKey as _, SecretKey as _, Ciphertext as _, SharedSecret as _};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PQCError {
    #[error("PQC encryption failed")]
    EncryptionFailed,
    #[error("PQC decryption failed")]
    DecryptionFailed,
    #[error("Invalid key format")]
    InvalidKey,
}

/// Post-Quantum Hybrid Encryption (ML-KEM-768 + AES-256-GCM)
/// 
/// This implements a hybrid encryption scheme:
/// 1. Generate random AES-256 key
/// 2. Encrypt data with AES-256-GCM (classical)
/// 3. Encapsulate AES key with ML-KEM-768 (post-quantum)
/// 4. Return: encapsulated_key || nonce || ciphertext
pub fn pqc_encrypt(plaintext: &[u8], public_key: &[u8]) -> Result<Vec<u8>, PQCError> {
    // Parse ML-KEM public key
    let pk = PublicKey::from_bytes(public_key)
        .map_err(|_| PQCError::InvalidKey)?;

    // Step 1: Encapsulate shared secret with ML-KEM
    let (shared_secret, ciphertext_kyber) = encapsulate(&pk);
    
    // Step 2: Use ML-KEM shared secret as AES-256 key
    let aes_key = &shared_secret.as_bytes()[..32];
    let cipher = Aes256Gcm::new_from_slice(aes_key)
        .map_err(|_| PQCError::EncryptionFailed)?;

    // Step 3: Encrypt with AES-256-GCM
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| PQCError::EncryptionFailed)?;

    // Step 4: Combine all parts
    // Format: mlkem_ciphertext (1088 bytes) || nonce (12 bytes) || aes_ciphertext
    let mut result = Vec::new();
    result.extend_from_slice(ciphertext_kyber.as_bytes());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(result)
}

/// Post-Quantum Hybrid Decryption
pub fn pqc_decrypt(data: &[u8], secret_key: &[u8]) -> Result<Vec<u8>, PQCError> {
    // Parse ML-KEM secret key
    let sk = SecretKey::from_bytes(secret_key)
        .map_err(|_| PQCError::InvalidKey)?;

    // Expected minimum length: 1088 (kyber) + 12 (nonce) + 16 (min AES tag)
    if data.len() < 1088 + 12 + 16 {
        return Err(PQCError::DecryptionFailed);
    }

    // Extract parts
    let (kyber_ciphertext_bytes, rest) = data.split_at(1088);
    let (nonce_bytes, aes_ciphertext) = rest.split_at(12);

    // Step 1: Decapsulate to get AES key
    let mlkem_ciphertext = Ciphertext::from_bytes(kyber_ciphertext_bytes)
        .map_err(|_| PQCError::InvalidKey)?;
    let shared_secret = decapsulate(&mlkem_ciphertext, &sk);

    // Use first 32 bytes of shared secret as AES key
    let aes_key = &shared_secret.as_bytes()[..32];

    // Step 2: Decrypt with AES-256-GCM
    let cipher = Aes256Gcm::new_from_slice(aes_key)
        .map_err(|_| PQCError::DecryptionFailed)?;

    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, aes_ciphertext)
        .map_err(|_| PQCError::DecryptionFailed)?;

    Ok(plaintext)
}

/// Generate ML-KEM-768 keypair
pub fn generate_keypair() -> (Vec<u8>, Vec<u8>) {
    let (pk, sk) = keypair();
    (pk.as_bytes().to_vec(), sk.as_bytes().to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pqc_encryption_decryption() {
        let (public_key, secret_key) = generate_keypair();
        let plaintext = b"Quantum-resistant encryption test!";

        let ciphertext = pqc_encrypt(plaintext, &public_key).unwrap();
        let decrypted = pqc_decrypt(&ciphertext, &secret_key).unwrap();

        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_encryption_empty_payload() {
        let (public_key, secret_key) = generate_keypair();
        let plaintext = b"";

        let ciphertext = pqc_encrypt(plaintext, &public_key).unwrap();
        let decrypted = pqc_decrypt(&ciphertext, &secret_key).unwrap();

        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_encryption_large_payload() {
        let (public_key, secret_key) = generate_keypair();
        let plaintext = vec![0u8; 1024 * 1024]; // 1MB payload

        let ciphertext = pqc_encrypt(&plaintext, &public_key).unwrap();
        let decrypted = pqc_decrypt(&ciphertext, &secret_key).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_invalid_public_key() {
        let (public_key, _) = generate_keypair();
        let mut corrupted_key = public_key.clone();
        corrupted_key[0] ^= 0xFF; // Corrupt first byte

        let plaintext = b"Test";
        let result = pqc_encrypt(plaintext, &corrupted_key);
        
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_secret_key() {
        let (public_key, secret_key) = generate_keypair();
        let mut corrupted_key = secret_key.clone();
        corrupted_key[0] ^= 0xFF; // Corrupt first byte

        let plaintext = b"Test";
        let ciphertext = pqc_encrypt(plaintext, &public_key).unwrap();
        let result = pqc_decrypt(&ciphertext, &corrupted_key);
        
        assert!(result.is_err());
    }

    #[test]
    fn test_corrupted_ciphertext() {
        let (public_key, secret_key) = generate_keypair();
        let plaintext = b"Sensitive Data";

        let mut ciphertext = pqc_encrypt(plaintext, &public_key).unwrap();
        
        // Corrupt a byte in the encrypted part (last byte)
        let len = ciphertext.len();
        ciphertext[len - 1] ^= 0xFF;

        let result = pqc_decrypt(&ciphertext, &secret_key);
        assert!(result.is_err());
    }
}
