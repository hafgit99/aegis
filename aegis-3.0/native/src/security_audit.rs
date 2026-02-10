/// Security Audit Logging Module
///
/// Tamper-evident logging for security events with integrity verification.
/// Logs are signed and chained to prevent tampering.

use std::path::Path;
use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use sha2::{Sha256, Digest};
use serde::{Serialize, Deserialize};

/// Audit event types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditEventType {
    // Authentication events
    LoginSuccess,
    LoginFailed,
    Logout,
    AccountLocked,
    AccountUnlocked,

    // Vault operations
    VaultCreated,
    VaultOpened,
    VaultExported,
    VaultImported,
    VaultEncrypted,

    // Password operations
    PasswordCreated,
    PasswordUpdated,
    PasswordDeleted,
    PasswordViewed,
    PasswordCopied,

    // Security events
    BiometricAuth,
    Fido2Auth,
    DuressPasswordUsed,
    BreachDetected,

    // System events
    DatabaseOpened,
    DatabaseClosed,
    SyncStarted,
    SyncCompleted,
    SyncFailed,
}

/// Severity levels for audit events
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum AuditSeverity {
    Info,
    Warning,
    Critical,
}

// Implement Display for AuditSeverity
impl std::fmt::Display for AuditSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditSeverity::Info => write!(f, "Info"),
            AuditSeverity::Warning => write!(f, "Warning"),
            AuditSeverity::Critical => write!(f, "Critical"),
        }
    }
}

/// Audit log entry with cryptographic integrity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: i64,
    pub event_type: AuditEventType,
    pub severity: AuditSeverity,
    pub user_id: Option<String>,
    pub device_id: Option<String>,
    pub ip_address: Option<String>,
    pub details: String,
    pub entry_hash: String,
    pub previous_hash: String,
    pub signature: String,
}

/// Audit logger with tamper-evident logging
pub struct AuditLogger {
    log_path: String,
    device_id: String,
    chain_hash: Mutex<String>,
}

impl AuditLogger {
    /// Create a new audit logger
    pub fn new<P: AsRef<Path>>(log_path: P, device_id: String) -> Result<Self, std::io::Error> {
        // Initialize with genesis hash if log doesn't exist
        let initial_hash = if log_path.as_ref().exists() {
            // Read last entry's hash
            Self::read_last_hash(&log_path)?
        } else {
            // Genesis hash
            "0000000000000000000000000000000000000000000000000000000000000000".to_string()
        };

        Ok(Self {
            log_path: log_path.as_ref().to_string_lossy().to_string(),
            device_id,
            chain_hash: Mutex::new(initial_hash),
        })
    }

    /// Log a security event with integrity protection
    pub fn log_event(
        &self,
        event_type: AuditEventType,
        severity: AuditSeverity,
        user_id: Option<String>,
        ip_address: Option<String>,
        details: String,
    ) -> Result<(), std::io::Error> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Get current chain hash
        let previous_hash = self.chain_hash.lock().unwrap().clone();

        // Create entry content
        let entry_content = format!(
            "{}|{:?}|{}|{:?}|{}|{}|{}",
            timestamp,
            event_type,
            severity,
            user_id.as_deref().unwrap_or(&String::new()),
            self.device_id,
            ip_address.as_deref().unwrap_or(&String::new()),
            details
        );

        // Calculate entry hash (includes previous hash for chaining)
        let hash_input = format!("{}|{}", previous_hash, entry_content);
        let entry_hash = Self::compute_hash(&hash_input);

        // Sign the entry (simplified - in production use real signatures)
        let signature = Self::sign_entry(&entry_hash, &self.device_id);

        let entry = AuditEntry {
            timestamp,
            event_type,
            severity,
            user_id,
            device_id: Some(self.device_id.clone()),
            ip_address,
            details,
            entry_hash: entry_hash.clone(),
            previous_hash: previous_hash.clone(),
            signature,
        };

        // Write to log file
        self.write_entry(&entry)?;

        // Update chain hash
        *self.chain_hash.lock().unwrap() = entry_hash;

