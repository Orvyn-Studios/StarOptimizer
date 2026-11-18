'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const t = require('../src/tools.cjs');

test('device classification uses chassis, system type and battery', () => {
  assert.equal(t.classifyDevice({ chassis: [10], hasBattery: true }), 'laptop');
  assert.equal(t.classifyDevice({ chassis: [3], hasBattery: false }), 'desktop');
  assert.equal(t.classifyDevice({ chassis: [3], hasBattery: true }), 'laptop', 'a battery means it can run unplugged');
  assert.equal(t.classifyDevice({ chassis: [2], pcSystemType: 2 }), 'laptop');
  assert.equal(t.classifyDevice({ chassis: [2] }), null, 'unknown stays unknown instead of guessing');
});

test('battery report parsing computes health and rejects missing capacities', () => {
  const xml = '<BatteryReport><Batteries><Battery><Id>ACME 1</Id><DesignCapacity>50000</DesignCapacity><FullChargeCapacity>41000</FullChargeCapacity><CycleCount>312</CycleCount></Battery><Battery><Id>Broken</Id><DesignCapacity>0</DesignCapacity><FullChargeCapacity>0</FullChargeCapacity></Battery></Batteries></BatteryReport>';
  assert.deepEqual(t.parseBatteryReport(xml), [{ name: 'ACME 1', design: 50000, full: 41000, cycles: 312, health: 82 }]);
  assert.deepEqual(t.parseBatteryReport('<x/>'), []);
});

test('StartupApproved flags: even bytes enabled, odd disabled, missing enabled', () => {
  assert.equal(t.startupEnabled(null), true);
  assert.equal(t.startupEnabled(2), true); assert.equal(t.startupEnabled(6), true);
  assert.equal(t.startupEnabled(3), false); assert.equal(t.startupEnabled(7), false);
});

test('startup changes only target listed apps and pass names safely encoded', async () => {
  const scripts = []; let flag = 2;
  const run = async script => {
    scripts.push(script);
    if (script.includes('Set-ItemProperty')) { flag = script.includes('@(3,0,0,0)') ? 3 : 2; return true; }
    return [{ Name: "App'; Remove-Item C:\\ -Recurse #", Command: 'x.exe', Flag: flag }];
  };
  await assert.rejects(t.setStartup('Other', false, run), /ya no está/);
  const name = "App'; Remove-Item C:\\ -Recurse #";
  const updated = await t.setStartup(name, false, run);
  assert.equal(updated.enabled, false);
  const write = scripts.find(s => s.includes('Set-ItemProperty'));
  assert.ok(!write.includes('Remove-Item'), 'the raw name never reaches the script text');
  assert.ok(!write.includes('New-Item -Path') || write.includes('Test-Path'), 'never recreates the key with -Force');
  assert.ok(!/New-Item[^;]*-Force/.test(write));
  await assert.rejects(t.setStartup('', true, run)); await assert.rejects(t.setStartup(name, 'no', run));
});

test('toggles adapter merges registry preferences and routes writes', async () => {
  const base = { snapshot: async () => ({ plans: [], values: { power: null, animations: true } }), set: async (k, v) => calls.push(['base', k, v]) };
  const calls = [];
  const run = async script => script.includes('Set-ItemProperty') ? (calls.push(['reg', script.includes('-Value 0') ? 0 : 1]), true) : { transparency: true, gameMode: null };
  const adapter = t.extendAdapter(base, run);
  const state = await adapter.snapshot();
  assert.deepEqual(state.values, { power: null, animations: true, transparency: true, gameMode: true, gameCapture: true, windowsTips: true, backgroundApps: true });
  assert.deepEqual(state.unavailable, ['power']);
  await adapter.set('transparency', false); await adapter.set('animations', false);
  assert.deepEqual(calls, [['reg', 0], ['base', 'animations', false]]);
});

test('cleanup walk skips recent temp files and never leaves the root', async t2 => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'star-clean-'));
  t2.after(() => fs.rm(root, { recursive: true, force: true }));
  const temp = path.join(root, 'Temp'); const outside = path.join(root, 'Keep');
  await fs.mkdir(path.join(temp, 'sub'), { recursive: true }); await fs.mkdir(outside);
  await fs.writeFile(path.join(temp, 'old.tmp'), 'x'.repeat(100));
  await fs.writeFile(path.join(temp, 'sub', 'old2.tmp'), 'x'.repeat(50));
  await fs.writeFile(path.join(temp, 'new.tmp'), 'fresh');
  await fs.writeFile(path.join(outside, 'precious.txt'), 'keep me');
  const old = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  await fs.utimes(path.join(temp, 'old.tmp'), old, old); await fs.utimes(path.join(temp, 'sub', 'old2.tmp'), old, old);
  try { await fs.symlink(outside, path.join(temp, 'link'), 'junction'); } catch { /* Links may be unavailable. */ }
  const env = { TEMP: temp, LOCALAPPDATA: path.join(root, 'none'), APPDATA: path.join(root, 'none') };
  const run = async script => script.includes('NameSpace(10)') ? { count: 0, bytes: 0 } : [];
  const cleanup = t.createCleanup(path.join(root, 'data'), { run, env });
  const plan = await cleanup.preview();
  const tempCat = plan.categories.find(c => c.id === 'temp');
  assert.equal(tempCat.bytes, 150); assert.equal(tempCat.files, 2);
  assert.equal(plan.categories.find(c => c.id === 'recycle').available, false);
  await assert.rejects(cleanup.clean('bogus', ['temp']), /caducado/);
  await assert.rejects(cleanup.clean(plan.token, ['../etc']), /no válida/);
  const again = await cleanup.preview();
  const result = await cleanup.clean(again.token, ['temp']);
  assert.equal(result.freed, 150);
  assert.equal(await fs.readFile(path.join(temp, 'new.tmp'), 'utf8'), 'fresh', 'recent files stay');
  assert.equal(await fs.readFile(path.join(outside, 'precious.txt'), 'utf8'), 'keep me', 'links are not followed');
  await assert.rejects(fs.access(path.join(temp, 'sub')), 'emptied subfolders are removed');
  assert.equal((await cleanup.preview()).totalFreed, 150);
});

test('inverted toggle writes the opposite registry value', async () => {
  const scripts = [];
  await t.setToggle('backgroundApps', false, async s => { scripts.push(s); return true; });
  assert.match(scripts[0], /GlobalUserDisabled' -Value 1/);
  const read = await t.readToggles(async s => { assert.match(s, /GlobalUserDisabled'; if \(\$null -eq \$v\) \{ \$r\['backgroundApps'\] = \$null \} else \{ \$r\['backgroundApps'\] = \(\[int\]\$v -eq 0\)/); return { backgroundApps: false }; });
  assert.equal(read.backgroundApps, false);
});
