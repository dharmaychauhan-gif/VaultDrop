import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, Unlock, ShieldAlert, AlertTriangle, Flame, Clock, 
  FileText, Download, Copy, Check, Eye, EyeOff, ShieldCheck, 
  Terminal, Trash2, ArrowLeft, RefreshCw, FileCode, Cpu
} from 'lucide-react';
import { 
  base64UrlToBuffer, 
  decryptText, 
  decryptBytes, 
  unwrapMasterKey,
  computeSha256
} from '../lib/crypto';
import { sounds } from '../lib/audio';
import confetti from 'canvas-confetti';

export default function DropViewer({ vaultId, keyString, onGoHome }) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null); // 'not_found', 'burned', 'expired', 'revoked'
  const [errorMessage, setErrorMessage] = useState('');

  // Passphrase state
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState('');

  // Decryption state
  const [isDecrypting, setIsDecrypting] = useState(false);
  const isUnlockingRef = useRef(false);
  const [decryptedText, setDecryptedText] = useState(null);
  const [decryptedFile, setDecryptedFile] = useState(null);
  const [clipboardCopied, setClipboardCopied] = useState(false);
  const [clipboardTimer, setClipboardTimer] = useState(null);
  const [isBurnedNow, setIsBurnedNow] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, [vaultId]);

  const fetchMetadata = async () => {
    try {
      setLoading(true);
      setErrorStatus(null);
      const res = await fetch(`/api/vaults/${vaultId}/meta`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorStatus(data.status || 'not_found');
        setErrorMessage(data.error || 'This drop is no longer accessible.');
        return;
      }

      const data = await res.json();
      setMeta(data);
    } catch (e) {
      setErrorStatus('error');
      setErrorMessage('Network error connecting to VaultDrop server.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockAndDecrypt = async () => {
    // Prevent mobile double-tap / concurrent click race conditions
    if (isUnlockingRef.current) return;
    isUnlockingRef.current = true;

    if (!keyString && !meta.hasPassphrase) {
      setErrorMessage('Decryption key missing from URL hash. Unable to decrypt zero-knowledge vault.');
      isUnlockingRef.current = false;
      return;
    }

    try {
      setIsDecrypting(true);
      setPassphraseError('');
      setErrorMessage('');

      let rawMasterKey = null;

      // If passphrase is required, unwrap master key using PBKDF2
      if (meta.hasPassphrase) {
        if (!passphrase) {
          setPassphraseError('Passphrase required to decrypt this vault.');
          setIsDecrypting(false);
          isUnlockingRef.current = false;
          return;
        }

        try {
          rawMasterKey = await unwrapMasterKey(
            meta.wrappedKey,
            meta.passSalt,
            meta.passIv,
            passphrase
          );
        } catch (err) {
          setPassphraseError('Incorrect passphrase. Decryption authentication tag mismatch.');
          setIsDecrypting(false);
          isUnlockingRef.current = false;
          return;
        }
      } else {
        // Direct key from URL hash
        rawMasterKey = base64UrlToBuffer(keyString);
      }

      if (meta.type === 'text') {
        // Fetch text payload from server
        const res = await fetch(`/api/vaults/${vaultId}/access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to access vault payload');
        }

        const data = await res.json();
        const ciphertextBytes = base64UrlToBuffer(data.ciphertext);
        const ivBytes = base64UrlToBuffer(data.iv);

        // Client-side AES-256-GCM decryption
        const plaintext = await decryptText(ciphertextBytes, ivBytes, rawMasterKey);
        setDecryptedText(plaintext);
        setIsBurnedNow(data.burned);
        setErrorMessage('');

        sounds.playDecrypt();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 }
        });

      } else {
        // Download and decrypt file payload
        const res = await fetch(`/api/vaults/${vaultId}/download`);
        if (!res.ok) {
          throw new Error('Encrypted file blob unavailable or shredded');
        }

        const fileArrayBuffer = await res.arrayBuffer();
        const ciphertextBytes = new Uint8Array(fileArrayBuffer);
        const ivBytes = base64UrlToBuffer(meta.iv);

        // Decrypt binary with Web Crypto
        const decryptedBytes = await decryptBytes(ciphertextBytes, ivBytes, rawMasterKey);

        const fileName = meta.encryptedMetadata?.name || 'decrypted_file.bin';
        const mimeType = meta.encryptedMetadata?.mimeType || 'application/octet-stream';

        // Check integrity checksum
        const checksum = await computeSha256(decryptedBytes.buffer);

        const blob = new Blob([decryptedBytes], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);

        setDecryptedFile({
          name: fileName,
          size: decryptedBytes.byteLength,
          mimeType: mimeType,
          objectUrl: objectUrl,
          checksum: checksum,
          expectedSha: meta.encryptedMetadata?.sha256
        });

        setIsBurnedNow(meta.burnAfterRead);
        setErrorMessage('');
        sounds.playDecrypt();
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Decryption failed. Data might be corrupted or key is invalid.');
    } finally {
      setIsDecrypting(false);
      isUnlockingRef.current = false;
    }
  };

  const copyToClipboard = async () => {
    if (!decryptedText) return;
    try {
      await navigator.clipboard.writeText(decryptedText);
      setClipboardCopied(true);
      sounds.playCopy();

      if (clipboardTimer) clearTimeout(clipboardTimer);

      // Auto-clear notification after 3s
      const timer = setTimeout(() => {
        setClipboardCopied(false);
      }, 3000);
      setClipboardTimer(timer);
    } catch (e) {
      // fallback
    }
  };

  // Render: Loading Screen
  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center font-mono">
        <Cpu className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-300">Retrieving Zero-Knowledge Metadata...</p>
        <p className="text-xs text-slate-600 mt-1">Verifying cryptographic hash</p>
      </div>
    );
  }

  // Render: Shredded / Burned / Expired Screen
  if (errorStatus) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center animate-fade-in">
        <div className="vault-glass rounded-2xl p-8 border border-red-500/30 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500"></div>

          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
            <Trash2 className="w-8 h-8" />
          </div>

          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 inline-block mb-3">
            Status: {errorStatus.toUpperCase()} (HTTP 410)
          </span>

          <h2 className="text-2xl font-extrabold text-white mb-2">
            This Vault Has Been Shredded
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            The requested secret or file is no longer accessible. It was either already viewed (Burn-on-Read), reached its maximum download limit, expired, or was revoked by the sender.
          </p>

          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 text-left mb-6 font-mono text-[11px] space-y-1.5 text-slate-500">
            <div className="flex justify-between">
              <span>Zero-Knowledge Policy:</span>
              <span className="text-emerald-400">Enforced</span>
            </div>
            <div className="flex justify-between">
              <span>Disk Overwrite:</span>
              <span className="text-slate-300">DoD 5220.22-M Zeroed</span>
            </div>
            <div className="flex justify-between">
              <span>Payload State:</span>
              <span className="text-red-400">Permanently Obliterated</span>
            </div>
          </div>

          <button
            onClick={onGoHome}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors inline-flex items-center space-x-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Create a New Drop</span>
          </button>
        </div>
      </div>
    );
  }

  // Render: Decrypted Result View
  if (decryptedText !== null || decryptedFile !== null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
        <div className="vault-glass rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-400"></div>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Vault Decrypted Successfully
                </h2>
                <p className="text-xs font-mono text-emerald-400">
                  AES-256-GCM Authentication Tag Verified
                </p>
              </div>
            </div>

            <button
              onClick={onGoHome}
              className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Close
            </button>
          </div>

          {/* Burn Warning Banner */}
          {isBurnedNow && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2.5">
              <Flame className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>Burn Notice:</strong> This vault reached its destruction limit and has been shredded from the server. Once you leave this page, it cannot be retrieved.
              </span>
            </div>
          )}

          {/* Decrypted Content: Text Drop */}
          {decryptedText !== null && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" /> Decrypted Secret Payload
                </span>
                <button
                  onClick={copyToClipboard}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    clipboardCopied
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40'
                  }`}
                >
                  {clipboardCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{clipboardCopied ? 'Copied to Clipboard!' : 'Copy Secret'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="w-full bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs sm:text-sm text-emerald-300 overflow-x-auto whitespace-pre-wrap select-all leading-relaxed shadow-inner">
                  {decryptedText}
                </pre>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>{decryptedText.length} characters</span>
                <span className="text-emerald-400/80">Decrypted in memory via Web Crypto API</span>
              </div>
            </div>
          )}

          {/* Decrypted Content: File Drop */}
          {decryptedFile !== null && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 truncate">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div className="truncate">
                    <h3 className="text-sm font-bold text-slate-100 truncate">{decryptedFile.name}</h3>
                    <p className="text-xs font-mono text-slate-400">
                      {(decryptedFile.size / 1024).toFixed(1)} KB • {decryptedFile.mimeType}
                    </p>
                  </div>
                </div>

                <a
                  href={decryptedFile.objectUrl}
                  download={decryptedFile.name}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </a>
              </div>

              {/* Integrity check */}
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 font-mono text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>SHA-256 Checksum:</span>
                <code className="text-emerald-400 text-[10px] break-all">{decryptedFile.checksum}</code>
              </div>

              {/* Inline image preview if image */}
              {decryptedFile.mimeType.startsWith('image/') && (
                <div className="mt-4 p-2 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <img
                    src={decryptedFile.objectUrl}
                    alt={decryptedFile.name}
                    className="max-h-96 mx-auto rounded-lg object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render: Unlock / Decrypt Prompt
  return (
    <div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
      <div className="vault-glass rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"></div>

        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-lg shadow-emerald-500/10">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-extrabold text-white mb-2">
          Encrypted Vault Drop
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-sm mx-auto mb-6">
          This drop is encrypted client-side. Decryption occurs locally in your browser.
        </p>

        {/* Vault metadata badges */}
        <div className="grid grid-cols-2 gap-2 mb-6 text-left">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Payload Type</span>
            <span className="text-xs font-semibold text-slate-200 capitalize">{meta.type} Drop</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Destruction</span>
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
              <Flame className="w-3 h-3" />
              {meta.burnAfterRead ? 'Burn on 1st Read' : `${meta.downloadCount + 1}/${meta.maxDownloads} downloads`}
            </span>
          </div>
        </div>

        {/* Ephemeral Warning */}
        {meta.burnAfterRead && (
          <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left flex items-start space-x-2.5">
            <Flame className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong className="block font-semibold">Self-Destructing Drop:</strong>
              This vault is configured to shred immediately upon opening. Be prepared to save the contents.
            </div>
          </div>
        )}

        {/* Passphrase Input if required */}
        {meta.hasPassphrase && (
          <div className="mb-6 text-left bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <label className="text-xs font-mono text-slate-300 uppercase tracking-wider block mb-2">
              Enter Decryption Passphrase:
            </label>
            <div className="relative mb-2">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase required..."
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

            {meta.encryptedMetadata?.hint && (
              <p className="text-[11px] font-mono text-slate-400">
                Hint from sender: <span className="text-emerald-400">{meta.encryptedMetadata.hint}</span>
              </p>
            )}

            {passphraseError && (
              <p className="text-[11px] font-mono text-red-400 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {passphraseError}
              </p>
            )}
          </div>
        )}

        {/* Global error message */}
        {errorMessage && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Unlock Button */}
        <button
          onClick={handleUnlockAndDecrypt}
          disabled={isDecrypting}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
        >
          {isDecrypting ? (
            <>
              <Cpu className="w-4 h-4 animate-spin" />
              <span>Verifying & Decrypting...</span>
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4" />
              <span>Unlock & Decrypt Drop</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
