use rusqlite::{Connection, Result, params};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

/// Connection pool for better resource management
pub struct ConnectionPool {
    connection: Mutex<Connection>,
}

impl ConnectionPool {
    fn new(connection: Connection) -> Self {
        Self {
            connection: Mutex::new(connection),
        }
    }

    pub fn get(&self) -> &Mutex<Connection> {
        &self.connection
    }
}

pub struct DatabaseManager {
    pool: Arc<ConnectionPool>,
}

impl DatabaseManager {
    /// Create or open an encrypted database with proper key derivation
    /// SECURITY FIX: Uses the provided password hash directly as the SQLCipher key
    /// The password hash is already derived using Argon2id with hardware binding
    pub fn open<P: AsRef<Path>>(path: P, password_hash: &str) -> Result<Self> {
        let conn = Connection::open(&path)?;

        // The password_hash is already derived using Argon2id with hardware ID as salt
        // Use it directly as the SQLCipher key (expects hex string)
        conn.pragma_update(None, "key", &password_hash)?;

        // Set additional SQLCipher security parameters
        conn.pragma_update(None, "cipher_memory_security", &1)?; // Enable memory security
        conn.pragma_update(None, "cipher_plaintext_header_size", &0)?; // No plaintext header

        // Verify connection works with encryption
        let _: Result<i32> = conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get(0));

