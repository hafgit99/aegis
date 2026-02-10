use std::ops::{Deref, DerefMut};

/// Secure memory buffer that:
/// 1. Performs triple-wipe on drop (random -> zero -> 0xFF -> zero)
/// 2. Provides safe access patterns
/// 3. Locks memory in RAM using memsec (mlock/VirtualLock) to prevent swapping
#[allow(dead_code)]
pub struct SecureBuffer {
    data: Vec<u8>,
}

#[allow(dead_code)]
impl SecureBuffer {
    /// Create a new secure buffer with the given size and lock it in RAM
    pub fn new(size: usize) -> Result<Self, String> {
        let mut data = vec![0u8; size];
        
        // Lock memory to prevent swapping to disk
        unsafe {
            if !memsec::mlock(data.as_mut_ptr(), data.len()) {
                // On some systems (like Linux without root/capabilities), mlock might fail
                // We log it but continue as triple-wipe still provides protection
                eprintln!("[MEMORY] Warning: Failed to lock memory in RAM");
            }
        }

        Ok(Self { data })
    }

    /// Create from existing data (takes ownership and secures it)
    pub fn from_vec(mut data: Vec<u8>) -> Result<Self, String> {
        // Lock existing memory
        unsafe {
            memsec::mlock(data.as_mut_ptr(), data.len());
        }
        Ok(Self { data })
    }

    /// Triple-wipe implementation for secure memory cleaning
    fn triple_wipe(&mut self) {
        use rand::RngCore;
        let mut rng = rand::thread_rng();

        // Pass 1: Random data
        rng.fill_bytes(&mut self.data);
        
        // Pass 2: Zeros
        self.data.fill(0);

        // Pass 3: 0xFF
        self.data.fill(0xFF);

        // Final Pass: Zeros again
        self.data.fill(0);
        
        // Memory barrier to ensure compiler doesn't optimize away the wipes
        std::sync::atomic::compiler_fence(std::sync::atomic::Ordering::SeqCst);
    }

    /// Get the size of the buffer
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Get immutable reference to data
    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }

    /// Get mutable reference to data
    pub fn as_mut_slice(&mut self) -> &mut [u8] {
        &mut self.data
    }
}

impl Drop for SecureBuffer {
    fn drop(&mut self) {
        // Secure wipe before dropping
        self.triple_wipe();
        
        // Unlock memory
        unsafe {
            memsec::munlock(self.data.as_mut_ptr(), self.data.len());
        }
    }
}

impl Deref for SecureBuffer {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        &self.data
    }
}

impl DerefMut for SecureBuffer {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.data
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secure_buffer_creation() {
        let buffer = SecureBuffer::new(32).unwrap();
        assert_eq!(buffer.len(), 32);
    }

    #[test]
    fn test_secure_buffer_from_vec() {
        let data = vec![1, 2, 3, 4, 5];
        let buffer = SecureBuffer::from_vec(data).unwrap();
        assert_eq!(buffer.len(), 5);
        assert_eq!(buffer.as_slice(), &[1, 2, 3, 4, 5]);
    }
}
