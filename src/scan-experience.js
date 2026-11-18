/* Scan experience. Windows answers all sources in parallel, so rows show "consultando"
   together, then resolve one by one with the real values that came back. No fake progress. */
window.createScanExperience = function ({ takeNova, returnNova, navigate }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'scan-dialog';
  dialog.setAttribute('aria-labelledby', 'scan-title');
  dialog.innerHTML = `<div class="scan-layout"><div class="scan-head"><span class="eyebrow">DIAGNÓSTICO LOCAL</span><span class="scan-clock" id="scan-clock">0,0 s</span></div>
    <div class="scan-body"><div class="scan-scene" data-stage="thinking"><div id="scan-nova-slot"></div>
      <div class="thought-cloud" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="nova-book" aria-hidden="true"><span></span><span></span></div>
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
    clearTimers();
    dialog.close(); returnNova(); opener?.focus();
    if (destination) navigate(destination);
  }
  $('scan-return').addEventListener('click', () => close());
  $('scan-results').addEventListener('click', () => close('recommended'));
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  return {
    open() {
      opener = document.activeElement; running = true; started = performance.now();
      clearTimers();
      $('scan-summary').hidden = true; $('scan-results').hidden = true;
      dialog.querySelector('.scan-pending').hidden = false;
      $('scan-progress').dataset.state = 'running';
      $('scan-return').textContent = 'Seguir en segundo plano';
      buildSteps(); tick(); clockTimer = setInterval(tick, 100);
      setStage('thinking', 'Preparando el análisis.', 'Pidiendo a Windows los datos de tu equipo.');
      dialog.showModal(); takeNova($('scan-nova-slot')); $('scan-return').focus();
      readingTimer = setTimeout(() => { if (running && dialog.open) setStage('reading', 'Leyendo tu equipo.', 'Procesador, memoria, discos, procesos, inicio y energía, todo a la vez.'); }, 1800);
    },
    complete(s, items) {
      running = false; clearTimeout(readingTimer); clearInterval(clockTimer); tick();
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
      }, 90 * i)));
      finishingTimer = setTimeout(() => {
        if (!dialog.open) return;
        setStage('done', errors.length ? 'Finalizado con lecturas pendientes.' : 'Análisis finalizado.', 'Tu equipo sigue exactamente como estaba. Tú decides el siguiente paso.');
        const summary = $('scan-summary'); summary.replaceChildren(); summary.hidden = false;
        const heading = document.createElement('strong');
        heading.textContent = items.length ? `${items.length} ${items.length === 1 ? 'punto para revisar' : 'puntos para revisar'}, por prioridad` : 'Nada urgente en esta lectura';
        summary.append(heading);
        const list = document.createElement('ul');
        for (const item of items.slice(0, 3)) { const li = document.createElement('li'); li.textContent = item.title; list.append(li); }
        if (!items.length) { const li = document.createElement('li'); li.textContent = 'No se superan los umbrales de CPU, memoria o espacio en los datos disponibles. No es una prueba de salud del hardware.'; list.append(li); }
        summary.append(list); $('scan-results').hidden = false;
      }, Math.max(900, STEPS.length * 90 + 250));
    },
    fail(message) {
      running = false; clearTimeout(readingTimer); clearInterval(clockTimer);
      if (!dialog.open) return;
      dialog.querySelector('.scan-pending').hidden = true;
      $('scan-progress').dataset.state = 'failed';
      [...$('scan-steps').children].forEach(li => { li.dataset.state = 'failed'; li.querySelector('.step-value').textContent = 'Sin respuesta'; });
      setStage('error', 'No se pudo completar.', message);
      $('scan-return').textContent = 'Volver y reintentar';
    }
  };
};
