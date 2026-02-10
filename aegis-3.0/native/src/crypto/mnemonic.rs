use bip39::Mnemonic;
use rand::Rng;

pub fn generate_mnemonic_24() -> String {
    let mut entropy = [0u8; 32];
    rand::thread_rng().fill(&mut entropy);
    let mnemonic = Mnemonic::from_entropy(&entropy)
        .expect("Failed to create mnemonic");
    mnemonic.to_string()
}

pub fn validate_mnemonic(phrase: &str) -> bool {
    Mnemonic::parse(phrase).is_ok()
}

pub fn mnemonic_to_entropy(phrase: &str) -> Result<Vec<u8>, String> {
    let mnemonic = Mnemonic::parse(phrase)
        .map_err(|e| format!("Invalid mnemonic: {}", e))?;
    Ok(mnemonic.to_entropy().to_vec())
}
