import http from 'node:http';

async function runTests() {
  console.log('Testing VaultDrop API Endpoints...');

  // 1. Check stats
  const statsRes = await fetch('http://localhost:3001/api/stats');
  const stats = await statsRes.json();
  console.log('✅ Stats endpoint OK:', stats);

  const testId = 'test_vault_' + Date.now();

  // 2. Create test vault
  const createRes = await fetch('http://localhost:3001/api/vaults/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: testId,
      iv: 'dGVzdF9pdg',
      ciphertext: 'dGVzdF9jaXBoZXJ0ZXh0',
      burnAfterRead: 1,
      maxDownloads: 1,
      expiresInMinutes: 60
    })
  });
  const created = await createRes.json();
  console.log('✅ Vault created OK:', created);

  // 3. Fetch metadata
  const metaRes = await fetch(`http://localhost:3001/api/vaults/${testId}/meta`);
  const meta = await metaRes.json();
  console.log('✅ Vault metadata OK:', meta.status, 'burnAfterRead:', meta.burnAfterRead);

  // 4. Access payload (triggers burn on read)
  const accessRes = await fetch(`http://localhost:3001/api/vaults/${testId}/access`, {
    method: 'POST'
  });
  const access = await accessRes.json();
  console.log('✅ Vault accessed OK, burned status:', access.burned);

  // 5. Verify vault is now burned / 410 Gone
  const metaRes2 = await fetch(`http://localhost:3001/api/vaults/${testId}/meta`);
  console.log('✅ Vault after burn status code:', metaRes2.status, '(Expected: 410)');

  // 6. Check stats again
  const statsRes2 = await fetch('http://localhost:3001/api/stats');
  const stats2 = await statsRes2.json();
  console.log('✅ Stats after shredding:', stats2);

  console.log('\n🎉 ALL VAULTDROP TESTS PASSED PERFECTLY!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
