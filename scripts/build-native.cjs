const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

function buildNative(projectDirectory = path.join(__dirname, '..')) {
  if (process.platform !== 'win32') throw Error('Compila el componente de Windows en Windows 10/11 x64.');
  const framework = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
  const compiler = path.join(framework, 'csc.exe');
  if (!fs.existsSync(compiler)) throw Error('No se encuentra el compilador de .NET Framework 4.x de Windows.');
  const output = path.join(projectDirectory, 'src', 'native', 'StarOptimizer.System.exe');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  // A failed rebuild must not silently package an older helper.
  fs.rmSync(output, { force: true });
  execFileSync(compiler, [
    '/nologo', '/optimize+', '/platform:x64', '/target:exe', '/utf8output',
    '/reference:System.Management.dll', '/reference:System.Web.Extensions.dll',
    `/out:${output}`, path.join(projectDirectory, 'native', 'SystemProbe.cs')
  ], { stdio: 'inherit', windowsHide: true });
  if (!fs.existsSync(output)) throw Error('El compilador no ha generado el componente de Windows.');
  return output;
}

// electron-builder calls this before collecting files and signing executables.
exports.default = context => {
  if (context.electronPlatformName === 'win32') buildNative(context.packager.projectDir);
};
exports.buildNative = buildNative;
if (require.main === module) {
  try { buildNative(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
