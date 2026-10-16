'use strict';
// Read-only Windows smoke test for the genuine OS adapter; does not apply tweaks.
// Run: npm run test:windows:smoke
const assert = require('node:assert/strict');
const os = require('node:os');
const { scan, optimizationAdapter, telemetry } = require('../src/system.cjs');
const fail = (why) => { console.error('FAIL:', why); process.exitCode = 1; };
(async () => {
  if (process.platform !== 'win32') {
    console.error('This smoke test must run on Windows.');
    process.exitCode = 2; return;
  }
  const started = Date.now();
  try {
    const [snapshot, config, live] = await Promise.all([scan(), optimizationAdapter.snapshot(), telemetry()]);
    assert.ok(snapshot && Array.isArray(snapshot.errors) && Array.isArray(snapshot.cpu));
    assert.ok(Number.isFinite(snapshot.memory?.total) && snapshot.memory.total > 0);
    assert.ok(Number.isFinite(snapshot.memory?.free) && snapshot.memory.free >= 0);
    assert.ok(Array.isArray(snapshot.disks) && Array.isArray(snapshot.startup));
    assert.ok(snapshot.disks.length > 0, 'Windows must report at least one fixed volume');
    assert.ok(Array.isArray(snapshot.processes) && Array.isArray(snapshot.gpu));
    assert.ok(Array.isArray(snapshot.physicalDisks));
    assert.ok(Array.isArray(config.plans) && config.values);
    assert.ok(Number.isFinite(live.cpu) && live.cpu >= 0 && live.cpu <= 100);
    console.log(JSON.stringify({
      status: snapshot.errors.length ? 'PARTIAL' : 'OK',
      durationMs: Date.now() - started,
      hostCpu: os.cpus()[0]?.model,
      scannedCpu: snapshot.cpu[0]?.LoadPercentage ?? null,
      memoryTotalGiB: +(snapshot.memory.total / 1073741824).toFixed(1),
      disksFound: snapshot.disks.length,
      diskSource: snapshot.sources?.disks,
      gpusFound: snapshot.gpu.length,
      processGroupsFound: snapshot.processes.length,
      startupEntriesFound: snapshot.startup.length,
      energyPlansFound: config.plans.length,
      unavailable: snapshot.errors,
      errorDetails: snapshot.errorDetails
    }, null, 2));
    if (snapshot.errors.includes('cpu') || !Number.isFinite(snapshot.cpu[0]?.LoadPercentage))
      fail('CPU scan failed or produced no usable load value');
    if (snapshot.errors.includes('disks'))
      fail('Disk inventory unavailable');
  } catch (error) {
    fail(error?.stack || String(error));
  }
})();
// No system configuration is changed in this script.
