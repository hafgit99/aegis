use crate::crypto::{pqc_decrypt, aes_decrypt};
use rand::RngWithReuse; // Or just use Rng
use rand::RngCore;

#[test]
fn fuzz_pqc_decrypt() {
    let mut rng = rand::thread_rng();
    let mut garbage = vec![0u8; 2048];
    let mut key = vec![0u8; 32]; // AES key size, but PQC key is larger.
    // Kyber768 secret key is 2400 bytes.
    let mut pqc_key = vec![0u8; 2400];

    for _ in 0..100 {
        rng.fill_bytes(&mut garbage);
        rng.fill_bytes(&mut pqc_key);

        // Should return Err, not panic
        let _result = pqc_decrypt(&garbage, &pqc_key);
    }
}

#[test]
fn fuzz_aes_decrypt() {
    let mut rng = rand::thread_rng();
    let mut garbage = vec![0u8; 1024];
    let mut key = vec![0u8; 32];

    for _ in 0..100 {
        rng.fill_bytes(&mut garbage);
        rng.fill_bytes(&mut key);

        // Should return Err, not panic
        let _result = aes_decrypt(&garbage, &key);
    }
}
