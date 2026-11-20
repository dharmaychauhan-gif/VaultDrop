import { spawn } from 'node:child_process';

const server = spawn('node', ['server/index.js'], { stdio: 'inherit' });

setTimeout(() => {
  const test = spawn('node', ['test-vaultdrop.js'], { stdio: 'inherit' });
  test.on('exit', (code) => {
    server.kill();
    process.exit(code);
  });
}, 2000);
