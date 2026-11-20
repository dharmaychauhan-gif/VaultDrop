import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { db, UPLOADS_DIR } from './db.js';
import { secureShredFile } from './shredder.js';
import { startCleanupDaemon } from './cleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const app = express();
const PORT = process.env.PORT || 3001;

// Start automated auto-shredder background daemon
startCleanupDaemon(15000);

// Configure Express
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Multer storage for encrypted file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const randomName = 'enc_' + crypto.randomBytes(16).toString('hex') + '.bin';
    cb(null, randomName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for demo
});

// Prepared statements
const insertVaultStmt = db.prepare(`
  INSERT INTO vaults (
    id, type, cipher_mode, iv, ciphertext, file_path, encrypted_metadata,
    has_passphrase, wrapped_key, pass_salt, pass_iv, pass_verify_hash,
    burn_after_read, max_downloads, download_count, expires_at, created_at,
    kill_token, status
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, 0, ?, ?,
    ?, 'active'
  )
`);

const getVaultMetaStmt = db.prepare(`
  SELECT id, type, cipher_mode, iv, encrypted_metadata,
         has_passphrase, wrapped_key, pass_salt, pass_iv,
         burn_after_read, max_downloads, download_count,
         expires_at, created_at, status
  FROM vaults WHERE id = ?
`);

const getVaultFullStmt = db.prepare(`
  SELECT * FROM vaults WHERE id = ?
`);

const incrementDownloadStmt = db.prepare(`
  UPDATE vaults SET download_count = download_count + 1 WHERE id = ?
`);

const burnVaultStmt = db.prepare(`
  UPDATE vaults 
  SET status = 'burned', ciphertext = NULL, file_path = NULL 
  WHERE id = ?
`);

const revokeVaultStmt = db.prepare(`
  UPDATE vaults 
  SET status = 'revoked', ciphertext = NULL, file_path = NULL 
  WHERE id = ? AND kill_token = ?
`);

const incStatStmt = db.prepare(`
  UPDATE stats SET value = value + 1 WHERE key = ?
`);

const getStatsStmt = db.prepare(`
  SELECT key, value FROM stats
`);

const countActiveStmt = db.prepare(`
  SELECT count(*) as count FROM vaults WHERE status = 'active' AND expires_at > ?
`);

// --- API ROUTES ---

// 1. Create a Zero-Knowledge Text Vault
app.post('/api/vaults/text', (req, res) => {
  try {
    const {
      id,
      iv,
      ciphertext,
      encryptedMetadata,
      hasPassphrase = 0,
      wrappedKey = null,
      passSalt = null,
      passIv = null,
      passVerifyHash = null,
      burnAfterRead = 1,
      maxDownloads = 1,
      expiresInMinutes = 60
    } = req.body;

    if (!id || !iv || !ciphertext) {
      return res.status(400).json({ error: 'Missing required cryptographic payload parameters' });
    }

    const now = Date.now();
    const expiresAt = now + (Number(expiresInMinutes) * 60 * 1000);
    const killToken = crypto.randomBytes(24).toString('hex');

    insertVaultStmt.run(
      id,
      'text',
      'AES-256-GCM',
      iv,
      ciphertext,
      null,
      encryptedMetadata || null,
      hasPassphrase ? 1 : 0,
      wrappedKey,
      passSalt,
      passIv,
      passVerifyHash,
      burnAfterRead ? 1 : 0,
      Number(maxDownloads) || 1,
      expiresAt,
      now,
      killToken
    );

    incStatStmt.run('total_created');

    return res.status(201).json({
      success: true,
      id,
      killToken,
      expiresAt,
      burnAfterRead: !!burnAfterRead,
      maxDownloads: Number(maxDownloads) || 1
    });
  } catch (err) {
    console.error('Error creating text vault:', err);
    return res.status(500).json({ error: 'Internal server error creating vault' });
  }
});

