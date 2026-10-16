'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execute, parsePowerShellJson } = require('../src/windows-command.cjs');

test('empty successful PowerShell inventories are empty, not failed readings', () => {
  for (const output of ['', ' \r\n', '\uFEFF\r\n', 'null']) assert.equal(parsePowerShellJson(output), null);
  assert.deepEqual(parsePowerShellJson('[]'), []);
  assert.deepEqual(parsePowerShellJson('\uFEFF {"Name":"Aplicación"}\r\n'), { Name: 'Aplicación' });
  assert.throws(() => parsePowerShellJson('WARNING: not JSON'), error => error.diagnostic.kind === 'invalid-output');
});

test('real child process output is trimmed and interpreted as Unicode JSON', async () => {
  const output = await execute(process.execPath, ['-e', 'process.stdout.write(JSON.stringify({Name:"Aplicación"}) + "\\r\\n")']);
  assert.deepEqual(parsePowerShellJson(output), { Name: 'Aplicación' });
});

test('real command failures preserve denial codes without leaking stderr or arguments', async () => {
  await assert.rejects(execute(process.execPath, ['-e', 'console.error("private-host-path HRESULT 0x80041003"); process.exit(1)']), error => {
    assert.deepEqual(error.diagnostic, { kind: 'access-denied', code: '0X80041003' });
    assert.doesNotMatch(JSON.stringify(error), /private-host-path|process\.exit/);
    assert.match(error.message, /denegó/);
    return true;
  });
  await assert.rejects(execute(process.execPath, ['-e', 'process.exit(7)']), error => {
    assert.deepEqual(error.diagnostic, { kind: 'command-failed', code: 7 });
    return true;
  });
});
