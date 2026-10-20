const path = require('node:path');
const queries = new Set(['disks', 'processes', 'startup', 'gpu', 'physical-disks', 'visual-state']);
const visuals = new Set(['animations', 'menuAnimation', 'comboAnimation']);

function createWindowsBridge(execute, directory = __dirname) {
  // Executables must live outside app.asar, including in a portable build.
  const unpacked = directory.replace(/([\\/])app\.asar(?=[\\/])/, '$1app.asar.unpacked');
  const executable = path.join(unpacked, 'native', 'StarOptimizer.System.exe');
  return {
    async query(name) {
      if (!queries.has(name)) throw Error('Consulta de Windows no permitida.');
      return JSON.parse(await execute(executable, [name]));
    },
    async setVisual(key, value) {
      if (!visuals.has(key) || typeof value !== 'boolean') throw Error('Ajuste visual no válido.');
      const result = JSON.parse(await execute(executable, ['set-visual', key, String(value)]));
      if (result !== true) throw Error('Windows no confirmó el ajuste visual.');
    }
  };
}
module.exports = { createWindowsBridge };