// 2. Create a Zero-Knowledge Encrypted File Vault
app.post('/api/vaults/file', upload.single('encrypted_file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Encrypted file payload missing' });
    }

    const {
      id,
      iv,
      encryptedMetadata,
      hasPassphrase = 0,
      wrappedKey = null,
      passSalt = null,
      passIv = null,
      passVerifyHash = null,
      burnAfterRead = 1,
      maxDownloads = 1,
      expiresInMinutes = 60
    } = req.body;

    if (!id || !iv) {
      // Shred orphaned file
      secureShredFile(req.file.path);
      return res.status(400).json({ error: 'Missing required cryptographic payload parameters' });
    }

    const now = Date.now();
    const expiresAt = now + (Number(expiresInMinutes) * 60 * 1000);
    const killToken = crypto.randomBytes(24).toString('hex');

    insertVaultStmt.run(
      id,
      'file',
      'AES-256-GCM',
      iv,
      null,
      req.file.path,
      encryptedMetadata || null,
      hasPassphrase == '1' || hasPassphrase === true ? 1 : 0,
      wrappedKey,
      passSalt,
      passIv,
      passVerifyHash,
      burnAfterRead == '1' || burnAfterRead === true ? 1 : 0,
      Number(maxDownloads) || 1,
      expiresAt,
      now,
      killToken
    );

    incStatStmt.run('total_created');

    return res.status(201).json({
      success: true,
      id,
      killToken,
      expiresAt,
      burnAfterRead: burnAfterRead == '1' || burnAfterRead === true,
      maxDownloads: Number(maxDownloads) || 1
    });
  } catch (err) {
    if (req.file) {
      secureShredFile(req.file.path);
    }
    console.error('Error creating file vault:', err);
    return res.status(500).json({ error: 'Internal server error creating file vault' });
  }
});

// 3. Get Vault Metadata (Safe & Public)
app.get('/api/vaults/:id/meta', (req, res) => {
  try {
    const { id } = req.params;
    const vault = getVaultMetaStmt.get(id);

    if (!vault) {
      return res.status(404).json({ error: 'Vault does not exist or has been permanently shredded', status: 'not_found' });
    }

    const now = Date.now();
    if (vault.status !== 'active' || vault.expires_at <= now) {
      return res.status(410).json({
        error: 'Vault is no longer accessible',
        status: vault.expires_at <= now ? 'expired' : vault.status
      });
    }

    return res.json({
      id: vault.id,
      type: vault.type,
      cipherMode: vault.cipher_mode,
      iv: vault.iv,
      encryptedMetadata: vault.encrypted_metadata ? JSON.parse(vault.encrypted_metadata) : null,
      hasPassphrase: !!vault.has_passphrase,
      wrappedKey: vault.wrapped_key,
      passSalt: vault.pass_salt,
      passIv: vault.pass_iv,
      burnAfterRead: !!vault.burn_after_read,
      maxDownloads: vault.max_downloads,
      downloadCount: vault.download_count,
      expiresAt: vault.expires_at,
      createdAt: vault.created_at,
      status: vault.status
    });
  } catch (err) {
    console.error('Error retrieving vault metadata:', err);
    return res.status(500).json({ error: 'Failed to retrieve metadata' });
  }
});

// In-memory 15-second grace cache for recently burned drops
// Protects mobile users against double-taps, network retries, or quick reloads
const recentBurnGraceCache = new Map();

// 4. Access/Read Text Vault Payload
app.post('/api/vaults/:id/access', (req, res) => {
  try {
    const { id } = req.params;

    // Check if within 15-second grace cache from a rapid mobile retry / double-tap
    if (recentBurnGraceCache.has(id)) {
      const cached = recentBurnGraceCache.get(id);
      return res.json({
        ciphertext: cached.ciphertext,
        iv: cached.iv,
        burned: true,
        downloadsRemaining: 0
      });
    }

    const vault = getVaultFullStmt.get(id);

    if (!vault) {
      return res.status(404).json({ error: 'Vault does not exist or has been permanently shredded' });
    }

    const now = Date.now();
    if (vault.status !== 'active' || vault.expires_at <= now) {
      return res.status(410).json({
        error: 'Vault is no longer accessible',
        status: vault.expires_at <= now ? 'expired' : vault.status
      });
    }

    if (vault.type !== 'text') {
      return res.status(400).json({ error: 'This endpoint is for text vaults only. Use /download for file vaults.' });
    }

    const newDownloadCount = vault.download_count + 1;
    incrementDownloadStmt.run(id);

    const willBurn = vault.burn_after_read === 1 || newDownloadCount >= vault.max_downloads;

    // Capture ciphertext to return before shredding
    const ciphertext = vault.ciphertext;
    const iv = vault.iv;

    if (willBurn) {
      // Keep in short 15s memory cache to absorb mobile double-tap / retry
      recentBurnGraceCache.set(id, { ciphertext, iv });
      setTimeout(() => {
        recentBurnGraceCache.delete(id);
      }, 15000);

      burnVaultStmt.run(id);
      incStatStmt.run('total_shredded');
      console.log(`[VaultDrop] Vault ${id} reached limit (${newDownloadCount}/${vault.max_downloads}) and has been shredded.`);
    }

    return res.json({
      ciphertext,
      iv: iv,
      burned: willBurn,
      downloadsRemaining: Math.max(0, vault.max_downloads - newDownloadCount)
    });
  } catch (err) {
    console.error('Error accessing vault payload:', err);
    return res.status(500).json({ error: 'Failed to access vault payload' });
  }
});

