import { db } from './db.js';
import { secureShredFile } from './shredder.js';

const findExpiredStmt = db.prepare(`
  SELECT id, type, file_path 
  FROM vaults 
  WHERE status = 'active' AND expires_at <= ?
`);

const markExpiredStmt = db.prepare(`
  UPDATE vaults 
  SET status = 'expired', 
      ciphertext = NULL, 
      file_path = NULL 
  WHERE id = ?
`);

const incShreddedStmt = db.prepare(`
  UPDATE stats SET value = value + 1 WHERE key = 'total_shredded'
`);

export function runCleanup() {
  const now = Date.now();
  const expiredVaults = findExpiredStmt.all(now);

  for (const vault of expiredVaults) {
    if (vault.type === 'file' && vault.file_path) {
      secureShredFile(vault.file_path);
    }
    markExpiredStmt.run(vault.id);
    incShreddedStmt.run();
    console.log(`[VaultDrop Auto-Shredder] Purged expired vault: ${vault.id}`);
  }
}

export function startCleanupDaemon(intervalMs = 15000) {
  runCleanup();
  const timer = setInterval(runCleanup, intervalMs);
  return timer;
}
