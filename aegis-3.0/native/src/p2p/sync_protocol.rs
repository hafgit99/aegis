use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// CRDT-based sync protocol for conflict-free vault synchronization
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    pub id: String,
    pub data: Vec<u8>,
    pub timestamp: u64,
    pub version: u32,
}

/// Last-Write-Wins (LWW) CRDT for vault entries
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct LWWMap {
    entries: HashMap<String, VaultEntry>,
}

#[allow(dead_code)]
impl LWWMap {
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
        }
    }

    /// Insert or update an entry
    pub fn insert(&mut self, entry: VaultEntry) {
        let id = entry.id.clone();
        
        // Check if entry exists
        if let Some(existing) = self.entries.get(&id) {
            // Keep the entry with the latest timestamp
            if entry.timestamp > existing.timestamp {
                self.entries.insert(id, entry);
            } else if entry.timestamp == existing.timestamp {
                // If timestamps are equal, use version number
                if entry.version > existing.version {
                    self.entries.insert(id, entry);
                }
            }
        } else {
            // New entry
            self.entries.insert(id, entry);
        }
    }

    /// Merge with another LWWMap
    pub fn merge(&mut self, other: &LWWMap) {
        for (_, entry) in &other.entries {
            self.insert(entry.clone());
        }
    }

    /// Get all entries
    pub fn get_all(&self) -> Vec<&VaultEntry> {
        self.entries.values().collect()
    }

    /// Get entry by ID
    pub fn get(&self, id: &str) -> Option<&VaultEntry> {
        self.entries.get(id)
    }

    /// Remove entry by ID
    pub fn remove(&mut self, id: &str) -> Option<VaultEntry> {
        self.entries.remove(id)
    }
}

/// Sync message for P2P communication
#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub enum SyncMessage {
    /// Request full vault sync
    SyncRequest,
    /// Response with vault entries
    SyncResponse { entries: Vec<VaultEntry> },
    /// Update notification for a single entry
    EntryUpdate { entry: VaultEntry },
    /// Delete notification
    EntryDelete { id: String, timestamp: u64 },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lww_map_insert() {
        let mut map = LWWMap::new();
        
        let entry1 = VaultEntry {
            id: "test1".to_string(),
            data: vec![1, 2, 3],
            timestamp: 100,
            version: 1,
        };
        
        map.insert(entry1.clone());
        assert_eq!(map.get("test1").unwrap().timestamp, 100);
    }

    #[test]
    fn test_lww_map_conflict_resolution() {
        let mut map = LWWMap::new();
        
        let entry1 = VaultEntry {
            id: "test1".to_string(),
            data: vec![1, 2, 3],
            timestamp: 100,
            version: 1,
        };
        
        let entry2 = VaultEntry {
            id: "test1".to_string(),
            data: vec![4, 5, 6],
            timestamp: 200,
            version: 1,
        };
        
        map.insert(entry1);
        map.insert(entry2.clone());
        
        // Should keep entry2 (newer timestamp)
        assert_eq!(map.get("test1").unwrap().data, vec![4, 5, 6]);
    }

    #[test]
    fn test_lww_map_merge() {
        let mut map1 = LWWMap::new();
        let mut map2 = LWWMap::new();
        
        map1.insert(VaultEntry {
            id: "entry1".to_string(),
            data: vec![1],
            timestamp: 100,
            version: 1,
        });
        
        map2.insert(VaultEntry {
            id: "entry2".to_string(),
            data: vec![2],
            timestamp: 200,
            version: 1,
        });
        
        map1.merge(&map2);
        
        assert!(map1.get("entry1").is_some());
        assert!(map1.get("entry2").is_some());
    }
}
