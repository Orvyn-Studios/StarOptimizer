'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readDisks } = require('../src/disks.cjs');
const disk = { DeviceID: 'C:', Size: 1000, FreeSpace: 400 };

test('keeps valid CIM observations and normalizes a single disk', async () => {
  let calls = 0;
  const result = await readDisks(async () => { calls++; return disk; });
  assert.deepEqual(result, { disks: [disk], source: 'windows-cim' });
  assert.equal(calls, 1);
});

test('CIM denial falls back to actual DriveInfo observations without inventing space', async () => {
  let calls = 0;
  const result = await readDisks(async () => {
    if (++calls === 1) throw Error('CIM access denied');
    return [disk, { DeviceID: 'D:', Size: 2000, FreeSpace: 0 }];
  });
  assert.equal(calls, 2); assert.equal(result.source, 'windows-drive-info');
  assert.deepEqual(result.disks, [disk, { DeviceID: 'D:', Size: 2000, FreeSpace: 0 }]);
});

test('invalid readings never become disk health or free-space observations', async () => {
  for (const invalid of [{}, { ...disk, Size: null }, { ...disk, FreeSpace: -1 }, { ...disk, FreeSpace: 2000 }]) {
    await assert.rejects(readDisks(async () => invalid), error => error.diagnostic.kind === 'invalid-output');
  }
  const failure = new Error('Fallback denied'); failure.diagnostic = { kind: 'access-denied', code: 'EACCES' };
  await assert.rejects(readDisks(async () => { throw failure; }), error => error === failure);
});

test('a successful empty CIM inventory stays empty without fabricating a system drive', async () => {
  let calls = 0;
  const result = await readDisks(async () => { calls++; return null; });
  assert.deepEqual(result, { disks: [], source: 'windows-cim' }); assert.equal(calls, 1);
});
