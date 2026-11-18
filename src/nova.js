/* Nova: a calm float, spring-driven gaze and head, ten-second blinks and short physical
   reactions to real app states. Springs are CSS linear() curves: no idle frame loop. */
window.createNova = function createNova() {
  const button = document.getElementById('nova');
  const space = document.getElementById('nova-space');
  const eyes = [...button.querySelectorAll('.eye')];
  const lids = eyes.map(eye => { const lid = document.createElement('span'); lid.className = 'nova-lid'; eye.append(lid); return lid; });
  const part = selector => button.querySelector?.(selector) || null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const BLINK_INTERVAL = 10000;
  // Under-damped spring sampled into CSS linear(): quick response, one soft overshoot, settles.
  const SPRING = 'linear(0, .22 6%, .6 14%, .9 23%, 1.05 31%, 1.1 37%, 1.08 44%, 1.03 53%, .99 64%, .99 76%, 1)';
  const GENTLE = 'linear(0, .18 8%, .52 18%, .82 30%, .98 42%, 1.03 52%, 1.02 64%, 1)';
  let visible = true, simple = false, destroyed = false;
  let timer, lookTimer, frame, reactionTimer, deadline = 0, target = { x: 0, y: 0, motion: {} };
  let busy = false;
  let pointerUntil = 0, lastLook = -1;
  let blinkIndex = 0, scanTimer, scanLine = 0;
  const animations = new Set();
  const allowed = () => visible && !document.hidden && document.visibilityState === 'visible' && !simple && !reduce.matches && !destroyed;
  function play(element, keyframes, options) {
    if (!element?.animate) return null;
    const animation = element.animate(keyframes, options);
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    return animation;
  }

  function blink() {
    if (!allowed()) return;
    const duration = blinkIndex++ % 2 ? 720 : 360;
    for (const eye of eyes) play(eye, [
      { scale: '1 1', translate: '0 0', rotate: '0deg', offset: 0, easing: 'cubic-bezier(.4,0,.7,1)' },
      { scale: '1 .4', translate: '0 18px', rotate: '0deg', offset: .36 },
      { scale: '1 .4', translate: '0 18px', rotate: '0deg', offset: .53, easing: 'cubic-bezier(.16,1,.3,1)' },
      { scale: '1 1', translate: '0 0', rotate: '0deg', offset: 1 }
    ], { duration });
    for (const lid of lids) play(lid, [
      { transform: 'translateY(-110%)', offset: 0, easing: 'cubic-bezier(.4,0,.7,1)' },
      { transform: 'translateY(-5%)', offset: .36 },
      { transform: 'translateY(-5%)', offset: .53, easing: 'cubic-bezier(.16,1,.3,1)' },
      { transform: 'translateY(-110%)', offset: 1 }
    ], { duration });
  }
  function schedule() {
    clearTimeout(timer);
    if (!allowed()) return;
    timer = setTimeout(() => {
      if (!allowed()) return;
      blink();
      // Anchor the next blink to the cadence, rather than the animation's duration.
      deadline += BLINK_INTERVAL;
      if (deadline <= performance.now()) deadline = performance.now() + BLINK_INTERVAL;
      schedule();
    }, Math.max(0, deadline - performance.now()));
  }
  function gaze(x, y, motion = {}) {
    target = { x, y, motion };
    if (!allowed() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!allowed()) return;
      // Resolve the latest pointer position once per frame, before any style writes.
      if (target.motion.fromPointer) {
        const rect = button.getBoundingClientRect();
        target.x = Math.max(-16, Math.min(16, (target.x - rect.left - rect.width / 2) / 18));
        target.y = Math.max(-10, Math.min(10, (target.y - rect.top - rect.height / 2) / 22));
      }
      const duration = target.motion.duration ?? 760;
      button.style.setProperty('--gaze-duration', `${duration}ms`);
      button.style.setProperty('--gaze-easing', target.motion.easing ?? SPRING);
      button.style.setProperty('--gaze-x', `${target.x}px`);
      button.style.setProperty('--gaze-y', `${target.y}px`);
      // The head follows the eyes with a slower, heavier spring: eyes lead, head settles after.
      button.style.setProperty('--head-duration', `${Math.round(duration * 1.45)}ms`);
      button.style.setProperty('--head-easing', GENTLE);
      button.style.setProperty('--head-x', `${(target.x * .55).toFixed(2)}px`);
      button.style.setProperty('--head-y', `${(target.y * .7 - 2).toFixed(2)}px`);
      button.style.setProperty('--head-turn', `${(target.x * .45).toFixed(2)}deg`);
      button.style.setProperty('--eye-depth', `${1 + target.x * .005}`);
    });
  }
  const idleLooks = [
    { x: -15, y: -4, duration: 820, hold: 2250 },
    { x: -10, y: 7, duration: 700, hold: 1700, tilt: true },
    { x: 12, y: -10, duration: 900, hold: 2380 },
    { x: 16, y: 3, duration: 760, hold: 1900, hop: true },
    { x: 5, y: 8, duration: 640, hold: 1450 },
    { x: 0, y: 0, duration: 980, hold: 2600, tilt: true }
  ];
  function curious() { play(part('.face'), [{ rotate: '0deg' }, { rotate: '-7deg', offset: .35 }, { rotate: '-7deg', offset: .7 }, { rotate: '0deg' }], { duration: 1500, easing: 'cubic-bezier(.45,0,.55,1)' }); }
  function hop(height = 10) {
    play(part('.mascot'), [
      { translate: '0 0', scale: '1 1' },
      { translate: '0 2px', scale: '1.05 .95', offset: .16 },
      { translate: `0 -${height}px`, scale: '.97 1.04', offset: .45 },
      { translate: '0 1px', scale: '1.04 .96', offset: .78 },
      { translate: '0 0', scale: '1 1' }
    ], { duration: 640, easing: 'cubic-bezier(.33,0,.25,1)' });
  }
  function scheduleLook(delay = 1500) {
    clearTimeout(lookTimer);
    if (!allowed()) return;
    lookTimer = setTimeout(() => {
      if (!allowed()) return;
      if (performance.now() < pointerUntil) { scheduleLook(pointerUntil - performance.now()); return; }
      let next;
      do { next = Math.floor(Math.random() * idleLooks.length); } while (next === lastLook);
      lastLook = next;
      const look = idleLooks[next];
      gaze(look.x, look.y, { duration: look.duration });
      if (look.tilt) curious();
      if (look.hop && Math.random() < .5) hop(8);
      scheduleLook(look.hold);
    }, delay);
  }
  function pointerMove(event) {
    if (!allowed()) return;
    pointerUntil = performance.now() + 3600;
    gaze(event.clientX, event.clientY, { duration: 520, fromPointer: true });
    scheduleLook(3600);
  }
  function center() { pointerUntil = 0; gaze(0, 0, { duration: 880 }); scheduleLook(2100); }
  function boop() {
    center();
    if (!allowed()) return;
    // A soft squash, like pressing something squishy. No message and no extra blink.
    play(part('.mascot'), [{ scale: '1 1' }, { scale: '1.09 .9', offset: .22 }, { scale: '.97 1.04', offset: .55 }, { scale: '1 1' }], { duration: 560, easing: 'cubic-bezier(.33,0,.25,1)' });
  }
  function stop() {
    clearTimeout(timer); clearTimeout(lookTimer); clearTimeout(reactionTimer); clearTimeout(scanTimer); cancelAnimationFrame(frame); frame = null;
    for (const animation of animations) animation.cancel();
    animations.clear();
    button.style.setProperty('--gaze-x', '0px'); button.style.setProperty('--gaze-y', '0px');
    for (const [key, value] of Object.entries({ 'head-x': '0px', 'head-y': '0px', 'head-turn': '0deg', 'eye-depth': '1' })) button.style.setProperty(`--${key}`, value);
  }
  function refresh() {
    stop();
    space.classList.toggle('nova-still', !allowed());
    space.dataset.novaState = allowed() && busy ? 'working' : 'idle';
    if (allowed()) {
      deadline = performance.now() + BLINK_INTERVAL;
      schedule();
      scheduleLook();
    }
  }
  const reactions = {
    success() {
      hop(22);
      play(part('.eyes'), [{ scale: '1 1' }, { scale: '1.04 .5', offset: .25 }, { scale: '1.04 .5', offset: .75 }, { scale: '1 1' }], { duration: 1300, easing: 'cubic-bezier(.45,0,.55,1)' });
    },
    restore() {
      play(part('.face'), [{ translate: '0 0' }, { translate: '0 9px', offset: .25 }, { translate: '0 -2px', offset: .5 }, { translate: '0 7px', offset: .72 }, { translate: '0 0' }], { duration: 1100, easing: 'cubic-bezier(.45,0,.55,1)' });
    },
    error() {
      play(part('.face'), [{ translate: '0 0' }, { translate: '-12px 2px', offset: .15 }, { translate: '11px 2px', offset: .35 }, { translate: '-7px 2px', offset: .55 }, { translate: '4px 1px', offset: .75 }, { translate: '0 0' }], { duration: 760, easing: 'cubic-bezier(.36,0,.3,1)' });
    }
  };
  document.addEventListener('pointermove', pointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', center);
  document.addEventListener('visibilitychange', refresh);
  reduce.addEventListener('change', refresh);
  button.addEventListener('click', boop);
  refresh();
  return {
    context(options) {
      const nextVisible = options.visible ?? visible, nextSimple = options.simple ?? simple;
      if (visible !== nextVisible || simple !== nextSimple) {
        visible = nextVisible; simple = nextSimple; refresh();
      }
    },
    working(nextBusy = false) {
      if (destroyed) return;
      const starting = !busy && nextBusy;
      busy = Boolean(nextBusy);
      clearTimeout(reactionTimer);
      space.dataset.novaState = allowed() && busy ? 'working' : 'idle';
      if (starting && allowed()) { gaze(0, 6, { duration: 600 }); hop(6); }
    },
    react(kind) {
      if (!allowed() || busy || !['success', 'error', 'restore'].includes(kind)) return;
      clearTimeout(reactionTimer);
      space.dataset.novaState = kind;
      gaze(0, kind === 'error' ? 4 : -3, { duration: 500 });
      reactions[kind]();
      reactionTimer = setTimeout(() => {
        if (!destroyed) space.dataset.novaState = allowed() && busy ? 'working' : 'idle';
      }, 1400);
    },
    // While a scan runs: eyes read across in short lines, with a small bob at each line break.
    scanning(on) {
      clearTimeout(scanTimer); scanLine = 0;
      if (!on || destroyed) { if (!destroyed) center(); return; }
      // Calm reading: eyes look down at the book and drift slowly across each line.
      const read = () => {
        if (!allowed()) { scanTimer = setTimeout(read, 800); return; }
        const y = 7 + (scanLine++ % 2) * 2;
        gaze(-6, y, { duration: 700, easing: GENTLE });
        scanTimer = setTimeout(() => {
          gaze(6, y, { duration: 1500, easing: 'cubic-bezier(.45,.05,.55,.95)' });
          scanTimer = setTimeout(read, 1700);
        }, 800);
      };
      pointerUntil = performance.now() + 1e9; clearTimeout(lookTimer); read();
    },
    // One finished reading: a quick nod; a failed one: a small head shake.
    beat(failed) {
      if (!allowed()) return;
      if (failed) play(part('.face'), [{ translate: '0 0' }, { translate: '-3px 0', offset: .3 }, { translate: '2px 0', offset: .65 }, { translate: '0 0' }], { duration: 380 });
      else play(part('.face'), [{ translate: '0 0' }, { translate: '0 3px', offset: .35 }, { translate: '0 0' }], { duration: 300, easing: 'cubic-bezier(.33,0,.25,1)' });
    },
    land() { if (allowed()) play(part('.mascot'), [{ scale: '1 1' }, { scale: '1.08 .92', offset: .3 }, { scale: '.98 1.03', offset: .65 }, { scale: '1 1' }], { duration: 520, easing: 'cubic-bezier(.33,0,.25,1)' }); },
    destroy() {
      destroyed = true; stop();
      document.removeEventListener('pointermove', pointerMove);
      document.documentElement.removeEventListener('pointerleave', center);
      document.removeEventListener('visibilitychange', refresh);
      reduce.removeEventListener('change', refresh);
      button.removeEventListener('click', boop);
    }
  };
};