// 5. Download Encrypted File Payload
app.get('/api/vaults/:id/download', (req, res) => {
  try {
    const { id } = req.params;
    const vault = getVaultFullStmt.get(id);

    if (!vault) {
      return res.status(404).json({ error: 'Vault does not exist or has been permanently shredded' });
    }

    const now = Date.now();
    if (vault.status !== 'active' || vault.expires_at <= now) {
      return res.status(410).json({
        error: 'Vault is no longer accessible',
        status: vault.expires_at <= now ? 'expired' : vault.status
      });
    }

    if (vault.type !== 'file' || !vault.file_path || !fs.existsSync(vault.file_path)) {
      return res.status(404).json({ error: 'Encrypted file blob not found or already shredded' });
    }

    const newDownloadCount = vault.download_count + 1;
    incrementDownloadStmt.run(id);

    const willBurn = vault.burn_after_read === 1 || newDownloadCount >= vault.max_downloads;
    const filePath = vault.file_path;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="vault_${id}.enc"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      if (willBurn) {
        burnVaultStmt.run(id);
        secureShredFile(filePath);
        incStatStmt.run('total_shredded');
        console.log(`[VaultDrop] File vault ${id} downloaded and securely shredded.`);
      }
    });

    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
    });
  } catch (err) {
    console.error('Error downloading file vault:', err);
    return res.status(500).json({ error: 'Failed to stream file payload' });
  }
});

// 6. Kill Switch / Revoke Vault Manually (Sender only)
app.post('/api/vaults/:id/revoke', (req, res) => {
  try {
    const { id } = req.params;
    const { killToken } = req.body;

    if (!killToken) {
      return res.status(401).json({ error: 'Kill token required to revoke vault' });
    }

    const vault = getVaultFullStmt.get(id);
    if (!vault) {
      return res.status(404).json({ error: 'Vault not found or already deleted' });
    }

    if (vault.kill_token !== killToken) {
      return res.status(403).json({ error: 'Invalid kill token' });
    }

    if (vault.type === 'file' && vault.file_path) {
      secureShredFile(vault.file_path);
    }

    revokeVaultStmt.run(id, killToken);
    incStatStmt.run('total_shredded');

    return res.json({
      success: true,
      message: 'Vault has been shredded and permanently destroyed.'
    });
  } catch (err) {
    console.error('Error revoking vault:', err);
    return res.status(500).json({ error: 'Failed to revoke vault' });
  }
});

// 7. Get Status for Sender Dashboard
app.get('/api/vaults/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token;

    const vault = getVaultFullStmt.get(id);
    if (!vault) {
      return res.json({
        id,
        status: 'shredded',
        exists: false
      });
    }

    if (vault.kill_token !== token) {
      return res.status(403).json({ error: 'Unauthorized. Valid kill token required.' });
    }

    const now = Date.now();
    let currentStatus = vault.status;
    if (vault.status === 'active' && vault.expires_at <= now) {
      currentStatus = 'expired';
    }

    return res.json({
      id: vault.id,
      type: vault.type,
      status: currentStatus,
      downloadCount: vault.download_count,
      maxDownloads: vault.max_downloads,
      burnAfterRead: !!vault.burn_after_read,
      expiresAt: vault.expires_at,
      createdAt: vault.created_at,
      exists: true
    });
  } catch (err) {
    console.error('Error getting status:', err);
    return res.status(500).json({ error: 'Failed to get status' });
  }
});

// 8. Global Statistics
app.get('/api/stats', (req, res) => {
  try {
    const statsRows = getStatsStmt.all();
    const statsMap = {};
    statsRows.forEach(row => {
      statsMap[row.key] = row.value;
    });

    const activeCountRow = countActiveStmt.get(Date.now());

    return res.json({
      totalCreated: statsMap['total_created'] || 0,
      totalShredded: statsMap['total_shredded'] || 0,
      activeVaults: activeCountRow ? activeCountRow.count : 0
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    return res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// 9. LAN / Wi-Fi Network Info for Mobile QR Code Scanning
app.get('/api/network-info', (req, res) => {
  try {
    const localIp = getLocalIp();
    return res.json({
      localIp,
      port: PORT,
      lanOrigin: `http://${localIp}:${PORT}`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to determine network IP' });
  }
});

// Serve frontend build if exists
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

const localIp = getLocalIp();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[VaultDrop Server] Local:   http://localhost:${PORT}`);
  console.log(`[VaultDrop Server] Network: http://${localIp}:${PORT}`);
});
