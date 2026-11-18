'use strict';
// Real, user-confirmed tools: device detection, battery health, startup apps,
// space cleanup and two reversible registry preferences. Nothing here runs on scan.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { ps, power } = require('./windows-command.cjs');

const b64 = text => Buffer.from(String(text), 'utf8').toString('base64');
const psString = text => `([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64(text)}')))`;
const list = value => value == null ? [] : [].concat(value);

/* ---------- Device: desktop or laptop ---------- */
// SMBIOS chassis types: https://www.dmtf.org/standards/smbios
const LAPTOP_CHASSIS = new Set([8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32]);
const DESKTOP_CHASSIS = new Set([3, 4, 5, 6, 7, 13, 15, 16, 23, 24, 35, 36]);
function classifyDevice({ chassis = [], hasBattery = false, pcSystemType = null } = {}) {
  const types = list(chassis).map(Number);
  if (types.some(c => LAPTOP_CHASSIS.has(c)) || pcSystemType === 2) return 'laptop';
  if (types.some(c => DESKTOP_CHASSIS.has(c)) || pcSystemType === 1 || pcSystemType === 3) return hasBattery ? 'laptop' : 'desktop';
  return hasBattery ? 'laptop' : null;
}
async function deviceHint(run = ps) {
  const raw = await run('$e = @(Get-CimInstance Win32_SystemEnclosure | ForEach-Object { $_.ChassisTypes } | ForEach-Object { [int]$_ }); $b = @(Get-CimInstance Win32_Battery); $c = $null; if ($b.Count -gt 0) { $c = [int]$b[0].EstimatedChargeRemaining }; [PSCustomObject]@{ chassis = $e; hasBattery = ($b.Count -gt 0); charge = $c; pcSystemType = [int](Get-CimInstance Win32_ComputerSystem).PCSystemType } | ConvertTo-Json -Compress');
  const data = { chassis: list(raw?.chassis), hasBattery: raw?.hasBattery === true, charge: Number.isFinite(raw?.charge) && raw.charge >= 0 && raw.charge <= 100 ? raw.charge : null, pcSystemType: Number.isFinite(raw?.pcSystemType) ? raw.pcSystemType : null };
  return { ...data, suggested: classifyDevice(data) };
}

