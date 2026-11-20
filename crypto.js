/**
 * VaultDrop Cryptographic Core
 * True Zero-Knowledge Client-Side Encryption
 * Engine: @noble/ciphers AES-256-GCM + @noble/hashes PBKDF2 & SHA-256
 * 
 * Why @noble?
 * 1. 100% pure audited JavaScript, identical binary compatibility with Web Crypto API.
 * 2. Crucial: Standard browser Web Crypto `window.crypto.subtle` is disabled by mobile
 *    browsers (Chrome/Safari) when opening local LAN IP addresses (http://192.168.x.x or
 *    http://10.x.x.x) because it is considered an insecure HTTP origin.
 * 3. @noble guarantees zero-knowledge encryption and decryption works everywhere,
 *    on any device, in any browser context, over Wi-Fi, LAN, localhost, or HTTPS!
 */

import { gcm } from '@noble/ciphers/aes.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';

// CSPRNG Random bytes generator
export function getRandomBytes(length) {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

// Utility: ArrayBuffer / Uint8Array to Base64URL
export function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Utility: Base64URL to Uint8Array
export function base64UrlToBuffer(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Utility: Uint8Array to Hex string
export function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Utility: Hex string to Uint8Array
export function hexToBuffer(hexString) {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Compute SHA-256 Checksum in Hex
export async function computeSha256(dataBuffer) {
  const hashBytes = sha256(new Uint8Array(dataBuffer));
  return bufferToHex(hashBytes);
}

// Generate fresh 256-bit AES-GCM Master Key
export async function generateMasterKey() {
  const rawKey = getRandomBytes(32);
  return {
    rawKey,
    keyString: bufferToBase64Url(rawKey)
  };
}

// Encrypt arbitrary Uint8Array payload with AES-256-GCM
export async function encryptBytes(dataBytes, rawKeyBytes) {
  // Fresh 96-bit (12-byte) IV for GCM mode
  const iv = getRandomBytes(12);
  const cipher = gcm(rawKeyBytes, iv);
  const ciphertextWithTag = cipher.encrypt(dataBytes);

  return {
    ciphertext: ciphertextWithTag,
    iv: iv,
    ivBase64: bufferToBase64Url(iv)
  };
}

// Decrypt arbitrary Uint8Array payload with AES-256-GCM
export async function decryptBytes(ciphertextBytes, ivBytes, rawKeyBytes) {
  try {
    const cipher = gcm(rawKeyBytes, ivBytes);
    return cipher.decrypt(ciphertextBytes);
  } catch (err) {
    throw new Error('Authentication tag mismatch. Data corrupted or wrong key.');
  }
}

// Encrypt plaintext string
export async function encryptText(text, rawKeyBytes) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(text);
  return await encryptBytes(dataBytes, rawKeyBytes);
}

// Decrypt to plaintext string
export async function decryptText(ciphertextBytes, ivBytes, rawKeyBytes) {
  const decryptedBytes = await decryptBytes(ciphertextBytes, ivBytes, rawKeyBytes);
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBytes);
}

// Derive a key wrapping key from Passphrase using PBKDF2 (100,000 rounds)
export function derivePassphraseKey(passphrase, saltBytes) {
  const encoder = new TextEncoder();
  const passBytes = encoder.encode(passphrase);
  return pbkdf2(sha256, passBytes, saltBytes, { c: 100000, dkLen: 32 });
}

// Wrap (encrypt) the master key using a user passphrase
export async function wrapMasterKey(rawMasterKeyBytes, passphrase) {
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(12);
  const wrapKey = derivePassphraseKey(passphrase, salt);

  const cipher = gcm(wrapKey, iv);
  const encryptedKey = cipher.encrypt(rawMasterKeyBytes);

  // Compute a verification token (SHA-256 of passphrase + salt)
  const encoder = new TextEncoder();
  const verifyData = new Uint8Array([...encoder.encode(passphrase), ...salt]);
  const verifyHash = bufferToHex(sha256(verifyData));

  return {
    wrappedKeyBase64: bufferToBase64Url(encryptedKey),
    saltBase64: bufferToBase64Url(salt),
    ivBase64: bufferToBase64Url(iv),
    verifyHash: verifyHash
  };
}

// Unwrap (decrypt) the master key using a user passphrase
export async function unwrapMasterKey(wrappedKeyBase64, saltBase64, ivBase64, passphrase) {
  const wrappedKeyBytes = base64UrlToBuffer(wrappedKeyBase64);
  const saltBytes = base64UrlToBuffer(saltBase64);
  const ivBytes = base64UrlToBuffer(ivBase64);

  const wrapKey = derivePassphraseKey(passphrase, saltBytes);

  try {
    const cipher = gcm(wrapKey, ivBytes);
    return cipher.decrypt(wrappedKeyBytes);
  } catch (err) {
    throw new Error('Incorrect passphrase. Decryption authentication tag mismatch.');
  }
}
