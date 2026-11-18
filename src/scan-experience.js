/* Scan experience. Windows answers all sources in parallel, so rows show "consultando"
   together, then resolve one by one with the real values that came back. No fake progress. */
window.createScanExperience = function ({ takeNova, returnNova, navigate, nova, fixable, prepareFix }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'scan-dialog';
  dialog.setAttribute('aria-labelledby', 'scan-title');
  dialog.innerHTML = `<div class="scan-layout"><div class="scan-head"><span class="eyebrow">DIAGNÓSTICO LOCAL</span><span class="scan-clock" id="scan-clock">0,0 s</span></div>
    <div class="scan-body"><div class="scan-scene" data-stage="thinking"><div id="scan-nova-slot"></div>
      <div class="thought-cloud" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="nova-book" aria-hidden="true"><svg viewBox="0 0 220 110"><path class="book-cover" d="M8 26c34-10 70-8 102 8 32-16 68-18 102-8v74c-34-10-70-8-102 8-32-16-68-18-102-8Z"/><path class="book-page" d="M14 22c32-9 64-6 96 9v70c-32-15-64-18-96-9Z"/><path class="book-page" d="M206 22c-32-9-64-6-96 9v70c32-15 64-18 96-9Z"/><g class="book-lines"><path d="M30 38c22-5 44-3 66 5M30 50c22-5 44-3 66 5M30 62c22-5 44-3 66 5M30 74c14-3 28-2 42 2"/><path d="M124 43c22-8 44-10 66-5M124 55c22-8 44-10 66-5M124 67c22-8 44-10 66-5M124 79c14-5 28-6 42-4"/></g><path class="book-flip" d="M110 31c32-15 64-18 96-9v70c-32-9-64-6-96 9Z"/><path class="book-spine" d="M110 31v70"/></svg></div>
      <div class="nova-bulb" aria-hidden="true"><svg viewBox="0 0 64 80"><path d="M20 48C3 33 12 9 32 9s29 24 12 39l-3 9H23Z"/><path d="M24 65h16m-13 7h10M32 0v4M5 10l6 6M59 10l-6 6M0 34h7m50 0h7"/></svg></div>
    </div>
    <div class="scan-side"><div aria-live="polite"><h2 id="scan-title">Preparando el análisis.</h2><p id="scan-description">Consultando los datos de tu equipo en Windows.</p></div>
    <div class="scan-progress" id="scan-progress"><i></i></div>
    <ul class="scan-steps" id="scan-steps"></ul></div></div>
    <div class="scan-pending"><span class="spinner"></span><span>Solo lectura · tu equipo no se modifica</span></div>
    <div id="scan-summary" hidden></div><div class="scan-actions"><button class="button secondary" id="scan-return">Volver al equipo</button><button class="button primary" id="scan-results" hidden>Ver recomendaciones</button></div>
  </div>`;
  document.body.append(dialog);
  const $ = id => dialog.querySelector(`#${id}`);
  const GB = n => (Number(n) / 1073741824).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const STEPS = [
    ['cpu', 'Procesador', s => { const c = s.cpu?.[0]; return Number.isFinite(c?.LoadPercentage) ? `${c.LoadPercentage} % de uso${c.Samples > 1 ? ` · ${c.Samples} muestras` : ''}` : null; }],
    ['memory', 'Memoria', s => s.memory?.total > 0 ? `${GB(s.memory.total - s.memory.free)} de ${GB(s.memory.total)} GB en uso` : null],
    ['disks', 'Unidades', s => s.disks?.length ? `${s.disks.length} ${s.disks.length === 1 ? 'unidad' : 'unidades'} · ${GB(s.disks.reduce((n, d) => n + Number(d.FreeSpace || 0), 0))} GB libres` : null],
    ['physicalDisks', 'Estado de los discos', s => s.physicalDisks?.length ? s.physicalDisks.every(d => d.HealthStatus === 'Healthy') ? 'Sin avisos de Windows' : 'Revisar avisos' : null],
    ['processes', 'Procesos', s => s.processes?.length ? `${s.processes.length} grupos leídos` : null],
    ['startup', 'Inicio de Windows', s => Array.isArray(s.startup) ? `${s.startup.length} entradas` : null],
    ['plans', 'Energía', s => s.configuration?.plans?.find(p => p.active)?.name || (s.plans?.length ? `${s.plans.length} planes` : null)],
    ['gpu', 'Gráfica', s => s.gpu?.[0]?.Name || null]
  ];
  let readingTimer, finishingTimer, clockTimer, revealTimers = [], opener, running = false, started = 0;
  const scene = dialog.querySelector('.scan-scene');
  const setStage = (stage, title, description) => {
    scene.dataset.stage = stage; dialog.dataset.stage = stage; $('scan-title').textContent = title; $('scan-description').textContent = description;
  };
  function tick() { $('scan-clock').textContent = `${((performance.now() - started) / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`; }
  function buildSteps() {
    const list = $('scan-steps'); list.replaceChildren();
    STEPS.forEach(([key, label], i) => {
      const li = document.createElement('li'); li.dataset.key = key; li.dataset.state = 'pending'; li.style.setProperty('--i', i);
      const mark = document.createElement('span'); mark.className = 'step-mark';
      const name = document.createElement('strong'); name.textContent = label;
      const value = document.createElement('span'); value.className = 'step-value'; value.textContent = 'Consultando…';
      li.append(mark, name, value); list.append(li);
    });
  }
  function clearTimers() { clearTimeout(readingTimer); clearTimeout(finishingTimer); clearInterval(clockTimer); revealTimers.forEach(clearTimeout); revealTimers = []; }
  function close(destination) {
    if (dialog.dataset.view === 'fixing' && fixing) return;
    clearTimers();
    dialog.close(); returnNova(); opener?.focus();
    if (destination) navigate(destination);
  }
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
  const cleanTitle = t => { const r = String(t).replace(/^Opcional(?: [^:]*)?:\s*/, ''); return r.charAt(0).toUpperCase() + r.slice(1); };
  const firstSentence = t => (String(t).match(/^[^.]*\./) || [t])[0];
  let fixing = false;
  /* The plan: what was found, as a checklist. Fixable rows are pre-selected; the rest link to their view. */
  function showPlan(items, partial) {
    const fixes = items.filter(fixable), checks = items.filter(i => !fixable(i));
    setStage('done', partial ? 'Plan con lecturas pendientes.' : fixes.length ? 'Este es tu plan.' : items.length ? 'Hay cosas que revisar.' : 'Todo en orden.',
      fixes.length ? 'Marca lo que quieras arreglar. Antes de tocar nada verás exactamente qué cambia.'
        : items.length ? 'No hay nada que arreglar automáticamente; abre cada punto para verlo.'
        : `No hemos encontrado nada que arreglar${partial ? ' en los datos que se pudieron leer' : ''}. Tu equipo no se ha modificado.`);
    dialog.dataset.view = 'plan';
    const summary = $('scan-summary'); summary.replaceChildren(); summary.hidden = false;
    const list = el('ul', null, 'plan-list'); list.id = 'plan-list';
    items.forEach((item, i) => {
      const li = el('li', null, 'plan-item'); li.style.setProperty('--i', i); li.dataset.state = 'todo';
      const canFix = fixable(item);
      const mark = el('span', null, 'plan-mark');
      if (canFix) { const box = el('input'); box.type = 'checkbox';
        // Changes to how Windows looks are opt-in even inside "Arreglar todo".
        box.checked = !['animations', 'menuAnimation', 'comboAnimation', 'transparency'].some(k => k in (item.changes || {})); box.setAttribute('aria-label', item.title); box.addEventListener('change', updateFixButton); mark.append(box); li.dataset.fix = 'true'; li.planItem = item; }
      const text = el('div', null, 'plan-text'); text.append(el('strong', cleanTitle(item.title)), el('small', firstSentence(item.evidence)));
      li.append(mark, text);
      if (!canFix) { const go = el('button', 'Ver', 'button secondary small'); go.addEventListener('click', () => close(item.view)); li.append(go); }
      list.append(li);
    });
    if (!items.length) list.append(el('li', 'Sin avisos de CPU, memoria, espacio ni discos en esta lectura.', 'plan-item plan-empty'));
    summary.append(list);
    $('scan-results').hidden = !fixes.length && !checks.length;
    $('scan-results').textContent = fixes.length ? '' : 'Ver detalles';
    if (fixes.length) updateFixButton();
  }
  function selectedFixes() { return [...dialog.querySelectorAll('.plan-item[data-fix] input:checked')].map(i => i.closest('li')); }
  function updateFixButton() {
    const n = selectedFixes().length, b = $('scan-results'); b.removeAttribute('aria-busy');
    b.disabled = !n; b.textContent = n ? `Arreglar ${n === dialog.querySelectorAll('.plan-item[data-fix]').length && n > 1 ? 'todo' : n === 1 ? '1 cosa' : `${n} cosas`}` : 'Nada seleccionado';
  }
  async function startFix() {
    const rows = selectedFixes(); if (!rows.length || fixing) return;
    fixing = true; $('scan-results').disabled = true; $('scan-results').textContent = 'Preparando…'; $('scan-results').setAttribute('aria-busy', 'true');
    let plan;
    try { plan = await prepareFix(rows.map(r => r.planItem)); }
    catch (e) { fixing = false; updateFixButton(); setStage('error', 'No se pudo preparar.', e.message); return; }
    // Confirmation: exact before → after values, in the same window.
    setStage('confirm', 'Esto es lo que va a cambiar.', 'Los ajustes se pueden deshacer desde Historial. Los archivos borrados no se recuperan.');
    const summary = $('scan-summary'); const keep = $('plan-list');
    const confirm = el('ul', null, 'plan-confirm');
    for (const line of plan.lines) { const li = el('li'); li.append(el('strong', line.label), el('span', line.detail)); confirm.append(li); }
    keep.hidden = true; summary.append(confirm);
    $('scan-results').disabled = false; $('scan-results').removeAttribute('aria-busy'); $('scan-results').textContent = 'Confirmar y arreglar';
    $('scan-return').textContent = 'Atrás';
    const back = () => { confirm.remove(); keep.hidden = false; fixing = false; dialog.dataset.view = 'plan'; $('scan-return').textContent = 'Volver al equipo'; setStage('done', 'Este es tu plan.', 'Marca lo que quieras arreglar. Antes de tocar nada verás exactamente qué cambia.'); updateFixButton(); };
    dialog.dataset.view = 'confirm'; pendingBack = back;
    pendingConfirm = async () => {
      pendingBack = pendingConfirm = null;
      confirm.remove(); keep.hidden = false; dialog.dataset.view = 'fixing';
      $('scan-results').hidden = true; $('scan-return').disabled = true;
      setStage('fixing', 'Arreglando…', 'No cierres la app mientras termina.');
      dialog.querySelectorAll('.plan-item[data-fix] input').forEach(i => i.disabled = true);
      dialog.querySelectorAll('.plan-item[data-fix] input:not(:checked)').forEach(i => i.closest('li').dataset.state = 'skipped');
      const outcome = await plan.run((item, state) => {
        const li = rows.find(r => r.planItem === item); if (!li) return;
        li.dataset.state = state;
        if (state === 'fixed') nova?.beat(false);
      });
      $('scan-return').disabled = false; $('scan-return').textContent = 'Volver al equipo';
      const ok = outcome.fixed, total = rows.length;
      setStage(ok === total ? 'fixed' : 'error', ok === total ? (total === 1 ? 'Arreglado.' : 'Todo arreglado.') : `${ok} de ${total} arreglados.`, outcome.message);
      if (outcome.chips?.length) { const chips = el('div', null, 'plan-chips'); for (const c of outcome.chips) chips.append(el('span', c, 'tag good')); $('scan-summary').append(chips); }
      fixing = false;
    };
  }
  let pendingConfirm = null, pendingBack = null;
  $('scan-results').addEventListener('click', e => {
    if (dialog.dataset.view === 'plan' && dialog.querySelector('.plan-item[data-fix]')) { e.stopImmediatePropagation(); startFix(); }
    else if (dialog.dataset.view === 'confirm' && pendingConfirm) { e.stopImmediatePropagation(); pendingConfirm(); }
  });
  $('scan-return').addEventListener('click', e => { if (dialog.dataset.view === 'confirm' && pendingBack) { e.stopImmediatePropagation(); const b = pendingBack; pendingBack = pendingConfirm = null; b(); } }, true);
  $('scan-return').addEventListener('click', () => close());
  $('scan-results').addEventListener('click', () => close('recommended'));
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  return {
    open() {
      opener = document.activeElement; running = true; started = performance.now();
      clearTimers();
      $('scan-summary').hidden = true; $('scan-results').hidden = true; $('scan-results').disabled = false; $('scan-return').disabled = false;
      dialog.dataset.view = 'scan'; fixing = false; pendingConfirm = pendingBack = null; nova?.scanning(true);
      dialog.querySelector('.scan-pending').hidden = false;
      $('scan-progress').dataset.state = 'running';
      $('scan-return').textContent = 'Seguir en segundo plano';
      buildSteps(); tick(); clockTimer = setInterval(tick, 100);
      setStage('thinking', 'Preparando el análisis.', 'Pidiendo a Windows los datos de tu equipo.');
      dialog.showModal(); takeNova($('scan-nova-slot')); $('scan-return').focus();
      readingTimer = setTimeout(() => { if (running && dialog.open) setStage('reading', 'Leyendo tu equipo.', 'Procesador, memoria, discos, procesos, inicio y energía, todo a la vez.'); }, 1800);
    },
    complete(s, items) {
      running = false; clearTimeout(readingTimer); clearInterval(clockTimer); tick(); nova?.scanning(false);
      if (!dialog.open) return;
      dialog.querySelector('.scan-pending').hidden = true;
      $('scan-progress').dataset.state = 'done';
      setStage('idea', 'Ya tengo los resultados.', 'Ordenando lo que he leído por prioridad.');
      $('scan-return').textContent = 'Volver al equipo';
      const errors = s.errors || [];
      [...$('scan-steps').children].forEach((li, i) => revealTimers.push(setTimeout(() => {
        const [key, , describe] = STEPS[i];
        let value = null; try { value = describe(s); } catch { /* Shown as unavailable. */ }
        const failed = errors.includes(key) || !value;
        li.dataset.state = failed ? 'failed' : 'done';
        li.querySelector('.step-value').textContent = failed ? 'No disponible' : value;
        nova?.beat(failed);
      }, 220 * i)));
      finishingTimer = setTimeout(() => { if (dialog.open) showPlan(items, errors.length > 0); }, Math.max(900, STEPS.length * 220 + 300));
    },
    fail(message) {
      running = false; clearTimeout(readingTimer); clearInterval(clockTimer); nova?.scanning(false);
      if (!dialog.open) return;
      dialog.querySelector('.scan-pending').hidden = true;
      $('scan-progress').dataset.state = 'failed';
      [...$('scan-steps').children].forEach(li => { li.dataset.state = 'failed'; li.querySelector('.step-value').textContent = 'Sin respuesta'; });
      setStage('error', 'No se pudo completar.', message);
      $('scan-return').textContent = 'Volver y reintentar';
    }
  };
};
