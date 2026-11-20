import React, { useState } from 'react';
import { 
  ShieldCheck, Lock, Terminal, FileCode, CheckCircle, 
  Flame, Key, AlertTriangle, ArrowRight, Play, Cpu, Sparkles 
} from 'lucide-react';
import { 
  generateMasterKey, 
  encryptText, 
  decryptText, 
  bufferToBase64Url, 
  bufferToHex,
  computeSha256 
} from '../lib/crypto';
import { sounds } from '../lib/audio';

export default function AuditExplainer() {
  // Interactive Live Cryptography Playground
  const [testPlaintext, setTestPlaintext] = useState('SuperSecretAPIKey_9823419082');
  const [cryptoLog, setCryptoLog] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const runLiveCryptoDemo = async () => {
    try {
      setIsRunning(true);
      sounds.playEncrypt();

      const log = [];
      log.push('1. [Browser CSPRNG] Calling window.crypto.getRandomValues(32)...');
      const { rawKey, keyString } = await generateMasterKey();
      log.push(`   -> Master Key generated: ${keyString.substring(0, 16)}... (256 bits)`);

      log.push('2. [AES-256-GCM] Generating 96-bit Initialization Vector (IV)...');
      const { ciphertext, iv, ivBase64 } = await encryptText(testPlaintext, rawKey);
      log.push(`   -> IV (Hex): ${bufferToHex(iv)}`);
      log.push(`   -> Ciphertext (Base64URL): ${bufferToBase64Url(ciphertext)}`);

      log.push('3. [RFC 3986 Spec] URL Hash Fragment Isolation:');
      log.push(`   -> Share URL: https://vaultdrop.io/#drop=test&k=${keyString}`);
      log.push('   -> The string after "#" is never sent in HTTP request headers.');

      log.push('4. [Client Decryption] Simulating recipient browser decryption...');
      const decrypted = await decryptText(ciphertext, iv, rawKey);
      log.push(`   -> Decrypted output: "${decrypted}"`);
      log.push('5. [Integrity Check] 128-bit GCM Auth Tag: VERIFIED');

      setCryptoLog({
        steps: log,
        key: keyString,
        iv: bufferToHex(iv),
        ciphertextHex: bufferToHex(ciphertext),
        decrypted: decrypted
      });

      sounds.playDecrypt();
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-10">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Cryptographic Architecture & Transparency</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">
          How Zero-Knowledge Works
        </h1>
        <p className="text-slate-400 text-sm">
          Why our servers, your ISP, and third-party sniffers can physically never read your drops.
        </p>
      </div>

      {/* The 4 Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1 */}
        <div className="vault-glass rounded-xl p-5 border border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">1. Client-Side AES-256-GCM</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All encryption is executed inside your browser using the native Web Crypto API (`window.crypto.subtle`). 
            Plaintext data is converted to encrypted ciphertext before any network packet leaves your machine.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="vault-glass rounded-xl p-5 border border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
            <Terminal className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">2. RFC 3986 URL Hash Fragment</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Decryption keys are placed after the URL `#` hash fragment. By universal internet standard (RFC 3986), web browsers NEVER send fragment identifiers in HTTP request headers. The server never sees the key.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="vault-glass rounded-xl p-5 border border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <Key className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">3. PBKDF2 Key Derivation</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            When optional password protection is enabled, a secondary wrapping key is derived using 100,000 iterations of PBKDF2-HMAC-SHA256 with a unique 16-byte cryptographic salt to prevent rainbow-table and brute-force attacks.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="vault-glass rounded-xl p-5 border border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
            <Flame className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">4. Multi-Pass Secure Shredding</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Upon trigger (1st read, max downloads reached, or timer expiration), the file blob is overwritten with random cryptographic bytes, overwritten with zeroes, and unlinked, preventing disk forensic recovery.
          </p>
        </div>
      </div>

      {/* Live Interactive Cryptography Playground */}
      <div className="vault-glass rounded-2xl p-6 sm:p-8 border border-emerald-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-2">
          <Sparkles className="w-4 h-4" />
          <span>Interactive Cryptography Sandbox</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          Verify Web Crypto Execution in Your Browser
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Test client-side AES-256-GCM encryption in real-time. Notice how your browser executes the entire cryptographic pipeline locally.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={testPlaintext}
            onChange={(e) => setTestPlaintext(e.target.value)}
            placeholder="Type confidential test string..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={runLiveCryptoDemo}
            disabled={isRunning}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 shrink-0 shadow-lg shadow-emerald-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunning ? 'Encrypting...' : 'Run Live Encryption'}</span>
          </button>
        </div>

        {cryptoLog && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 space-y-1.5 overflow-x-auto leading-relaxed shadow-inner">
            {cryptoLog.steps.map((step, idx) => (
              <div key={idx} className={step.startsWith('   ->') ? 'text-slate-400 pl-4' : 'text-emerald-400 font-bold'}>
                {step}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
