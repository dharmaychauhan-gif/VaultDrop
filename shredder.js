import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * Securely overwrites a file with random bytes before unlinking.
 * Protects against disk forensic recovery.
 */
export function secureShredFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  try {
    const stats = fs.statSync(filePath);
    const size = stats.size;

    if (size > 0) {
      // Pass 1: Overwrite with cryptographic random bytes
      const fd = fs.openSync(filePath, 'r+');
      const chunkSize = 64 * 1024; // 64KB chunks
      let bytesWritten = 0;

      while (bytesWritten < size) {
        const currentChunk = Math.min(chunkSize, size - bytesWritten);
        const randomBytes = crypto.randomBytes(currentChunk);
        fs.writeSync(fd, randomBytes, 0, currentChunk, bytesWritten);
        bytesWritten += currentChunk;
      }

      fs.fsyncSync(fd);

      // Pass 2: Overwrite with zeros
      const zeroBuffer = Buffer.alloc(Math.min(chunkSize, size));
      bytesWritten = 0;
      while (bytesWritten < size) {
        const currentChunk = Math.min(chunkSize, size - bytesWritten);
        fs.writeSync(fd, zeroBuffer, 0, currentChunk, bytesWritten);
        bytesWritten += currentChunk;
      }

      fs.fsyncSync(fd);
      fs.closeSync(fd);
    }

    // Finally remove file entry from filesystem
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`[VaultDrop Shredder] Error shredding file ${filePath}:`, err.message);
    // Fallback standard unlink
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      // ignore
    }
  }
}
