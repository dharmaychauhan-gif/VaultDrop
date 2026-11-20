import React, { useState, useRef } from 'react';
import { 
  FileText, UploadCloud, Lock, Flame, Clock, KeyRound, 
  ShieldCheck, AlertTriangle, Eye, EyeOff, Sparkles, CheckCircle2,
  FileCode, Terminal, X, ArrowRight, ShieldAlert, Cpu
} from 'lucide-react';
import { 
  generateMasterKey, 
  encryptText, 
  encryptBytes, 
  wrapMasterKey, 
  bufferToBase64Url,
  computeSha256
} from '../lib/crypto';
import { sounds } from '../lib/audio';

export default function DropCreator({ onDropCreated }) {
  const [dropType, setDropType] = useState('text'); // 'text' | 'file'
  
  // Text payload
  const [secretText, setSecretText] = useState('');
  
  // File payload
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Ephemerality settings
  const [burnAfterRead, setBurnAfterRead] = useState(true);
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [expiresInMinutes, setExpiresInMinutes] = useState(60); // 1 hour default

  // Passphrase protection
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [passphraseHint, setPassphraseHint] = useState('');

  // Processing state
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [cryptoProgress, setCryptoProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Quick templates for secret text
  const applyTemplate = (type) => {
    sounds.playCopy();
    if (type === 'api') {
      setSecretText(`OPENAI_API_KEY="sk-proj-7a98b7c..."\nSTRIPE_SECRET_KEY="sk_live_51M..."\nDATABASE_URL="postgresql://user:pass@ep-cool-db.us-east-2.aws.neon.tech/prod"`);
    } else if (type === 'ssh') {
      setSecretText(`-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn\nNhAAAAAwEAAQAAAYEAvcZ7... (redacted)\n-----END OPENSSH PRIVATE KEY-----`);
    } else if (type === 'login') {
      setSecretText(`Service: AWS Production Console\nUsername: root-admin@company.com\nTemporary Password: #k8!Xp9$Qz2@vM\nMFA Backup Code: 8931-4019-2184`);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        setErrorMessage('File size exceeds the 100MB limit.');
        return;
      }
      setSelectedFile(file);
      setErrorMessage('');
      sounds.playCopy();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        setErrorMessage('File size exceeds the 100MB limit.');
        return;
      }
      setSelectedFile(file);
      setErrorMessage('');
      sounds.playCopy();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (dropType === 'text' && !secretText.trim()) {
      setErrorMessage('Please enter secret text or confidential data to encrypt.');
      return;
    }
    if (dropType === 'file' && !selectedFile) {
      setErrorMessage('Please select a file to encrypt.');
      return;
    }
    if (hasPassphrase && !passphrase.trim()) {
      setErrorMessage('Passphrase protection is enabled. Please enter a passphrase.');
      return;
    }

    try {
      setIsEncrypting(true);
      setCryptoProgress('Generating 256-bit CSPRNG master key...');
      sounds.playEncrypt();

      // Step 1: Generate Master Key client-side (Never leaves the browser unencrypted)
      const { rawKey, keyString } = await generateMasterKey();
      const vaultId = 'vd_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4);

      let wrappedKeyBase64 = null;
      let saltBase64 = null;
      let passIvBase64 = null;
      let passVerifyHash = null;

      // Step 2: If Passphrase enabled, wrap the master key with PBKDF2 (100,000 iterations)
      if (hasPassphrase) {
        setCryptoProgress('Deriving PBKDF2 wrapping key (100,000 rounds)...');
        const wrapped = await wrapMasterKey(rawKey, passphrase);
        wrappedKeyBase64 = wrapped.wrappedKeyBase64;
        saltBase64 = wrapped.saltBase64;
        passIvBase64 = wrapped.ivBase64;
        passVerifyHash = wrapped.verifyHash;
      }

      // Step 3: Encrypt Payload
      if (dropType === 'text') {
        setCryptoProgress('Encrypting secret text with AES-256-GCM...');
        const { ciphertext, iv, ivBase64 } = await encryptText(secretText, rawKey);
        const ciphertextBase64 = bufferToBase64Url(ciphertext);

        setCryptoProgress('Sending ciphertext to zero-knowledge vault...');

        const res = await fetch('/api/vaults/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: vaultId,
            iv: ivBase64,
            ciphertext: ciphertextBase64,
            encryptedMetadata: JSON.stringify({
              type: 'text',
              length: secretText.length,
              hint: passphraseHint || null
            }),
            hasPassphrase: hasPassphrase ? 1 : 0,
            wrappedKey: wrappedKeyBase64,
            passSalt: saltBase64,
            passIv: passIvBase64,
            passVerifyHash: passVerifyHash,
            burnAfterRead: burnAfterRead ? 1 : 0,
            maxDownloads: burnAfterRead ? 1 : Number(maxDownloads),
            expiresInMinutes: Number(expiresInMinutes)
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Server rejected vault');
        }

        const data = await res.json();

        // Save to sender outbox in localStorage
        saveToOutbox({
          id: vaultId,
          type: 'text',
          name: 'Encrypted Note',
          createdAt: Date.now(),
          expiresAt: data.expiresAt,
          killToken: data.killToken,
          burnAfterRead: burnAfterRead,
          maxDownloads: burnAfterRead ? 1 : Number(maxDownloads),
          keyString: keyString,
          hasPassphrase
        });

        onDropCreated({
          id: vaultId,
          keyString: keyString,
          killToken: data.killToken,
          expiresAt: data.expiresAt,
          type: 'text',
          burnAfterRead: burnAfterRead,
          maxDownloads: burnAfterRead ? 1 : Number(maxDownloads),
          hasPassphrase
        });

      } else {
        // Encrypt File
        setCryptoProgress(`Encrypting ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB) with AES-256-GCM...`);
        
        const fileBuffer = await selectedFile.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);
        const fileSha256 = await computeSha256(fileBuffer);

        const { ciphertext, iv, ivBase64 } = await encryptBytes(fileBytes, rawKey);

        // Encrypt file metadata inside the payload wrapper
        const metadata = {
          name: selectedFile.name,
          size: selectedFile.size,
          mimeType: selectedFile.type || 'application/octet-stream',
          sha256: fileSha256,
          hint: passphraseHint || null
        };

        const formData = new FormData();
        const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });
        formData.append('encrypted_file', encryptedBlob, `${selectedFile.name}.enc`);
        formData.append('id', vaultId);
        formData.append('iv', ivBase64);
        formData.append('encryptedMetadata', JSON.stringify(metadata));
        formData.append('hasPassphrase', hasPassphrase ? '1' : '0');
        if (hasPassphrase) {
          formData.append('wrappedKey', wrappedKeyBase64);
          formData.append('passSalt', saltBase64);
          formData.append('passIv', passIvBase64);
          formData.append('passVerifyHash', passVerifyHash);
        }
        formData.append('burnAfterRead', burnAfterRead ? '1' : '0');
        formData.append('maxDownloads', burnAfterRead ? '1' : String(maxDownloads));
        formData.append('expiresInMinutes', String(expiresInMinutes));

        setCryptoProgress('Streaming encrypted binary to storage...');

        const res = await fetch('/api/vaults/file', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Server rejected file upload');
        }

        const data = await res.json();

        // Save to sender outbox in localStorage
        saveToOutbox({
          id: vaultId,
          type: 'file',
          name: selectedFile.name,
          size: selectedFile.size,
          createdAt: Date.now(),
          expiresAt: data.expiresAt,
          killToken: data.killToken,
          burnAfterRead: burnAfterRead,
          maxDownloads: burnAfterRead ? 1 : Number(maxDownloads),
          keyString: keyString,
          hasPassphrase
        });

        onDropCreated({
          id: vaultId,
          keyString: keyString,
          killToken: data.killToken,
          expiresAt: data.expiresAt,
          type: 'file',
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          burnAfterRead: burnAfterRead,
          maxDownloads: burnAfterRead ? 1 : Number(maxDownloads),
          hasPassphrase
        });
      }

    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Encryption and upload failed.');
    } finally {
      setIsEncrypting(false);
      setCryptoProgress('');
    }
  };

  const saveToOutbox = (drop) => {
    try {
      const stored = JSON.parse(localStorage.getItem('vaultdrop_outbox') || '[]');
      stored.unshift(drop);
      // keep max 50
      localStorage.setItem('vaultdrop_outbox', JSON.stringify(stored.slice(0, 50)));
    } catch (e) {
      console.error('Failed saving to outbox', e);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Title & Badge */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>RFC 3986 URL Hash Fragment Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          Encrypt & Ephemeral Drop
        </h1>
        <p className="text-slate-400 text-sm max-w-lg mx-auto">
          Share sensitive credentials, secrets, or files. Client-side encrypted with AES-256-GCM. 
          The decryption key never touches our servers.
        </p>
      </div>

      {/* Main Glass Card Form */}
      <div className="vault-glass rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glowing cyber gradient strip at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-400"></div>

        {/* Mode Selector (Text vs File) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => { setDropType('text'); sounds.playCopy(); }}
            className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
              dropType === 'text'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Secret Note / Code</span>
          </button>

          <button
            type="button"
            onClick={() => { setDropType('file'); sounds.playCopy(); }}
            className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center space-x-2 ${
              dropType === 'file'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Encrypted File Drop</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payload Area */}
          {dropType === 'text' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Confidential Payload
                </label>
                <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                  <span>Templates:</span>
                  <button 
                    type="button" 
                    onClick={() => applyTemplate('api')}
                    className="hover:text-emerald-400 text-slate-400 underline cursor-pointer"
                  >
                    API Keys
                  </button>
                  <span>•</span>
                  <button 
                    type="button" 
                    onClick={() => applyTemplate('ssh')}
                    className="hover:text-emerald-400 text-slate-400 underline cursor-pointer"
                  >
                    SSH Key
                  </button>
                  <span>•</span>
                  <button 
                    type="button" 
                    onClick={() => applyTemplate('login')}
                    className="hover:text-emerald-400 text-slate-400 underline cursor-pointer"
                  >
                    Credentials
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={secretText}
                  onChange={(e) => setSecretText(e.target.value)}
                  placeholder="Paste private keys, database connection strings, passwords, or confidential notes here..."
                  rows={7}
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-4 font-mono text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-y leading-relaxed"
                />
                <div className="absolute bottom-3 right-3 text-[11px] font-mono text-slate-500 bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                  {secretText.length} chars | {secretText.split('\n').length} lines
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                Select File to Encrypt (Up to 100MB)
              </label>

              {!selectedFile ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : 'border-slate-800 hover:border-emerald-500/50 bg-slate-950/50 hover:bg-slate-950/80'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                    <UploadCloud className="w-6 h-6 animate-pulse" />
                  </div>
                  <p className="text-sm font-medium text-slate-200 mb-1">
                    Drop your confidential file here or <span className="text-emerald-400 underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    Encrypted on-the-fly in browser memory with AES-256-GCM
                  </p>
                </div>
              ) : (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-slate-200 truncate">{selectedFile.name}</p>
                      <p className="text-xs font-mono text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Binary / Data'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); sounds.playShred(); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Ephemerality & Shredding Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Self-Destruction Policy */}
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
              <label className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Self-Destruction Trigger
              </label>

              <div className="space-y-2">
                <label className="flex items-center space-x-3 p-2 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/40 cursor-pointer">
                  <input
                    type="radio"
                    name="burnPolicy"
                    checked={burnAfterRead}
                    onChange={() => { setBurnAfterRead(true); setMaxDownloads(1); }}
                    className="text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                      🔥 Burn on 1st Read
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Shredded immediately once recipient unlocks it
                    </p>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-2 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/40 cursor-pointer">
                  <input
                    type="radio"
                    name="burnPolicy"
                    checked={!burnAfterRead}
                    onChange={() => setBurnAfterRead(false)}
                    className="text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-slate-200">
                      Custom Download Limit
                    </span>
                    {!burnAfterRead && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {[2, 3, 5, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setMaxDownloads(num)}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                              maxDownloads === num
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            {num}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Expiration Timer */}
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
              <label className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Time Expiration Limit
              </label>

              <select
                value={expiresInMinutes}
                onChange={(e) => setExpiresInMinutes(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value={5}>5 Minutes (Ultra Ephemeral)</option>
                <option value={15}>15 Minutes</option>
                <option value={60}>1 Hour (Standard)</option>
                <option value={360}>6 Hours</option>
                <option value={1440}>24 Hours (1 Day)</option>
                <option value={4320}>3 Days</option>
                <option value={10080}>7 Days (Maximum)</option>
              </select>

              <p className="text-[11px] text-slate-400 mt-2 font-mono">
                Auto-shred daemon securely deletes the vault upon expiry even if never opened.
              </p>
            </div>
          </div>

          {/* Passphrase Lock Section */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-200">Additional Passphrase Lock</span>
                  <p className="text-[11px] text-slate-400">Wraps master key with PBKDF2 (100k rounds) + password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHasPassphrase(!hasPassphrase)}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  hasPassphrase ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                    hasPassphrase ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {hasPassphrase && (
              <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter secret passphrase..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 pr-9 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <input
                  type="text"
                  value={passphraseHint}
                  onChange={(e) => setPassphraseHint(e.target.value)}
                  placeholder="Optional hint for recipient (e.g. your dog's name)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Crypto status progress */}
          {isEncrypting && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center space-x-2.5">
              <Cpu className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
              <span>{cryptoProgress}</span>
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isEncrypting}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 group cursor-pointer"
          >
            <Lock className="w-4 h-4 text-slate-950" />
            <span>{isEncrypting ? 'Encrypting with Web Crypto...' : 'Encrypt & Create Vault Drop'}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        {/* Security Footnote */}
        <div className="mt-6 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 gap-2">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            E2E Cipher: AES-256-GCM (128-bit Tag)
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            Key stays in URL Hash #fragment
          </span>
          <span className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            DoD 5220.22-M Shredding
          </span>
        </div>
      </div>
    </div>
  );
}
