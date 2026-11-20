# 🛡️ VaultDrop — Zero-Knowledge Encrypted Ephemeral Sharing SaaS

> **Self-Destructing, Zero-Knowledge Encrypted Files & Secret Notes Sharing Platform.**

VaultDrop is an enterprise-grade, zero-knowledge secret-sharing platform designed for sharing confidential credentials, API keys, private certificates, and sensitive files.

---

## ⚡ Core Value Proposition & Architecture

Most "secret sharing" tools transmit passwords or encryption keys to backend servers. **VaultDrop guarantees true Zero-Knowledge security:**

```
                  ┌──────────────────────────────────────────────┐
                  │                 SENDER BROWSER               │
                  │  1. Plaintext + Files in memory              │
                  │  2. CSPRNG 256-bit Key Generated Locally     │
                  │  3. Encrypted via AES-256-GCM (Web Crypto)   │
                  └──────────────┬───────────────────────────────┘
                                 │
                   Ciphertext    │        Decryption Key
                 (Uploaded to    │     (Appended to URL Hash:
                   Server)       │      #drop=XYZ&k=MASTER_KEY)
                                 │                 │
                                 ▼                 │
                  ┌────────────────────────┐       │
                  │    VAULTDROP SERVER    │       │
                  │  • Blind Ciphertext    │       │
                  │  • NO DECRYPTION KEY   │       │
                  │  • Auto-Shred Timer    │       │
                  └──────────────┬─────────┘       │
                                 │                 │
                                 ▼                 │
                  ┌────────────────────────────────┴─────────────┐
                  │                RECIPIENT BROWSER             │
                  │  1. Downloads blind ciphertext blob          │
                  │  2. Reads master key from URL Hash Fragment   │
                  │  3. Decrypts locally in memory via Web Crypto│
                  │  4. Triggers server-side DoD 5220.22-M Shred │
                  └──────────────────────────────────────────────┘
```

### 🔒 Zero-Knowledge Cryptographic Pillars
1. **RFC 3986 URL Hash Fragment Guarantee**:
   - The master key is placed strictly in the URL hash fragment (`#drop=...&k=...`).
   - By universal W3C/IETF HTTP standard (RFC 3986), web browsers **never** transmit hash fragments in HTTP request headers. The server, ISPs, and CDNs physically never receive the key.
2. **AES-256-GCM (Galois/Counter Mode)**:
   - Authenticated encryption with 128-bit authentication tags to prevent any tampering or bit-flipping attacks.
   - Fresh 96-bit (12-byte) CSPRNG initialization vector (IV) per encryption.
3. **PBKDF2-HMAC-SHA256 Passphrase Hardening**:
   - Optional password lock derives a key using 100,000 PBKDF2 iterations and a fresh 16-byte cryptographic salt.
4. **DoD 5220.22-M Compliant Secure Shredding**:
   - When a vault is burned, expired, or revoked, disk sectors are overwritten with cryptographic random bytes, followed by zeros, flushed to hardware media (`fsync`), and unlinked.

---

## 🚀 Key Features

- **Dual Mode**: Encrypt secret notes/code snippets or confidential binary files (up to 100MB).
- **Ephemeral Destruction Triggers**:
  - 🔥 **Burn on 1st Read**: Self-destructs immediately upon opening.
  - 🔢 **Custom Download Limit**: Destroy after exactly 1, 3, 5, or 10 downloads.
  - ⏳ **Time-Based Expiration**: Automatic background garbage collector shreds drops after 5m, 1h, 24h, or 7 days.
- **Emergency Sender Kill Switch**:
  - Every drop generates a secret `killToken` allowing the sender to revoke and shred the drop at any time.
- **Sender Outbox Dashboard**:
  - Local-first tracker showing active vaults, download counts, and real-time status without requiring an account.
- **Mobile QR Code Generation**:
  - Instant client-side QR codes for sharing drops to mobile devices.
- **Interactive Cryptography Sandbox**:
  - Built-in audit explainer and live testing playground demonstrating client-side cryptographic isolation.
- **Synthesized Cyber Audio**:
  - Built-in Web Audio API sound synthesis for futuristic lock, unlock, and shred sound effects.

---

## 🛠️ Quick Start

### ⚡ 1-Click Launchers (Windows)
Aap bina terminal open kiye seedha double-click kar sakte hain:
- **`RUN_APP.bat`**: Double-click to start VaultDrop and auto-open browser at `http://localhost:3001`!
- **`RUN_TESTS.bat`**: Double-click to run the automated test suite!
- **`RUN_DEV.bat`**: Double-click for development mode with Vite live hot-reload!

---

### Terminal Commands (Alternative)
Run both backend Express server and Vite React client concurrently:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Production Mode
Build the optimized React client and serve everything from the unified Express server:
```bash
npm run build
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

### 4. Run Automated Test Suite
```bash
npm test
```

---

## 📂 Project Structure

```
VaultDrop/
├── client/                     # Frontend (Vite + React + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Header with live shredder ticker & audio toggle
│   │   │   ├── DropCreator.jsx     # Main encryption form (text/file, ephemerality)
│   │   │   ├── DropSuccess.jsx     # Drop link, QR code, and Kill Switch
│   │   │   ├── DropViewer.jsx      # Recipient unlock & client decryption engine
│   │   │   ├── MyDrops.jsx         # Sender Outbox & revocation manager
│   │   │   └── AuditExplainer.jsx  # Zero-knowledge visualizer & live crypto sandbox
│   │   ├── lib/
│   │   │   ├── crypto.js           # Web Crypto API (AES-256-GCM, PBKDF2, Base64URL)
│   │   │   └── audio.js            # Web Audio API sound synthesizer
│   │   ├── App.jsx                 # URL router & hash parser
│   │   └── index.css               # Obsidian & Cyberpunk Tailwind design system
│   └── vite.config.js
├── server/                     # Backend API & Shredder
│   ├── db.js                   # Native SQLite database (node:sqlite)
│   ├── shredder.js             # DoD 5220.22-M disk overwrite engine
│   ├── cleanup.js              # Automated garbage collection daemon
│   └── index.js                # Express REST API endpoints & static server
├── package.json
└── README.md
```

---

## 📜 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/vaults/text` | Upload encrypted text ciphertext |
| `POST` | `/api/vaults/file` | Multipart upload for encrypted file blob |
| `GET` | `/api/vaults/:id/meta` | Get public metadata (type, cipher, expiresAt, status) |
| `POST` | `/api/vaults/:id/access` | Access text ciphertext (triggers burn-on-read) |
| `GET` | `/api/vaults/:id/download` | Stream encrypted binary blob (triggers burn-on-read) |
| `POST` | `/api/vaults/:id/revoke` | Emergency shred using sender `killToken` |
| `GET` | `/api/vaults/:id/status` | Real-time status for Sender Outbox |
| `GET` | `/api/stats` | Global shredded vaults counter |

---

## 🔒 Security Principles

- **Zero Plaintext on Wire**: Neither the plaintext message nor the unencrypted file ever touches the network.
- **Zero Master Keys on Server**: Master keys live only in memory and the URL hash fragment `#k=...`.
- **Ephemeral Storage**: All storage is temporary; shredded files cannot be recovered.
