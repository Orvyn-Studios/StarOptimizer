'use strict';
const path = require('node:path');
const { execFile } = require('node:child_process');
const win = process.env.SystemRoot || 'C:\\Windows';

function execute(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (!error) return resolve(stdout.trim());
      // Preserve actionable failure codes without exporting command lines or raw stderr.
      const hresult = stderr?.match(/0x[0-9a-f]{8}/i)?.[0]?.toUpperCase();
      const kind = error.killed ? 'timeout' : error.code === 'EACCES' || hresult === '0X80041003' ? 'access-denied' : 'command-failed';
      const failure = new Error(kind === 'access-denied' ? 'Windows denegó el acceso a esta lectura u operación.' : kind === 'timeout' ? 'Windows no respondió antes del límite de 30 segundos.' : 'Windows no pudo completar la operación.');
      failure.diagnostic = { kind, code: hresult || error.code || error.signal || null };
      reject(failure);
    });
  });
}

function parsePowerShellJson(output) {
  // An empty successful pipeline (e.g. no startup entries) emits no JSON.
  const text = output.replace(/^\uFEFF/, '').trim();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch {
    const failure = new Error('Windows devolvió una lectura con formato no válido.');
    failure.diagnostic = { kind: 'invalid-output', code: null };
    throw failure;
  }
}

async function ps(script) {
  const prefix = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); $ErrorActionPreference = "Stop"; ';
  return parsePowerShellJson(await execute(path.join(win, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(prefix + script, 'utf16le').toString('base64')]));
}
async function power(args) { return execute(path.join(win, 'System32/powercfg.exe'), args); }
module.exports = { execute, parsePowerShellJson, ps, power };