/* ---------- Battery health (read-only powercfg report) ---------- */
function parseBatteryReport(xml) {
  const batteries = [...String(xml).matchAll(/<Battery>([\s\S]*?)<\/Battery>/g)].map(([, body]) => {
    const tag = name => { const m = body.match(new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`)); return m ? m[1] : null; };
    const design = Number(tag('DesignCapacity')), full = Number(tag('FullChargeCapacity')), cycles = Number(tag('CycleCount'));
    if (!Number.isFinite(design) || design <= 0 || !Number.isFinite(full) || full <= 0) return null;
    return { name: tag('Id') || tag('Manufacturer') || 'Batería', design, full, cycles: Number.isFinite(cycles) && cycles > 0 ? cycles : null, health: Math.min(100, Math.round(full / design * 100)) };
  }).filter(Boolean);
  return batteries;
}
async function batteryReport(runPower = power) {
  const file = path.join(os.tmpdir(), `staroptimizer-battery-${randomUUID()}.xml`);
  try {
    await runPower(['/batteryreport', '/xml', '/output', file]);
    return parseBatteryReport(await fs.readFile(file, 'utf8'));
  } finally { await fs.rm(file, { force: true }); }
}

/* ---------- Startup apps (current user, same mechanism as Task Manager) ---------- */
const RUN = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const APPROVED = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
// StartupApproved: first byte even = enabled (02, 06), odd = disabled (03, 07). Missing = enabled.
const startupEnabled = flag => flag == null || (Number(flag) & 1) === 0;
async function startupApps(run = ps) {
  const rows = await run(`$run = Get-Item -LiteralPath '${RUN}' -ErrorAction SilentlyContinue; if (-not $run) { return }; $ap = Get-Item -LiteralPath '${APPROVED}' -ErrorAction SilentlyContinue; @($run.Property | ForEach-Object { $flag = $null; if ($ap -and ($ap.Property -contains $_)) { $bytes = $ap.GetValue($_); if ($bytes -and $bytes.Length) { $flag = [int]$bytes[0] } }; [PSCustomObject]@{ Name = [string]$_; Command = [string]$run.GetValue($_); Flag = $flag } }) | ConvertTo-Json -Compress`);
  return list(rows).filter(r => r && typeof r.Name === 'string' && r.Name).map(r => ({ name: r.Name, command: typeof r.Command === 'string' ? r.Command : '', enabled: startupEnabled(r.Flag) }));
}
async function setStartup(name, enabled, run = ps) {
  if (typeof name !== 'string' || !name || name.length > 260 || typeof enabled !== 'boolean') throw Error('Entrada de inicio no válida.');
  const current = (await startupApps(run)).find(a => a.name === name);
  if (!current) throw Error('Esa aplicación ya no está en el inicio de Windows.');
  if (current.enabled === enabled) return current;
  const bytes = enabled ? '[byte[]](2,0,0,0,0,0,0,0,0,0,0,0)' : '[byte[]](@(3,0,0,0) + [BitConverter]::GetBytes([DateTime]::UtcNow.ToFileTimeUtc()))';
  // Test-Path + New-Item without -Force: -Force would recreate the key and wipe other apps' states.
  await run(`$n = ${psString(name)}; if (-not (Test-Path -LiteralPath '${APPROVED}')) { New-Item -Path '${APPROVED}' | Out-Null }; Set-ItemProperty -LiteralPath '${APPROVED}' -Name $n -Value ${bytes} -Type Binary; $true | ConvertTo-Json`);
  const after = (await startupApps(run)).find(a => a.name === name);
  if (!after || after.enabled !== enabled) throw Error('Windows no confirmó el cambio de inicio.');
  return after;
}

/* ---------- Reversible registry preferences, merged into the optimizer adapter ---------- */
const TOGGLES = {
  transparency: { key: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', name: 'EnableTransparency', missing: null },
  gameMode: { key: 'HKCU:\\Software\\Microsoft\\GameBar', name: 'AutoGameModeEnabled', missing: true }, // Windows 10 1903+ default: on
  // Xbox Game Bar background capture keeps an encoder ready while you play.
  gameCapture: { key: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', name: 'AppCaptureEnabled', missing: true },
  // Tips, suggestions and "get even more out of Windows" notifications.
  windowsTips: { key: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'SubscribedContent-338389Enabled', missing: true },
  // Stored inverted by Windows: GlobalUserDisabled = 1 means background apps are off.
  backgroundApps: { key: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications', name: 'GlobalUserDisabled', missing: true, inverted: true }
};
async function readToggles(run = ps) {
  const raw = await run('$r = @{}; ' + Object.entries(TOGGLES).map(([id, t]) => `$v = (Get-ItemProperty -LiteralPath '${t.key}' -ErrorAction SilentlyContinue).'${t.name}'; if ($null -eq $v) { $r['${id}'] = $null } else { $r['${id}'] = ([int]$v ${t.inverted ? '-eq' : '-ne'} 0) }; `).join('') + '$r | ConvertTo-Json -Compress');
  return Object.fromEntries(Object.entries(TOGGLES).map(([id, t]) => [id, typeof raw?.[id] === 'boolean' ? raw[id] : t.missing]));
}
async function setToggle(id, value, run = ps) {
  const t = TOGGLES[id];
  if (!t || typeof value !== 'boolean') throw Error('Ajuste no válido.');
  await run(`if (-not (Test-Path -LiteralPath '${t.key}')) { New-Item -Path '${t.key}' | Out-Null }; Set-ItemProperty -LiteralPath '${t.key}' -Name '${t.name}' -Value ${value !== Boolean(t.inverted) ? 1 : 0} -Type DWord; $true | ConvertTo-Json`);
}
function extendAdapter(base, run = ps) {
  return {
    async snapshot() {
      const [state, toggles] = await Promise.all([base.snapshot(), readToggles(run).catch(() => ({}))]);
      const values = { ...state.values, ...Object.fromEntries(Object.keys(TOGGLES).map(id => [id, toggles[id] ?? null])) };
      return { ...state, values, unavailable: Object.keys(values).filter(k => values[k] === null) };
    },
    set: (key, value) => Object.hasOwn(TOGGLES, key) ? setToggle(key, value, run) : base.set(key, value)
  };
}

/* ---------- Space cleanup: preview, explicit confirmation, report ---------- */
const DAY = 24 * 3600 * 1000;
function cleanupTargets(env = process.env) {
  const local = env.LOCALAPPDATA, roaming = env.APPDATA, temp = env.TEMP || os.tmpdir();
  const browser = (id, label, base, processName) => ({ id, label, detail: `Archivos de caché que ${label.replace('Caché de ', '')} vuelve a descargar cuando los necesita. No borra contraseñas, historial ni marcadores.`, process: processName, roots: base ? [{ base, profiles: true, sub: ['Cache', 'Cache_Data'] }, { base, profiles: true, sub: ['Code Cache'] }, { base, profiles: true, sub: ['GPUCache'] }] : [] });
  return [
    { id: 'temp', label: 'Archivos temporales', detail: 'Archivos temporales de tus aplicaciones con más de 24 horas. Se omiten los que estén en uso.', roots: temp ? [{ base: temp }] : [], olderThan: DAY },
    { id: 'crash', label: 'Informes de errores', detail: 'Volcados que dejan las apps al cerrarse inesperadamente. Solo sirven para depurar.', roots: local ? [{ base: path.join(local, 'CrashDumps') }] : [] },
    browser('chrome', 'Caché de Chrome', local && path.join(local, 'Google', 'Chrome', 'User Data'), 'chrome'),
    browser('edge', 'Caché de Edge', local && path.join(local, 'Microsoft', 'Edge', 'User Data'), 'msedge'),
    browser('brave', 'Caché de Brave', local && path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data'), 'brave'),
    { id: 'discord', label: 'Caché de Discord', detail: 'Imágenes y datos que Discord vuelve a descargar. No afecta a tus mensajes.', process: 'discord', roots: roaming ? [{ base: path.join(roaming, 'discord'), sub: ['Cache', 'Cache_Data'] }, { base: path.join(roaming, 'discord'), sub: ['Code Cache'] }, { base: path.join(roaming, 'discord'), sub: ['GPUCache'] }] : [] },
    { id: 'thumbs', label: 'Miniaturas de Windows', detail: 'Vistas previas de imágenes del Explorador. Windows las regenera al abrir carpetas.', roots: local ? [{ base: path.join(local, 'Microsoft', 'Windows', 'Explorer'), match: /^thumbcache_.*\.db$/i, shallow: true }] : [] }
  ];
}
async function expandRoots(target) {
  const dirs = [];
  for (const root of target.roots) {
    if (!root.base) continue;
    let bases = [root.base];
    if (root.profiles) {
      try { bases = (await fs.readdir(root.base, { withFileTypes: true })).filter(d => d.isDirectory() && !d.isSymbolicLink() && /^(Default|Profile \d+|Guest Profile)$/.test(d.name)).map(d => path.join(root.base, d.name)); }
      catch { bases = []; }
    }
    for (const b of bases) dirs.push({ dir: root.sub ? path.join(b, ...root.sub) : b, match: root.match, shallow: root.shallow });
  }
  return dirs;
}
// Never follows links or junctions and stays inside the resolved root.
async function walk(root, { olderThan, match, shallow, now, limit = 300000 }, onFile) {
  let real;
  try { real = await fs.realpath(root); } catch { return; }
  const stack = [real]; let seen = 0;
  while (stack.length) {
    const dir = stack.pop(); let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (++seen > limit) return;
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (shallow) continue;
        try { const r = await fs.realpath(full); if (r.startsWith(real + path.sep)) stack.push(r); } catch { /* unreadable */ }
        continue;
      }
      if (!e.isFile() || (match && !match.test(e.name))) continue;
      let st; try { st = await fs.lstat(full); } catch { continue; }
      if (!st.isFile() || (olderThan && now - st.mtimeMs < olderThan)) continue;
      await onFile(full, st.size, dir === real ? null : dir);
    }
  }
}
async function runningProcesses(names, run = ps) {
  if (!names.length) return [];
  const rows = await run(`@(Get-Process -Name ${names.map(n => `'${n}'`).join(',')} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessName -Unique) | ConvertTo-Json -Compress`).catch(() => []);
  return list(rows).map(n => String(n).toLowerCase());
}
async function recycleBin(run = ps) {
  const r = await run('$s = (New-Object -ComObject Shell.Application).NameSpace(10); $t = [int64]0; $n = 0; foreach ($i in $s.Items()) { $n++; try { $t += [int64]$i.ExtendedProperty("System.Size") } catch {} }; [PSCustomObject]@{ count = $n; bytes = $t } | ConvertTo-Json -Compress');
  return { count: Number(r?.count) || 0, bytes: Number(r?.bytes) || 0 };
}
function createCleanup(directory, { run = ps, env = process.env, now = Date.now } = {}) {
  const tokens = new Map(); const logFile = path.join(directory, 'cleanup-log.json');
  async function log() { try { const v = JSON.parse(await fs.readFile(logFile, 'utf8')); return Array.isArray(v) ? v.filter(e => Number.isFinite(e?.freed)) : []; } catch { return []; } }
  async function measureTarget(target) {
    let bytes = 0, files = 0;
    for (const { dir, match, shallow } of await expandRoots(target)) await walk(dir, { olderThan: target.olderThan, match, shallow, now: now() }, (_f, size) => { bytes += size; files++; });
    return { bytes, files };
  }
  async function preview() {
    const targets = cleanupTargets(env);
    const running = await runningProcesses(targets.filter(t => t.process).map(t => t.process), run);
    const categories = [];
    for (const t of targets) {
      const { bytes, files } = await measureTarget(t);
      if (!files && t.process) continue; // App not installed or nothing cached.
      const busy = t.process && running.includes(t.process);
      categories.push({ id: t.id, label: t.label, detail: t.detail, bytes, files, available: files > 0 && !busy, busy: Boolean(busy), process: t.process || null, reason: busy ? `Cierra ${t.label.replace('Caché de ', '')} para limpiar su caché. Se activará sola en cuanto lo cierres.` : files ? null : 'Nada que limpiar.' });
    }
    try {
      const bin = await recycleBin(run);
      categories.push({ id: 'recycle', label: 'Papelera de reciclaje', detail: 'Vacía la papelera. Lo que hay en ella ya no se podrá recuperar.', bytes: bin.bytes, files: bin.count, available: bin.count > 0, reason: bin.count ? null : 'La papelera está vacía.' });
    } catch { categories.push({ id: 'recycle', label: 'Papelera de reciclaje', detail: 'Windows no permitió consultar la papelera.', bytes: 0, files: 0, available: false, reason: 'No disponible.' }); }
    for (const [k, v] of tokens) if (now() - v > 600000) tokens.delete(k);
    const token = randomUUID(); tokens.set(token, now());
    const history = await log();
    return { token, categories, totalFreed: history.reduce((n, e) => n + e.freed, 0) };
  }
  async function clean(token, ids) {
    const created = tokens.get(token); tokens.delete(token);
    if (!created || now() - created > 600000) throw Error('La revisión ha caducado. Vuelve a calcular el espacio.');
    const targets = cleanupTargets(env);
    if (!Array.isArray(ids) || !ids.length || ids.some(id => id !== 'recycle' && !targets.some(t => t.id === id))) throw Error('Selección no válida.');
    const running = await runningProcesses(targets.filter(t => t.process && ids.includes(t.id)).map(t => t.process), run);
    let freed = 0, removed = 0, skipped = 0; const done = [];
    for (const t of targets.filter(t => ids.includes(t.id))) {
      if (t.process && running.includes(t.process)) { done.push({ id: t.id, label: t.label, freed: 0, skippedReason: 'La aplicación está abierta.' }); continue; }
      let f = 0; const dirs = new Set();
      for (const { dir, match, shallow } of await expandRoots(t)) {
        await walk(dir, { olderThan: t.olderThan, match, shallow, now: now() }, async (file, size, parent) => {
          try { await fs.unlink(file); f += size; removed++; if (parent) dirs.add(parent); } catch { skipped++; }
        });
      }
      // Remove now-empty subfolders (deepest first); rmdir never deletes non-empty folders.
      for (const d of [...dirs].sort((a, b) => b.length - a.length)) await fs.rmdir(d).catch(() => {});
      freed += f; done.push({ id: t.id, label: t.label, freed: f });
    }
    if (ids.includes('recycle')) {
      try {
        const before = await recycleBin(run);
        if (before.count) { await run('Clear-RecycleBin -Force -ErrorAction Stop; $true | ConvertTo-Json'); freed += before.bytes; removed += before.count; }
        done.push({ id: 'recycle', label: 'Papelera de reciclaje', freed: before.bytes });
      } catch { done.push({ id: 'recycle', label: 'Papelera de reciclaje', freed: 0, skippedReason: 'Windows no permitió vaciarla.' }); }
    }
    const history = await log();
    history.unshift({ at: new Date(now()).toISOString(), freed, removed, skipped, categories: done.map(d => d.id) });
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(logFile + '.tmp', JSON.stringify(history.slice(0, 100), null, 2)); await fs.rename(logFile + '.tmp', logFile);
    return { freed, removed, skipped, done, totalFreed: history.reduce((n, e) => n + e.freed, 0) };
  }
  // Cheap check (no file walk) so the view can notice when a browser is closed.
  async function busy() {
    return runningProcesses(cleanupTargets(env).filter(t => t.process).map(t => t.process), run);
  }
  return { preview, clean, log, busy };
}

module.exports = { classifyDevice, deviceHint, parseBatteryReport, batteryReport, startupEnabled, startupApps, setStartup, readToggles, setToggle, extendAdapter, cleanupTargets, walk, createCleanup };