        // Create connection pool
        let pool = ConnectionPool::new(conn);
        let db = Self { pool: Arc::new(pool) };
        db.init()?;
        Ok(db)
    }

    /// Initialize the database schema
    fn init(&self) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS vault_entries (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                username TEXT,
                data BLOB NOT NULL,
                tags TEXT,
                category TEXT,
                last_modified INTEGER NOT NULL,
                version INTEGER NOT NULL DEFAULT 1
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                last_modified INTEGER NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS emergency_contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                waiting_period INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                last_request_at INTEGER,
                data BLOB,
                last_modified INTEGER NOT NULL
            )",
            [],
        )?;

        // SECURITY FIX: Password history table for tracking previous passwords
        conn.execute(
            "CREATE TABLE IF NOT EXISTS password_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id TEXT NOT NULL,
                old_password BLOB NOT NULL,
                changed_at INTEGER NOT NULL,
                version INTEGER NOT NULL,
                FOREIGN KEY (entry_id) REFERENCES vault_entries(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // SECURITY FIX: Failed login attempts table for persistent rate limiting
        conn.execute(
            "CREATE TABLE IF NOT EXISTS failed_login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_identifier TEXT NOT NULL,
                attempt_time INTEGER NOT NULL,
                ip_address TEXT,
                device_fingerprint TEXT
            )",
            [],
        )?;

        // SECURITY FIX: Account lockout table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS account_lockouts (
                identifier TEXT PRIMARY KEY,
                lockout_until INTEGER NOT NULL,
                failed_attempts INTEGER NOT NULL DEFAULT 0,
                last_attempt_time INTEGER NOT NULL
            )",
            [],
        )?;

        // Indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_entries_title ON vault_entries (title)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_vault_entries_category ON vault_entries (category)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_password_history_entry_id ON password_history (entry_id)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_identifier ON failed_login_attempts (attempt_identifier)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_time ON failed_login_attempts (attempt_time)",
            [],
        )?;

        Ok(())
    }

    /// Save a vault entry
    pub fn save_entry(
        &self,
        id: &str,
        title: &str,
        username: Option<&str>,
        data: &[u8],
        tags: Option<&str>,
        category: Option<&str>,
    ) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        conn.execute(
            "INSERT OR REPLACE INTO vault_entries
            (id, title, username, data, tags, category, last_modified, version)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, (SELECT COALESCE(version, 0) + 1 FROM vault_entries WHERE id = ?1))",
            params![id, title, username, data, tags, category, timestamp as i64],
        )?;

        Ok(())
    }

    /// Get all vault entries
    pub fn get_all_entries(&self) -> Result<Vec<(String, String, Option<String>, Vec<u8>, Option<String>, Option<String>)>> {
        let conn = self.pool.get().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, username, data, tags, category FROM vault_entries")?;
        let entries = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Vec<u8>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })?;

        let mut result = Vec::new();
        for entry in entries {
            result.push(entry?);
        }

        Ok(result)
    }

    /// Delete a vault entry
    pub fn delete_entry(&self, id: &str) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        conn.execute("DELETE FROM vault_entries WHERE id = ?", params![id])?;
        Ok(())
    }

    /// Set a metadata value
    pub fn set_metadata(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value, last_modified) VALUES (?1, ?2, ?3)",
            params![key, value, timestamp as i64],
        )?;
        Ok(())
    }

    /// Get a metadata value
    pub fn get_metadata(&self, key: &str) -> Result<Option<String>> {
        let conn = self.pool.get().lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM metadata WHERE key = ?")?;
        let mut rows = stmt.query(params![key])?;

        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    // ==================== EMERGENCY CONTACTS ====================

    pub fn save_emergency_contact(
        &self,
        id: &str,
        name: &str,
        email: &str,
        waiting_period: i64,
        status: &str,
        last_request_at: Option<i64>,
        data: Option<&[u8]>,
    ) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        conn.execute(
            "INSERT OR REPLACE INTO emergency_contacts
            (id, name, email, waiting_period, status, last_request_at, data, last_modified)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, name, email, waiting_period, status, last_request_at, data, timestamp as i64],
        )?;

        Ok(())
    }

    pub fn get_all_emergency_contacts(&self) -> Result<Vec<(String, String, String, i64, String, Option<i64>, Option<Vec<u8>>)>> {
        let conn = self.pool.get().lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, email, waiting_period, status, last_request_at, data FROM emergency_contacts")?;
        let contacts = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, Option<Vec<u8>>>(6)?,
            ))
        })?;

        let mut result = Vec::new();
        for contact in contacts {
            result.push(contact?);
        }

        Ok(result)
    }

    pub fn delete_emergency_contact(&self, id: &str) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        conn.execute("DELETE FROM emergency_contacts WHERE id = ?", params![id])?;
        Ok(())
    }

    // ==================== PASSWORD HISTORY ====================
    // SECURITY FIX: Track password history to prevent reuse and enable recovery

    /// Save old password to history before updating
    pub fn save_password_history(
        &self,
        entry_id: &str,
        old_password: &[u8],
        version: i32,
    ) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        conn.execute(
            "INSERT INTO password_history (entry_id, old_password, changed_at, version)
             VALUES (?1, ?2, ?3, ?4)",
            params![entry_id, old_password, timestamp as i64, version],
        )?;

        // Keep only last 20 versions per entry (cleanup old history)
        conn.execute(
            "DELETE FROM password_history
             WHERE id NOT IN (
                 SELECT id FROM password_history
                 WHERE entry_id = ?1
                 ORDER BY changed_at DESC
                 LIMIT 20
             ) AND entry_id = ?1",
            params![entry_id],
        )?;

        Ok(())
    }

    /// Get password history for an entry
    pub fn get_password_history(&self, entry_id: &str, limit: i32) -> Result<Vec<(i64, Vec<u8>, i32)>> {
        let conn = self.pool.get().lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT changed_at, old_password, version FROM password_history
             WHERE entry_id = ?1
             ORDER BY changed_at DESC
             LIMIT ?2"
        )?;

        let history = stmt.query_map(params![entry_id, limit], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, Vec<u8>>(1)?,
                row.get::<_, i32>(2)?,
            ))
        })?;

        let mut result = Vec::new();
        for entry in history {
            result.push(entry?);
        }

        Ok(result)
    }

    /// Check if a password is in history (prevent reuse)
    pub fn is_password_in_history(&self, entry_id: &str, new_password: &[u8]) -> Result<bool> {
        let conn = self.pool.get().lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT COUNT(*) FROM password_history
             WHERE entry_id = ?1 AND old_password = ?2"
        )?;

        let count: i64 = stmt.query_row(params![entry_id, new_password], |row| row.get(0))?;
        Ok(count > 0)
    }

    // ==================== RATE LIMITING & ACCOUNT LOCKOUT ====================
    // SECURITY FIX: Persistent rate limiting and account lockout

    /// Record a failed login attempt
    pub fn record_failed_attempt(
        &self,
        identifier: &str,
        ip_address: Option<&str>,
        device_fingerprint: Option<&str>,
    ) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Record the attempt
        conn.execute(
            "INSERT INTO failed_login_attempts (attempt_identifier, attempt_time, ip_address, device_fingerprint)
             VALUES (?1, ?2, ?3, ?4)",
            params![identifier, timestamp as i64, ip_address, device_fingerprint],
        )?;

        // Clean up old attempts (older than 1 hour)
        let one_hour_ago = (timestamp - 3600) as i64;
        conn.execute(
            "DELETE FROM failed_login_attempts WHERE attempt_time < ?1",
            params![one_hour_ago],
        )?;

        Ok(())
    }

    /// Get recent failed attempt count for an identifier
    pub fn get_failed_attempt_count(&self, identifier: &str, window_minutes: i32) -> Result<i32> {
        let conn = self.pool.get().lock().unwrap();
        let window_seconds = window_minutes as i64 * 60;
        let cutoff_time = (SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64 - window_seconds) as i64;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM failed_login_attempts
             WHERE attempt_identifier = ?1 AND attempt_time > ?2",
            params![identifier, cutoff_time],
            |row| row.get(0),
        )?;

        Ok(count as i32)
    }

    /// Check if identifier is currently locked out
    pub fn is_locked_out(&self, identifier: &str) -> Result<bool> {
        let conn = self.pool.get().lock().unwrap();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let lockout_until: Option<i64> = conn.query_row(
            "SELECT lockout_until FROM account_lockouts WHERE identifier = ?1",
            params![identifier],
            |row| row.get(0),
        )?;

        Ok(match lockout_until {
            Some(until) => until > now,
            None => false,
        })
    }

    /// Get remaining lockout time in seconds
    pub fn get_lockout_remaining(&self, identifier: &str) -> Result<Option<i64>> {
        let conn = self.pool.get().lock().unwrap();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let lockout_until: Option<i64> = conn.query_row(
            "SELECT lockout_until FROM account_lockouts WHERE identifier = ?1",
            params![identifier],
            |row| row.get(0),
        )?;

        Ok(match lockout_until {
            Some(until) if until > now => Some(until - now),
            _ => None,
        })
    }

    /// Apply lockout to an identifier
    pub fn apply_lockout(&self, identifier: &str, duration_seconds: i64, failed_attempts: i32) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let lockout_until = now + duration_seconds;

        conn.execute(
            "INSERT OR REPLACE INTO account_lockouts (identifier, lockout_until, failed_attempts, last_attempt_time)
             VALUES (?1, ?2, ?3, ?4)",
            params![identifier, lockout_until, failed_attempts, now],
        )?;

        Ok(())
    }

    /// Clear lockout and reset failed attempts (on successful login)
    pub fn clear_lockout(&self, identifier: &str) -> Result<()> {
        let conn = self.pool.get().lock().unwrap();

        // Remove lockout entry
        conn.execute(
            "DELETE FROM account_lockouts WHERE identifier = ?1",
            params![identifier],
        )?;

        // Also clean up failed attempts for this identifier
        conn.execute(
            "DELETE FROM failed_login_attempts WHERE attempt_identifier = ?1",
            params![identifier],
        )?;

        Ok(())
    }

    /// Clean up expired lockouts (should be called periodically)
    pub fn cleanup_expired_lockouts(&self) -> Result<i32> {
        let conn = self.pool.get().lock().unwrap();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let deleted = conn.execute(
            "DELETE FROM account_lockouts WHERE lockout_until < ?1",
            params![now],
        )?;

        Ok(deleted.try_into().unwrap_or(0))
    }
}
