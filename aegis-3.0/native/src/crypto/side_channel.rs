use subtle::ConstantTimeEq;
use rand::RngCore;

/// Constant-time equality check using the `subtle` crate.
/// This prevents timing attacks and is more robust than JS-based solutions.
/// Constant-time comparison using `subtle` crate to prevent timing attacks.
pub fn constant_time_compare(a: &[u8], b: &[u8]) -> bool {
    // Note: Use .into() to convert Choice to bool
    a.ct_eq(b).into()
}

/// Simple blinding helper.
/// Returns (blinded_val, unblinding_mask)
/// Used to mask sensitive data before operations that might leak information via power/timing.
pub fn blind_data(data: &mut [u8]) -> Vec<u8> {
    let mut mask = vec![0u8; data.len()];
    rand::thread_rng().fill_bytes(&mut mask);
    
    for i in 0..data.len() {
        data[i] ^= mask[i];
    }
    
    mask
}

/// Unblinds data previously masked with `blind_data`.
pub fn unblind_data(blinded_data: &mut [u8], mask: &[u8]) {
    if blinded_data.len() != mask.len() {
        return;
    }
    for i in 0..blinded_data.len() {
        blinded_data[i] ^= mask[i];
    }
}
