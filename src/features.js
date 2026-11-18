/* Device profile, startup apps, space cleanup and battery health.
   Shares renderer.js globals: $, call, node, row, button, toast, show, snapshot, renderPriorities, nova. */
(function () {
  const DEVICE_KEY = 'star-device';
  const NAMES = { laptop: 'Portátil', desktop: 'PC de sobremesa' };
  let device = null, hint = null, startupApps = null, cleanupPlan = null, battery = null, cleaning = false;
  try { const stored = localStorage.getItem(DEVICE_KEY); if (stored in NAMES) device = stored; } catch { /* Ask again. */ }
  const fmt = bytes => {
    const gb = bytes / 1073741824;
    return gb >= 1 ? [gb.toLocaleString('es-ES', { maximumFractionDigits: 1 }), 'GB'] : [Math.round(bytes / 1048576).toLocaleString('es-ES'), 'MB'];
  };
  const size = bytes => fmt(bytes).join(' ');
  window.starDevice = () => device;

  /* ---------- Device profile ---------- */
  function applyDevice() {
    const laptop = device === 'laptop';
    $('device-name').textContent = device ? NAMES[device] : 'Elegir equipo';
    $('device-switch').querySelector('use').setAttribute('href', laptop ? '#i-laptop' : '#i-desktop');
    $('wordmark').firstChild.textContent = device ? (laptop ? 'Mi portátil' : 'Mi PC') : 'Mi equipo';
    $('hero-device').textContent = laptop ? 'Tu portátil' : 'Tu PC';
    $('profile-daily-copy').textContent = laptop ? 'Equilibrio entre autonomía y respuesta. Ideal en batería.' : 'Energía equilibrada para trabajar, estudiar y navegar.';
    $('profile-performance-copy').textContent = laptop ? 'Alto rendimiento y Modo Juego. Conecta el cargador: en batería consume mucho más.' : 'Alto rendimiento y Modo Juego, para sacar todo de tu PC.';
    $('device-card-title').textContent = laptop ? 'Batería y rendimiento' : 'Ajustes de rendimiento';
    $('device-card-icon').querySelector('use').setAttribute('href', laptop ? '#i-battery' : '#i-tune');
    $('device-card').dataset.go = laptop && battery?.length ? 'processes' : 'recommendations';
    document.body.dataset.device = device || '';
    if (snapshot) renderPriorities();
    renderBattery();
  }
  function openDeviceDialog(firstRun) {
    const dialog = $('device-dialog');
    dialog.querySelectorAll('[data-device]').forEach(b => {
      b.classList.toggle('suggested', hint?.suggested === b.dataset.device);
      b.classList.toggle('current', device === b.dataset.device);
    });
    dialog.dataset.firstRun = firstRun ? 'true' : 'false';
    if (!dialog.open) dialog.showModal();
  }
  $('device-dialog').addEventListener('cancel', e => { if ($('device-dialog').dataset.firstRun === 'true') e.preventDefault(); });
  $('device-dialog').querySelectorAll('[data-device]').forEach(b => b.addEventListener('click', () => {
    device = b.dataset.device;
    try { localStorage.setItem(DEVICE_KEY, device); } catch { /* Kept for this session. */ }
    $('device-dialog').close(); applyDevice();
    toast(device === 'laptop' ? 'Perfecto: tendré en cuenta la batería, la temperatura y la autonomía.' : 'Perfecto: priorizaré el rendimiento sostenido de tu PC.');
    nova.react('success');
    if (device === 'laptop') loadBattery();
  }));
  $('device-switch').addEventListener('click', () => openDeviceDialog(false));
  call('device').then(data => {
    hint = data;
    const text = { laptop: 'Parece un portátil: tiene batería y chasis de portátil.', desktop: 'Parece un PC de sobremesa: no tiene batería.' }[data.suggested];
    $('device-hint').textContent = text ? `${text} Puedes elegir lo que prefieras.` : 'No he podido detectarlo con seguridad. Elige el que corresponda.';
    if ($('device-dialog').open) openDeviceDialog($('device-dialog').dataset.firstRun === 'true');
  }).catch(() => { $('device-hint').textContent = 'No he podido detectarlo. Elige el que corresponda.'; });
  applyDevice();
  if (!device) openDeviceDialog(true);

  /* ---------- Battery (laptops) ---------- */
  async function loadBattery() {
    if (device !== 'laptop') return renderBattery();
    try { battery = await call('battery'); } catch { battery = []; }
    if (snapshot) snapshot.battery = battery;
    renderBattery(); if (snapshot) renderPriorities();
  }
  function renderBattery() {
    const panel = $('battery-panel');
    panel.hidden = device !== 'laptop';
    if (panel.hidden) return;
    const list = $('battery-list'); list.replaceChildren();
    if (!battery) { empty(list, 'Analiza el equipo para leer el estado de la batería.'); $('battery-tag').textContent = '—'; return; }
    if (!battery.length) { empty(list, 'Windows no proporcionó datos de capacidad de la batería.'); $('battery-tag').textContent = 'No disponible'; return; }
    const worst = Math.min(...battery.map(b => b.health));
    $('battery-tag').textContent = `${worst} % de salud`;
    $('battery-tag').className = `tag ${worst >= 80 ? 'good' : worst >= 60 ? 'warning' : 'bad'}`;
    for (const b of battery) list.append(row(b.name, `Capacidad actual ${(b.full / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} Wh de ${(b.design / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} Wh de fábrica${b.cycles ? ` · ${b.cycles} ciclos` : ''}`, node('span', `${b.health} %`)));
    if (device === 'laptop') $('recommendation-summary').textContent = `Batería al ${worst} % de su capacidad original.`;
  }

  /* ---------- Startup apps ---------- */
  async function loadStartup() {
    try { startupApps = await call('startupApps'); } catch (e) { startupApps = null; empty($('startup-manage'), e.message); return; }
    if (snapshot) snapshot.startupApps = startupApps;
    renderStartup();
  }
  function renderStartup() {
    const list = $('startup-manage'); list.replaceChildren();
    if (!startupApps) return;
    const active = startupApps.filter(a => a.enabled).length;
    $('startup-count').textContent = `${active} de ${startupApps.length} activas`;
    $('startup-summary').textContent = startupApps.length ? `${active} ${active === 1 ? 'app se abre' : 'apps se abren'} al encender.` : 'Ninguna app propia al iniciar sesión.';
    if (!startupApps.length) return empty(list, 'No hay aplicaciones de tu usuario configuradas para abrirse al iniciar sesión.');
    for (const app of [...startupApps].sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name, 'es'))) {
      const el = node('div', undefined, `row with-icon${app.enabled ? '' : ' off'}`);
      const icon = node('span', app.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1) || '·', 'app-icon');
      const body = node('div');
      const friendly = app.name.replace(/(AutoLaunch)?_[0-9A-F]{16,}$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2');
      body.append(node('strong', friendly), node('p', app.enabled ? 'Se abre al iniciar sesión' : 'Desactivada · no se abre al encender'));
      body.title = app.command;
      const toggle = node('button', undefined, 'switch');
      toggle.setAttribute('role', 'switch'); toggle.setAttribute('aria-checked', String(app.enabled));
      toggle.setAttribute('aria-label', `${app.enabled ? 'Desactivar' : 'Activar'} ${friendly} al iniciar`);
      toggle.addEventListener('click', async () => {
        if (operating) return;
        toggle.disabled = true;
        try {
          const updated = await call('setStartup', app.name, !app.enabled);
          app.enabled = updated.enabled;
          toast(app.enabled ? `${friendly} volverá a abrirse al encender.` : `${friendly} ya no se abrirá al encender. Puedes reactivarla aquí cuando quieras.`);
          renderStartup();
        } catch (e) { toast(e.message); toggle.disabled = false; }
      });
      el.append(icon, body, toggle); list.append(el);
    }
  }

  /* ---------- Cleanup ---------- */
  function selectedCleanup() { return [...$('cleanup-list').querySelectorAll('input:checked')].map(i => i.value); }
  function updateCleanupButton() {
    const ids = selectedCleanup();
    const bytes = cleanupPlan ? cleanupPlan.categories.filter(c => ids.includes(c.id)).reduce((n, c) => n + c.bytes, 0) : 0;
    $('cleanup-run').disabled = !ids.length || cleaning;
    $('cleanup-run').textContent = ids.length ? `Liberar ${size(bytes)}` : 'Liberar espacio';
  }
  function setTotal(bytes) {
    const [value, unit] = fmt(bytes);
    $('cleanup-total').replaceChildren(document.createTextNode(value), node('em', unit));
  }
  function renderCleanup() {
    const list = $('cleanup-list'); list.replaceChildren();
    if (!cleanupPlan) return;
    const max = Math.max(1, ...cleanupPlan.categories.map(c => c.bytes));
    const available = cleanupPlan.categories.filter(c => c.available);
    setTotal(available.reduce((n, c) => n + c.bytes, 0));
    $('cleanup-lead').textContent = available.length ? 'Selecciona qué quieres liberar. Antes de borrar verás un resumen para confirmar.' : 'No hay nada que liberar ahora mismo.';
    $('cleanup-summary').textContent = available.length ? `${size(available.reduce((n, c) => n + c.bytes, 0))} recuperables.` : 'Nada que limpiar ahora mismo.';
    $('cleanup-freed-total').textContent = cleanupPlan.totalFreed ? `${size(cleanupPlan.totalFreed)} liberados en total` : 'Aún no has limpiado';
    $('cleanup-freed-total').className = `tag${cleanupPlan.totalFreed ? ' good' : ''}`;
    for (const c of cleanupPlan.categories) {
      const label = node('label', undefined, `row clean-row${c.available ? '' : ' disabled'}`);
      const input = node('input'); input.type = 'checkbox'; input.value = c.id;
      input.checked = c.available && c.id !== 'recycle'; input.disabled = !c.available;
      input.addEventListener('change', updateCleanupButton);
      const body = node('div'); body.append(node('strong', c.label), node('p', c.reason || c.detail));
      const bar = node('div', undefined, 'size-bar'); const fill = node('i'); fill.style.width = `${Math.max(2, c.bytes / max * 100)}%`; bar.append(fill); body.append(bar);
      label.append(input, body, node('span', c.files ? size(c.bytes) : '—', 'size'));
      list.append(label);
    }
    updateCleanupButton();
  }
  async function scanCleanup() {
    if (cleaning) return;
    $('cleanup-scan').disabled = true; $('cleanup-run').disabled = true;
    $('cleanup-scan').textContent = 'Calculando…'; $('cleanup-scan').setAttribute('aria-busy', 'true');
    $('cleanup-lead').textContent = 'Midiendo temporales, cachés y papelera. Solo se lee, no se borra nada.';
    try { cleanupPlan = await call('cleanupPreview'); if (snapshot) { snapshot.cleanup = { bytes: cleanupPlan.categories.filter(c => c.available).reduce((n, c) => n + c.bytes, 0) }; renderPriorities(); } renderCleanup(); }
    catch (e) { toast(e.message); }
    finally { $('cleanup-scan').disabled = false; $('cleanup-scan').textContent = 'Volver a calcular'; $('cleanup-scan').removeAttribute('aria-busy'); updateCleanupButton(); }
  }
  $('cleanup-scan').addEventListener('click', scanCleanup);
  $('cleanup-run').addEventListener('click', () => {
    const ids = selectedCleanup(); if (!ids.length || !cleanupPlan) return;
    const chosen = cleanupPlan.categories.filter(c => ids.includes(c.id));
    $('cleanup-confirm-title').textContent = `Liberar ${size(chosen.reduce((n, c) => n + c.bytes, 0))}`;
    $('cleanup-confirm-list').replaceChildren(...chosen.map(c => row(c.label, `${c.files.toLocaleString('es-ES')} ${c.id === 'recycle' ? 'elementos' : 'archivos'}`, node('span', size(c.bytes)))));
    $('cleanup-dialog').showModal();
  });
  for (const id of ['cleanup-cancel', 'cleanup-close']) $(id).addEventListener('click', () => $('cleanup-dialog').close());
  $('cleanup-confirm').addEventListener('click', async () => {
    const ids = selectedCleanup(); $('cleanup-dialog').close();
    if (!ids.length || cleaning || operating) return;
    cleaning = true; setOperating(true, 'Liberando espacio');
    let result, failure;
    try { result = await call('cleanupRun', cleanupPlan.token, ids); } catch (e) { failure = e; }
    setOperating(false); cleaning = false;
    if (failure) { toast(failure.message); nova.react('error'); await scanCleanup(); return; }
    nova.react('success');
    const skipped = result.done.filter(d => d.skippedReason).map(d => `${d.label}: ${d.skippedReason}`);
    toast(`${size(result.freed)} liberados.${result.skipped ? ` ${result.skipped.toLocaleString('es-ES')} archivos en uso se han omitido.` : ''}${skipped.length ? ` ${skipped.join(' ')}` : ''}`);
    await scanCleanup();
    if (snapshot) analyze();
  });

  window.starRefreshCleanup = () => { if (!cleaning) scanCleanup(); };
  /* ---------- Snapshot hook ---------- */
  window.onStarSnapshot = s => {
    if (startupApps) s.startupApps = startupApps;
    if (battery) s.battery = battery;
    if (cleanupPlan) s.cleanup = { bytes: cleanupPlan.categories.filter(c => c.available).reduce((n, c) => n + c.bytes, 0) };
    if (!startupApps) loadStartup(); else renderStartup();
    if (device === 'laptop' && !battery) loadBattery();
    if (!cleanupPlan) scanCleanup();
  };
  document.querySelectorAll('[data-view="cleanup"],[data-go="cleanup"]').forEach(b => b.addEventListener('click', () => { if (!cleanupPlan && !cleaning) scanCleanup(); }));
  document.querySelectorAll('[data-view="startup"],[data-go="startup"]').forEach(b => b.addEventListener('click', () => { if (!startupApps) loadStartup(); }));
})();
