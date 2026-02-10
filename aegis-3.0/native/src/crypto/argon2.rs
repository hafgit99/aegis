use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2, Params,
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Argon2Error {
    #[error("Key derivation failed")]
    DerivationFailed,
}

/// Argon2id Key Derivation
/// Parameters: m=64MB, t=3, p=4 (OWASP recommended)
pub fn argon2_derive(password: &[u8], salt: &[u8]) -> Result<Vec<u8>, Argon2Error> {
    // Configure Argon2id parameters
    let params = Params::new(
        65536, // m_cost: 64 MB
        3,     // t_cost: 3 iterations
        4,     // p_cost: 4 parallelism
        Some(32), // output length: 32 bytes (256 bits)
    )
    .map_err(|_| Argon2Error::DerivationFailed)?;

    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        params,
    );

    // Create salt string
    let salt_string = SaltString::encode_b64(salt)
        .map_err(|_| Argon2Error::DerivationFailed)?;

    // Derive key
    let password_hash = argon2
        .hash_password(password, &salt_string)
        .map_err(|_| Argon2Error::DerivationFailed)?;

    // Extract hash bytes
    let hash_bytes = password_hash
        .hash
        .ok_or(Argon2Error::DerivationFailed)?
        .as_bytes()
        .to_vec();

    Ok(hash_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_argon2_derivation() {
        let password = b"MySecurePassword123!";
        let salt = b"RandomSalt123456";

        let key1 = argon2_derive(password, salt).unwrap();
        let key2 = argon2_derive(password, salt).unwrap();

        // Same input should produce same output
        assert_eq!(key1, key2);
        assert_eq!(key1.len(), 32); // 256 bits
    }
}
