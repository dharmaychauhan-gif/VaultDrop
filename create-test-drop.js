import crypto from 'node:crypto';

function bufferToBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createDrop() {
  const message = 'SUCCESS: Zero-Knowledge End-to-End Encryption Verified on Phone! 🏆🎉';
  
  const key = crypto.randomBytes(32);
  const keyString = bufferToBase64Url(key);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertextBuffer = Buffer.concat([
    cipher.update(Buffer.from(message, 'utf8')),
    cipher.final(),
    cipher.getAuthTag()
  ]);

  const vaultId = 'vd_test_' + Date.now().toString(36);
  const ivBase64 = bufferToBase64Url(iv);
  const ciphertextBase64 = bufferToBase64Url(ciphertextBuffer);

  const payload = {
    id: vaultId,
    iv: ivBase64,
    ciphertext: ciphertextBase64,
    encryptedMetadata: JSON.stringify({ type: 'text', length: message.length }),
    hasPassphrase: 0,
    burnAfterRead: 0,
    maxDownloads: 10,
    expiresInMinutes: 120
  };

  const res = await fetch('http://localhost:3001/api/vaults/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log('Vault Created:', data.id);

  const newUrl = `http://10.149.96.22:3001/#/v/${vaultId}/${keyString}`;
  console.log('CLEAN_URL:', newUrl);
  return newUrl;
}

createDrop();
