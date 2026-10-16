'use strict';
// Executes Nova's actual controller with instrumented DOM/scheduling adapters.
// This measures controller work; it does not certify browser rendering or Windows DPI.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function controller() {
  const listeners = new Map(), frames = new Map(), timers = new Map(), styles = new Map();
  let id = 0, layouts = 0, writes = 0;
  const events = prefix => ({
    addEventListener: (name, fn) => listeners.set(prefix + name, fn),
    removeEventListener: name => listeners.delete(prefix + name)
  });
  const button = {
    ...events('button:'), querySelectorAll: () => [],
    style: { setProperty: (key, value) => { writes++; styles.set(key, value); } },
    getBoundingClientRect: () => { layouts++; return { left: 0, top: 0, width: 223, height: 223 }; }
  };
  const space = { dataset: {}, classList: { toggle() {} } };
  const document = {
    ...events('document:'), hidden: false, visibilityState: 'visible',
    documentElement: events('root:'),
    getElementById: name => name === 'nova' ? button : space
  };
  const media = { ...events('media:'), matches: false };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/nova.js'), 'utf8'), {
    window, document, matchMedia: () => media, performance: { now: () => 0 },
    setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: key => timers.delete(key),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key)
  });
  const nova = window.createNova();
  return {
    nova, document, media, frames, timers, styles, listeners,
    metrics: () => ({ layouts, writes }),
    pointer: (x, y) => listeners.get('document:pointermove')?.({ clientX: x, clientY: y }),
    emit: name => listeners.get(name)?.(),
    flush: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); }
  };
}

test('Nova coalesces pointer bursts into one layout read and uses the latest position', () => {
  const c = controller(); const baseline = c.metrics();
  for (let i = 0; i < 100; i++) c.pointer(200 + i, 150);
  assert.equal(c.frames.size, 1);
  assert.equal(c.metrics().layouts, baseline.layouts, 'no synchronous layout per pointer event');
  c.flush();
  assert.equal(c.metrics().layouts - baseline.layouts, 1);
  assert.equal(c.styles.get('--gaze-x'), `${(299 - 223 / 2) / 18}px`);
  assert.equal(c.frames.size, 0, 'no continuous animation frame loop');
  c.nova.destroy();
});

test('Nova cancels queued work when hidden, reduced, simplified or destroyed', () => {
  const c = controller();
  c.pointer(300, 150); c.document.hidden = true; c.document.visibilityState = 'hidden';
  c.emit('document:visibilitychange');
  assert.equal(c.frames.size, 0); assert.equal(c.timers.size, 0);
  const paused = c.metrics(); c.pointer(50, 50); c.flush();
  assert.deepEqual(c.metrics(), paused);
  c.document.hidden = false; c.document.visibilityState = 'visible'; c.emit('document:visibilitychange');
  assert.equal(c.timers.size, 2);
  c.media.matches = true; c.emit('media:change');
  assert.equal(c.timers.size, 0); c.pointer(50, 50); assert.equal(c.frames.size, 0);
  c.media.matches = false; c.emit('media:change'); c.nova.context({ simple: true });
  assert.equal(c.timers.size, 0);
  c.nova.context({ simple: false }); c.pointer(300, 150); c.nova.destroy();
  assert.equal(c.frames.size, 0); assert.equal(c.timers.size, 0); assert.equal(c.listeners.size, 0);
});