        Ok(())
    }

    /// Write entry to log file (append-only)
    fn write_entry(&self, entry: &AuditEntry) -> Result<(), std::io::Error> {
        let serialized = serde_json::to_string(entry)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .append(true)
            .open(&self.log_path)?;

        writeln!(file, "{}", serialized)?;
        file.sync_all()?;

        Ok(())
    }

    /// Read the last hash from the log file for chain continuity
    fn read_last_hash<P: AsRef<Path>>(log_path: P) -> Result<String, std::io::Error> {
        use std::io::BufRead;
        let file = std::fs::File::open(log_path)?;
        let reader = std::io::BufReader::new(file);

        let mut last_line = String::new();
        for line in reader.lines() {
            if let Ok(line_content) = line {
                if !line_content.is_empty() {
                    last_line = line_content;
                }
            }
        }

        if last_line.is_empty() {
            return Ok("0000000000000000000000000000000000000000000000000000000000000000".to_string());
        }

        let entry: AuditEntry = serde_json::from_str(&last_line)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

        Ok(entry.entry_hash)
    }

    /// Compute SHA-256 hash
    fn compute_hash(data: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        let result = hasher.finalize();
        hex::encode(result)
    }

    /// Sign entry (simplified - use real crypto signatures in production)
    fn sign_entry(entry_hash: &str, device_id: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(entry_hash.as_bytes());
        hasher.update(device_id.as_bytes());
        hasher.update(b"AUDIT_SIGNATURE");
        hex::encode(hasher.finalize())
    }

    /// Verify log chain integrity
    pub fn verify_chain<P: AsRef<Path>>(log_path: P) -> Result<bool, std::io::Error> {
        use std::io::BufRead;
        let file = std::fs::File::open(&log_path)?;
        let reader = std::io::BufReader::new(file);

        let mut previous_hash = "0000000000000000000000000000000000000000000000000000000000000000".to_string();
        let mut line_count = 0;

        for line in reader.lines() {
            let line_content = line?;
            if line_content.is_empty() {
                continue;
            }

            let entry: AuditEntry = serde_json::from_str(&line_content)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;

            // Verify chain linkage
            if entry.previous_hash != previous_hash.as_str() {
                return Ok(false); // Chain broken!
            }

            // Verify entry hash
            let hash_input = format!(
                "{}|{}|{:?}|{}|{:?}|{}|{}|{}",
                entry.timestamp,
                previous_hash,
                entry.event_type,
                entry.severity,
                entry.user_id.as_deref().unwrap_or(&String::new()),
                entry.device_id.as_deref().unwrap_or(&String::new()),
                entry.ip_address.as_deref().unwrap_or(&String::new()),
                entry.details
            );

            let expected_hash = Self::compute_hash(&hash_input);
            if entry.entry_hash != expected_hash {
                return Ok(false); // Tampered entry!
            }

            previous_hash = entry.entry_hash.clone();
            line_count += 1;
        }

        Ok(line_count > 0) // Valid if at least one entry
    }

    /// Get audit statistics
    pub fn get_statistics<P: AsRef<Path>>(log_path: P) -> Result<AuditStatistics, std::io::Error> {
        use std::io::BufRead;
        let file = std::fs::File::open(&log_path)?;
        let reader = std::io::BufReader::new(file);

        let mut stats = AuditStatistics::default();

        for line in reader.lines() {
            let line_content = line?;
            if line_content.is_empty() {
                continue;
            }

            if let Ok(entry) = serde_json::from_str::<AuditEntry>(&line_content) {
                stats.total_entries += 1;

                match entry.severity {
                    AuditSeverity::Critical => stats.critical_events += 1,
                    AuditSeverity::Warning => stats.warning_events += 1,
                    AuditSeverity::Info => stats.info_events += 1,
                }

                match entry.event_type {
                    AuditEventType::LoginFailed => stats.failed_logins += 1,
                    AuditEventType::AccountLocked => stats.lockouts += 1,
                    AuditEventType::PasswordViewed => stats.password_views += 1,
                    _ => {}
                }
            }
        }

        Ok(stats)
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AuditStatistics {
    pub total_entries: usize,
    pub critical_events: usize,
    pub warning_events: usize,
    pub info_events: usize,
    pub failed_logins: usize,
    pub lockouts: usize,
    pub password_views: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audit_chain_verification() {
        // Create temporary log
        let temp_dir = std::env::temp_dir();
        let log_path = temp_dir.join("test_audit.log");
        let _ = std::fs::remove_file(&log_path);

        let logger = AuditLogger::new(&log_path, "test-device".to_string()).unwrap();

        // Log some events
        logger.log_event(
            AuditEventType::LoginSuccess,
            AuditSeverity::Info,
            Some("user1".to_string()),
            None,
            "Successful login".to_string(),
        ).unwrap();

        logger.log_event(
            AuditEventType::PasswordCreated,
            AuditSeverity::Info,
            Some("user1".to_string()),
            None,
            "Created new password entry".to_string(),
        ).unwrap();

        // Verify chain
        let is_valid = AuditLogger::verify_chain(&log_path).unwrap();
        assert!(is_valid);

        // Cleanup
        let _ = std::fs::remove_file(&log_path);
    }

    #[test]
    fn test_audit_statistics() {
        let temp_dir = std::env::temp_dir();
        let log_path = temp_dir.join("test_audit_stats.log");
        let _ = std::fs::remove_file(&log_path);

        let logger = AuditLogger::new(&log_path, "test-device".to_string()).unwrap();

        // Log various events
        logger.log_event(
            AuditEventType::LoginSuccess,
            AuditSeverity::Info,
            None,
            None,
            "Login".to_string(),
        ).unwrap();

        logger.log_event(
            AuditEventType::LoginFailed,
            AuditSeverity::Warning,
            None,
            None,
            "Failed login".to_string(),
        ).unwrap();

        let stats = AuditLogger::get_statistics(&log_path).unwrap();
        assert_eq!(stats.total_entries, 2);
        assert_eq!(stats.failed_logins, 1);

        let _ = std::fs::remove_file(&log_path);
    }
}
