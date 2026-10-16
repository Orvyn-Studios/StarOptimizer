const test = require('node:test');
const assert = require('node:assert/strict');
const priorities = require('../src/priorities.js');
const normal = () => ({ errors: [], cpu: [{ LoadPercentage: 20 }], memory: { total: 100, free: 50 }, disks: [{ DeviceID: 'C:', Size: 100, FreeSpace: 50 }], startup: [] });
const balanced = '381b4222-f694-41f0-9685-ff5bb260df2e';
const saver = 'a1841308-3541-4fab-bc81-f71556f20b4a';
test('intelligent never treats existing energy preferences as system faults', () => {
  const s = normal(); s.onBattery = false;
  s.configuration = { values: { power: saver }, plans: [{ id: saver }, { id: balanced }] };
  assert.deepEqual(priorities(s), []);
  assert.deepEqual(priorities(s, 'invalid-mode'), []);
  s.configuration.values.power = balanced;
  assert.deepEqual(priorities(s), []);
});
test('enabled visual effects are a preference, not a diagnosed problem', () => {
  const s = normal(); s.configuration = { values: { animations: true, menuAnimation: true, comboAnimation: true } };
  assert.deepEqual(priorities(s), []);
});
test('no recommendations before a snapshot, or invented problems for normal readings', () => {
  assert.deepEqual(priorities(null), []); assert.deepEqual(priorities(normal()), []);
});
test('orders incomplete readings and resource pressure without generic startup review', () => {
  const s = normal(); s.errors = ['gpu']; s.memory.free = 5; s.cpu[0].LoadPercentage = 95; s.disks[0].FreeSpace = 5; s.startup = [{ Name: 'Example' }];
  assert.deepEqual(priorities(s).map(x => x.priority), [0, 1, 1, 2]);
});
test('missing and invalid metrics never become resource diagnoses', () => {
  const s = normal(); s.errors = ['cpu', 'disks', 'memory']; s.cpu[0].LoadPercentage = 99; s.disks[0].FreeSpace = 0; s.memory.free = 0;
  assert.equal(priorities(s).length, 1);
  assert.deepEqual(priorities({ errors: [], cpu: [{ LoadPercentage: null }], memory: { total: 0, free: -1 }, disks: [{ Size: 100, FreeSpace: null }] }), []);
});
test('startup inventory alone does not imply a bottleneck', () => {
  const s = normal(); s.startup = [{ Name: 'Security' }, { Name: 'Audio driver' }];
  assert.deepEqual(priorities(s), []);
});
test('different computers produce different evidence-driven recommendations', () => {
  const healthy = normal(); healthy.startup = [{ Name: 'App' }];
  healthy.configuration = { values: { animations: true } };
  const strained = normal(); strained.cpu[0].LoadPercentage = 94; strained.memory.free = 4;
  const lowStorage = normal(); lowStorage.disks[0].FreeSpace = 3;
  assert.deepEqual(priorities(healthy), []);
  assert.deepEqual(priorities(strained).map(x => x.priority), [1, 2]);
  assert.equal(priorities(lowStorage).length, 1);
  assert.match(priorities(lowStorage)[0].title, /espacio/);
});
test('physical disk warnings take priority, unknown status is never a failure diagnosis', () => {
  const s=normal(); s.physicalDisks=[{Name:'SSD',HealthStatus:'Warning'},{Name:'Unknown disk',HealthStatus:'Unknown'}];
  const items=priorities(s); assert.equal(items.length,1); assert.equal(items[0].priority,0); assert.match(items[0].title,/Proteger/);
});

test('gaming only offers high-performance plan on AC when available; never disables visuals', () => {
  const s = normal();
  const high = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
  s.onBattery = false;
  s.configuration = { values: { power: balanced, animations: true }, plans: [{ id: balanced }, { id: high }] };
  const gaming = priorities(s, 'gaming');
  assert.equal(gaming.length, 1);
  assert.deepEqual(gaming[0].changes, { power: high });
  s.onBattery = true;
  assert.deepEqual(priorities(s, 'gaming'), []);
  s.onBattery = false; s.configuration.plans = [{ id: balanced }];
  assert.deepEqual(priorities(s, 'gaming'), []);
});
test('extreme opt-in separates optional visual adjustments from actual diagnoses', () => {
  const s = normal();
  s.configuration = { values: { animations: true, menuAnimation: false, comboAnimation: true }, plans: [] };
  assert.deepEqual(priorities(s), []);
  assert.deepEqual(priorities(s, 'gaming'), []);
  const items = priorities(s, 'extreme');
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].changes, { animations: false, comboAnimation: false });
  assert.match(items[0].evidence, /no una avería/);
});

test('large drive with plenty of free GB does not create false low-space warnings', () => {
  const s = normal(); s.disks = [{ DeviceID: 'D:', Size: 4 * 1024 ** 4, FreeSpace: 200 * 1024 ** 3 }];
  assert.deepEqual(priorities(s), []);
  s.disks[0].FreeSpace = 10 * 1024 ** 3;
  assert.match(priorities(s)[0].title, /espacio/);
});
test('memory pressure includes measured responsible process, not a guessed app', () => {
  const s = normal(); s.memory = { total: 16 * 1024 ** 3, free: 1 * 1024 ** 3 };
  s.processes = [{ ProcessName: 'Browser', WorkingSet64: 3 * 1024 ** 3 }, { ProcessName: 'Editor', WorkingSet64: 0.5 * 1024 ** 3 }];
  assert.match(priorities(s)[0].evidence, /Browser/);
  s.errors = ['processes'];
  assert.equal(priorities(s).some(x => x.evidence.includes('Browser')), false);
});

test('partial configuration only suppresses the unavailable optional settings', () => {
  const s = normal();
  const high = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
  s.onBattery = false; s.errors = ['configuration'];
  s.configuration = {
    values: { power: balanced, animations: null, menuAnimation: true, comboAnimation: false },
    plans: [{ id: balanced }, { id: high }], unavailable: ['animations']
  };
  assert.equal(priorities(s).length, 1, 'Intelligent only reports the missing reading');
  assert.deepEqual(priorities(s, 'gaming').filter(x => x.changes).map(x => x.changes), [{ power: high }]);
  assert.deepEqual(priorities(s, 'extreme').filter(x => x.changes).map(x => x.changes), [{ power: high }, { menuAnimation: false }]);
  s.configuration.unavailable = ['power']; s.configuration.values.power = null;
  assert.deepEqual(priorities(s, 'gaming').filter(x => x.changes), []);
  assert.deepEqual(priorities(s, 'extreme').filter(x => x.changes).map(x => x.changes), [{ menuAnimation: false }]);
  delete s.configuration.unavailable;
  assert.deepEqual(priorities(s, 'extreme').filter(x => x.changes), [], 'legacy generic error has no precise availability evidence');
});

test('optional modes require a listed current plan and known AC power', () => {
  const s = normal(); const high = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
  s.configuration = { values: { power: balanced }, plans: [{ id: high }] };
  s.onBattery = false;
  assert.deepEqual(priorities(s, 'gaming'), [], 'missing original plan cannot offer a reversible change');
  s.configuration.plans.push({ id: balanced }); s.onBattery = null;
  assert.deepEqual(priorities(s, 'gaming'), []);
  s.onBattery = false; s.errors = ['plans'];
  assert.equal(priorities(s, 'gaming').some(x => x.changes), false);
});
