
import Database from 'better-sqlite3-multiple-ciphers';
import path from 'path';
import fs from 'fs';

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = null;
    }

    init(userDataPath, masterKeyHex) {
        if (this.db) return;

        try {
            // SECURITY: Validate Master Key format (must be 64-char hex) to prevent PRAGMA injection
            if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
                throw new Error("INVALID_KEY_FORMAT: Master key must be a 64-character hexadecimal string");
            }

            this.dbPath = path.join(userDataPath, 'vault.db');

            // SECURITY: Open with SQLCipher encryption
            this.db = new Database(this.dbPath);

            // Configure SQLCipher
            // PRAGMA key = 'password' must be the first operation
            this.db.pragma(`key = '${masterKeyHex}'`);

            // Optimize for concurrent access (CLI and Desktop App)
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');

            // Initialize Tables and Migrations
            this.createTables();
            this.applyMigrations();

            console.log('[Database] SQLite/SQLCipher initialized in WAL mode at', this.dbPath);
        } catch (e) {
            console.error('[Database] Failed to initialize:', e);
            this.db = null;
            throw e; // Rethrow to be caught in main.js
        }
    }

    /**
     * SECURITY: Changes the encryption key of the existing database
     * Uses SQLCipher's PRAGMA rekey
     * @param {string} newMasterKeyHex 64-character hex string
     */
    rekey(newMasterKeyHex) {
        if (!this.db) throw new Error("Database not initialized");

        try {
            if (!/^[0-9a-fA-F]{64}$/.test(newMasterKeyHex)) {
                throw new Error("INVALID_KEY_FORMAT: New master key must be a 64-character hexadecimal string");
            }

            console.log('[Security] Rotating SQLite encryption key...');
            this.db.pragma(`rekey = '${newMasterKeyHex}'`);
            console.log('[Security] SQLite encryption key rotated successfully.');
        } catch (e) {
            console.error('[Security] Key rotation failed:', e);
            throw e;
        }
    }

    createTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        category TEXT,
        folder_id TEXT,
        payload BLOB,
        iv TEXT,
        tag TEXT,
        is_favorite INTEGER DEFAULT 0,
        updated_at INTEGER,
        deleted_at INTEGER DEFAULT 0,
        file_size INTEGER,
        encrypted_file BLOB,
        file_iv TEXT,
        file_tag TEXT,
        encrypted_title BLOB,
        title_iv TEXT,
        title_tag TEXT,
        encrypted_username BLOB,
        username_iv TEXT,
        username_tag TEXT,
        encrypted_metadata BLOB,
        metadata_iv TEXT,
        metadata_tag TEXT
      );

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT,
        color TEXT,
        icon TEXT,
        parent_id TEXT,
        updated_at INTEGER,
        iv TEXT,
        tag TEXT
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    }

    applyMigrations() {
        if (!this.db) return;

        const tableInfo = this.db.prepare("PRAGMA table_info(entries)").all();
        const existingColumns = tableInfo.map(col => col.name);

        const requiredColumns = [
            { name: 'deleted_at', type: 'INTEGER DEFAULT 0' },
            { name: 'file_size', type: 'INTEGER' },
            { name: 'encrypted_file', type: 'BLOB' },
            { name: 'file_iv', type: 'TEXT' },
            { name: 'file_tag', type: 'TEXT' },
            { name: 'encrypted_title', type: 'BLOB' },
            { name: 'title_iv', type: 'TEXT' },
            { name: 'title_tag', type: 'TEXT' },
            { name: 'encrypted_username', type: 'BLOB' },
            { name: 'username_iv', type: 'TEXT' },
            { name: 'username_tag', type: 'TEXT' },
            { name: 'encrypted_metadata', type: 'BLOB' },
            { name: 'metadata_iv', type: 'TEXT' },
            { name: 'metadata_tag', type: 'TEXT' },
            { name: 'category_idx', type: 'TEXT' }, // Blind search index
            { name: 'folder_idx', type: 'TEXT' }     // Blind search index
        ];

        for (const col of requiredColumns) {
            if (!existingColumns.includes(col.name)) {
                console.log(`[Database] Migrating: Adding column ${col.name} to entries table`);
                try {
                    this.db.exec(`ALTER TABLE entries ADD COLUMN ${col.name} ${col.type}`);
                } catch (e) {
                    console.error(`[Database] Failed to add column ${col.name}:`, e);
                }
            }
        }

        // Migration for Folders table
        const folderInfo = this.db.prepare("PRAGMA table_info(folders)").all();
        const existingFolderCols = folderInfo.map(col => col.name);
        if (!existingFolderCols.includes('iv')) {
            console.log(`[Database] Migrating: Adding security columns to folders table`);
            try {
                this.db.exec(`ALTER TABLE folders ADD COLUMN color TEXT`);
                this.db.exec(`ALTER TABLE folders ADD COLUMN icon TEXT`);
                this.db.exec(`ALTER TABLE folders ADD COLUMN parent_id TEXT`);
                this.db.exec(`ALTER TABLE folders ADD COLUMN iv TEXT`);
                this.db.exec(`ALTER TABLE folders ADD COLUMN tag TEXT`);
            } catch (e) {
                console.warn("[Database] Folder migration partially failed (might already exist)", e.message);
            }
        }
    }

    /**
     * SECURITY: Strictly validates IDs to prevent SQL injection or path traversal
     * @param {string} id 
     */
    _sanitizeId(id) {
        if (!id || typeof id !== 'string') return null;
        // Allow only alphanumeric, dashes, and underscores (Standard for UUIDs and IDs)
        if (!/^[a-zA-Z0-9\-_]+$/.test(id)) {
            console.error(`[Security] Malicious ID detected and blocked: ${id}`);
            throw new Error("INVALID_ID_FORMAT");
        }
        return id;
    }

    // --- Limits & Security ---
    MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per entry
    MAX_VAULT_SIZE = 1024 * 1024 * 1024; // 1GB total limit for vault storage

    /**
     * Checks if saving an entry would exceed storage limits
     * @param {number} newFileSize Size of the new attachment
     * @param {string} entryId ID of the entry (to calculate delta if updating)
     * @param {number} payloadSize Size of the metadata payload
     */
    checkLimits(newFileSize, entryId, payloadSize = 0) {
        // 1. Individual Entry Limit
        if (newFileSize > this.MAX_FILE_SIZE) {
            throw new Error(`FILE_TOO_LARGE: Max ${this.MAX_FILE_SIZE / (1024 * 1024)}MB allowed`);
        }

        // 2. Global Vault Limit
        try {
            const currentTotal = this.db.prepare('SELECT SUM(file_size) as total FROM entries').get()?.total || 0;
            const existingEntry = entryId ? (this.db.prepare('SELECT file_size FROM entries WHERE id = ?').get(entryId)?.file_size || 0) : 0;

            const projectedSize = currentTotal - existingEntry + newFileSize;

            if (projectedSize > this.MAX_VAULT_SIZE) {
                throw new Error(`VAULT_FULL: Storage limit of ${this.MAX_VAULT_SIZE / (1024 * 1024)}MB reached`);
            }
        } catch (e) {
            if (e.message.startsWith('FILE_TOO_LARGE') || e.message.startsWith('VAULT_FULL')) throw e;
            console.error('[Database] Size check failed, allowing proceed', e);
        }
    }

    // --- Entries ---
    saveEntry(entry) {
        if (!this.db) throw new Error("Database not initialized");

        const safeId = this._sanitizeId(entry.id);
        const safeFolderId = entry.folderId ? this._sanitizeId(entry.folderId) : null;

        // SECURITY: Enforce DoS protection limits
        const fileBuffer = entry.encryptedFile ?
            (Buffer.isBuffer(entry.encryptedFile) ? entry.encryptedFile : Buffer.from(entry.encryptedFile))
            : null;
        const fileSize = fileBuffer ? fileBuffer.length : 0;

        this.checkLimits(fileSize, entry.id);

        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entries (
        id, category, folder_id, payload, iv, tag, is_favorite, updated_at, deleted_at,
        file_size, encrypted_file, file_iv, file_tag,
        encrypted_title, title_iv, title_tag,
        encrypted_username, username_iv, username_tag,
        encrypted_metadata, metadata_iv, metadata_tag,
        category_idx, folder_idx
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        return stmt.run(
            safeId,
            entry.category,
            safeFolderId,
            entry.payload, // Buffer
            entry.iv,
            entry.tag,
            entry.isFavorite ? 1 : 0,
            entry.updatedAt || Date.now(),
            entry.deletedAt || 0,
            fileSize,
            fileBuffer,
            entry.fileIv || null,
            entry.fileTag || null,
            entry.encryptedTitle || null,
            entry.titleIv || null,
            entry.titleTag || null,
            entry.encryptedUsername || null,
            entry.usernameIv || null,
            entry.usernameTag || null,
            entry.encryptedMetadata || null,
            entry.metadataIv || null,
            entry.metadataTag || null,
            entry.categoryIdx || null,
            entry.folderIdx || null
        );
    }

    deleteEntry(id) {
        if (!this.db) return;
        return this.db.prepare('DELETE FROM entries WHERE id = ?').run(this._sanitizeId(id));
    }

    getEntry(id) {
        if (!this.db) return null;
        const row = this.db.prepare('SELECT * FROM entries WHERE id = ?').get(this._sanitizeId(id));
        if (!row) return null;
        return {
            ...row,
            payload: row.payload ? row.payload.toString('base64') : null,
            encrypted_file: row.encrypted_file ? row.encrypted_file.toString('base64') : null,
            encrypted_title: row.encrypted_title ? row.encrypted_title.toString('base64') : null,
            encrypted_username: row.encrypted_username ? row.encrypted_username.toString('base64') : null,
            encrypted_metadata: row.encrypted_metadata ? row.encrypted_metadata.toString('base64') : null
        };
    }

    getAllEntries() {
        if (!this.db) return [];
        const rows = this.db.prepare('SELECT * FROM entries').all();
        // Convert Blobs to Base64 for safe IPC transfer
        return rows.map(row => ({
            ...row,
            payload: row.payload ? row.payload.toString('base64') : null,
            encrypted_file: row.encrypted_file ? row.encrypted_file.toString('base64') : null,
            encrypted_title: row.encrypted_title ? row.encrypted_title.toString('base64') : null,
            encrypted_username: row.encrypted_username ? row.encrypted_username.toString('base64') : null,
            encrypted_metadata: row.encrypted_metadata ? row.encrypted_metadata.toString('base64') : null
        }));
    }

    bulkSaveEntries(entries) {
        if (!this.db) throw new Error("Database not initialized");
        const insert = this.db.prepare(`
            INSERT OR REPLACE INTO entries (
                id, category, folder_id, payload, iv, tag, is_favorite, updated_at, deleted_at,
                file_size, encrypted_file, file_iv, file_tag,
                encrypted_title, title_iv, title_tag,
                encrypted_username, username_iv, username_tag,
                encrypted_metadata, metadata_iv, metadata_tag,
                category_idx, folder_idx
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Calculate current total once for batch efficiency, then track delta
        let currentTotal = 0;
        try {
            currentTotal = this.db.prepare('SELECT SUM(file_size) as total FROM entries').get()?.total || 0;
        } catch (e) { }

        const transaction = this.db.transaction((data) => {
            for (const entry of data) {
                const fileBuffer = entry.encryptedFile ?
                    (Buffer.isBuffer(entry.encryptedFile) ? entry.encryptedFile : Buffer.from(entry.encryptedFile))
                    : null;
                const fileSize = fileBuffer ? fileBuffer.length : 0;

                // Simple check for individual file size in bulk
                if (fileSize > this.MAX_FILE_SIZE) {
                    throw new Error(`FILE_TOO_LARGE: Entry ${entry.id} exceeds ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
                }

                insert.run(
                    this._sanitizeId(entry.id),
                    entry.category,
                    entry.folderId ? this._sanitizeId(entry.folderId) : null,
                    entry.payload,
                    entry.iv,
                    entry.tag,
                    entry.isFavorite ? 1 : 0,
                    entry.updatedAt || Date.now(),
                    entry.deletedAt || 0,
                    fileSize,
                    fileBuffer,
                    entry.fileIv || null,
                    entry.fileTag || null,
                    entry.encryptedTitle || null,
                    entry.titleIv || null,
                    entry.titleTag || null,
                    entry.encryptedUsername || null,
                    entry.usernameIv || null,
                    entry.usernameTag || null,
                    entry.encryptedMetadata || null,
                    entry.metadataIv || null,
                    entry.metadataTag || null,
                    entry.categoryIdx || null,
                    entry.folderIdx || null
                );
            }

            // Final check: Did this batch push us over the 1GB limit?
            try {
                const finalTotal = this.db.prepare('SELECT SUM(file_size) as total FROM entries').get()?.total || 0;
                if (finalTotal > this.MAX_VAULT_SIZE) {
                    throw new Error(`VAULT_FULL: Bulk import exceeds storage limit of ${this.MAX_VAULT_SIZE / (1024 * 1024)}MB`);
                }
            } catch (e) {
                if (e.message.startsWith('VAULT_FULL')) throw e;
            }
        });

        transaction(entries);
    }

    // --- Folders ---
    saveFolder(folder) {
        if (!this.db) throw new Error("Database not initialized");
        const safeId = this._sanitizeId(folder.id);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO folders (id, name, color, icon, parent_id, updated_at, iv, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

        return stmt.run(
            safeId,
            folder.encryptedName || folder.name,
            folder.color || null,
            folder.icon || null,
            folder.parentId ? this._sanitizeId(folder.parentId) : null,
            folder.updatedAt || Date.now(),
            folder.iv || null,
            folder.tag || null
        );
    }

    deleteFolder(id) {
        if (!this.db) return;
        return this.db.prepare('DELETE FROM folders WHERE id = ?').run(this._sanitizeId(id));
    }

    getAllFolders() {
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM folders').all().map(f => ({
            ...f,
            parentId: f.parent_id
        }));
    }

    // --- Config ---
    setConfig(key, value) {
        if (!this.db) return;
        const stmt = this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
        return stmt.run(key, value);
    }

    getConfig(key) {
        if (!this.db) return null;
        try {
            const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key);
            return row ? row.value : null;
        } catch (e) {
            return null;
        }
    }

    close() {
        if (this.db) {
            try {
                this.db.close();
            } catch (e) {
                console.error('[Database] Close error:', e);
            }
            this.db = null;
        }
    }

    // Safety check helper
    isReady() {
        return this.db !== null;
    }
}

export const databaseService = new DatabaseService();
