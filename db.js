import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'vaultdrop.db');
const db = new DatabaseSync(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS vaults (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    cipher_mode TEXT NOT NULL DEFAULT 'AES-256-GCM',
    iv TEXT NOT NULL,
    ciphertext TEXT,
    file_path TEXT,
    encrypted_metadata TEXT,
    has_passphrase INTEGER DEFAULT 0,
    wrapped_key TEXT,
    pass_salt TEXT,
    pass_iv TEXT,
    pass_verify_hash TEXT,
    burn_after_read INTEGER DEFAULT 1,
    max_downloads INTEGER DEFAULT 1,
    download_count INTEGER DEFAULT 0,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    kill_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    value INTEGER DEFAULT 0
  );
`);

// Initialize stats if not present
const getStatStmt = db.prepare('SELECT value FROM stats WHERE key = ?');
const initStatStmt = db.prepare('INSERT OR IGNORE INTO stats (key, value) VALUES (?, 0)');
['total_created', 'total_shredded'].forEach(key => {
  initStatStmt.run(key);
});

export { db, DATA_DIR, UPLOADS_DIR };
