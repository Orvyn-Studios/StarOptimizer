const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const helper = process.env.STAROPTIMIZER_TEST_HELPER || path.join(__dirname, '..', 'src', 'native', 'StarOptimizer.System.exe');
const windows = { skip: process.platform !== 'win32' && 'Requiere Windows; se ejecuta en CI.' };
function invoke(args) {
  assert.ok(fs.existsSync(helper), 'Ejecuta npm run build:native antes de las pruebas de Windows.');
  const result = spawnSync(helper, args, { encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (result.error) throw result.error;
  return result;
}

test('compiled Windows helper returns visual state without modifying it', windows, () => {
  const result = invoke(['visual-state']);
  assert.equal(result.status, 0, result.stderr);
  const state = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(state).sort(), ['animations', 'comboAnimation', 'menuAnimation']);
  for (const value of Object.values(state)) assert.ok(value === null || typeof value === 'boolean');
});

test('compiled Windows helper rejects malformed operations without applying a change', windows, () => {
  for (const args of [[], ['cmd.exe'], ['disks & calc.exe'], ['set-visual', 'constructor', 'true'], ['set-visual', 'animations', 'TRUE'], ['set-visual', 'animations', 'false', 'extra'], ['visual-state', 'extra']]) {
    const result = invoke(args);
    assert.equal(result.status, 2, JSON.stringify(args));
    assert.equal(result.stdout.trim(), '');
  }
});

test('compiled Windows helper preserves the inventory schema used by the app', windows, () => {
  const fields = {
    disks: ['DeviceID', 'Size', 'FreeSpace'],
    startup: ['Name', 'Location'],
    gpu: ['Name', 'DriverVersion'],
    processes: ['ProcessName', 'Count', 'WorkingSet64'],
    'physical-disks': ['Name', 'Size', 'MediaType', 'HealthStatus', 'OperationalStatus']
  };
  for (const [query, keys] of Object.entries(fields)) {
    const result = invoke([query]);
    // Some VMs have no storage provider. The app must surface that as unavailable.
    if (query === 'physical-disks' && result.status === 1) {
      assert.match(result.stderr, /Windows could not complete/);
      continue;
    }
    assert.equal(result.status, 0, query + ': ' + result.stderr);
    const rows = JSON.parse(result.stdout);
    assert.ok(Array.isArray(rows), query);
    for (const row of rows) for (const key of keys) assert.ok(Object.hasOwn(row, key), query + ': ' + key);
    if (query === 'processes') {
      assert.ok(rows.length <= 30);
      for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].WorkingSet64 >= rows[i].WorkingSet64);
    }
  }
});
