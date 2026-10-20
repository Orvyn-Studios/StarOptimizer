const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createWindowsBridge } = require('../src/windows-bridge.cjs');

test('Windows bridge uses the unpacked helper and separate arguments for paths with spaces', async () => {
  const calls = [];
  const directory = path.join(path.parse(process.cwd()).root, 'Apps con espacios', 'app.asar', 'src');
  const bridge = createWindowsBridge(async (file, args) => { calls.push({ file, args }); return '[{"Name":"Disco ñ"}]'; }, directory);
  assert.deepEqual(await bridge.query('physical-disks'), [{ Name: 'Disco ñ' }]);
  assert.equal(calls[0].file, path.join(path.parse(process.cwd()).root, 'Apps con espacios', 'app.asar.unpacked', 'src', 'native', 'StarOptimizer.System.exe'));
  assert.deepEqual(calls[0].args, ['physical-disks']);
});

test('Windows bridge rejects arbitrary commands and invalid changes before launching a process', async () => {
  let calls = 0;
  const bridge = createWindowsBridge(async () => { calls++; return 'true'; });
  for (const query of ['cmd.exe', 'disks & calc.exe', '', '__proto__', null]) await assert.rejects(bridge.query(query));
  for (const [key, value] of [['power', false], ['constructor', true], ['animations', 'false'], ['menuAnimation', 0], ['comboAnimation', null]])
    await assert.rejects(bridge.setVisual(key, value));
  assert.equal(calls, 0);
});

test('Windows bridge accepts boolean visual changes and requires confirmation', async () => {
  const calls = [];
  const bridge = createWindowsBridge(async (file, args) => { calls.push(args); return 'true'; });
  await bridge.setVisual('animations', false);
  await bridge.setVisual('comboAnimation', true);
  assert.deepEqual(calls, [['set-visual', 'animations', 'false'], ['set-visual', 'comboAnimation', 'true']]);
  for (const response of ['false', 'null', '{}', '"true"', 'invalid JSON']) {
    const failed = createWindowsBridge(async () => response);
    await assert.rejects(failed.setVisual('menuAnimation', false));
  }
});

test('missing, blocked, failed helpers and invalid JSON remain errors without a script fallback', async () => {
  for (const code of ['ENOENT', 'EACCES', 'EPERM']) {
    const error = Object.assign(new Error('Helper unavailable'), { code });
    const bridge = createWindowsBridge(async () => { throw error; });
    await assert.rejects(bridge.query('visual-state'), e => e === error);
    await assert.rejects(bridge.setVisual('animations', false), e => e === error);
  }
  const bridge = createWindowsBridge(async () => 'broken JSON');
  await assert.rejects(bridge.query('disks'), SyntaxError);
});
