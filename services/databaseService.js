
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
        updated_at INTEGER
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
            { name: 'metadata_tag', type: 'TEXT' }
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
    }

    // --- Entries ---
    saveEntry(entry) {
        if (!this.db) throw new Error("Database not initialized");
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entries (
        id, category, folder_id, payload, iv, tag, is_favorite, updated_at, deleted_at,
        file_size, encrypted_file, file_iv, file_tag,
        encrypted_title, title_iv, title_tag,
        encrypted_username, username_iv, username_tag,
        encrypted_metadata, metadata_iv, metadata_tag
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        return stmt.run(
            entry.id,
            entry.category,
            entry.folderId || null,
            entry.payload, // Buffer
            entry.iv,
            entry.tag,
            entry.isFavorite ? 1 : 0,
            Date.now(),
            entry.deletedAt || 0,
            entry.fileSize || 0,
            entry.encryptedFile || null,
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
            entry.metadataTag || null
        );
    }

    deleteEntry(id) {
        if (!this.db) return;
        return this.db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    }

    getEntry(id) {
        if (!this.db) return null;
        const row = this.db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
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
                encrypted_metadata, metadata_iv, metadata_tag
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = this.db.transaction((data) => {
            for (const entry of data) {
                insert.run(
                    entry.id,
                    entry.category,
                    entry.folderId || null,
                    entry.payload,
                    entry.iv,
                    entry.tag,
                    entry.isFavorite ? 1 : 0,
                    entry.updatedAt || Date.now(),
                    entry.deletedAt || 0,
                    entry.fileSize || 0,
                    entry.encryptedFile || null,
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
                    entry.metadataTag || null
                );
            }
        });

        transaction(entries);
    }

    // --- Folders ---
    saveFolder(folder) {
        if (!this.db) throw new Error("Database not initialized");
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO folders (id, name, updated_at)
      VALUES (?, ?, ?)
    `);
        return stmt.run(folder.id, folder.name, Date.now());
    }

    deleteFolder(id) {
        if (!this.db) return;
        return this.db.prepare('DELETE FROM folders WHERE id = ?').run(id);
    }

    getAllFolders() {
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM folders').all();
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
