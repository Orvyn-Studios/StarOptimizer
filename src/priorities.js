/* Recommendations are observations from a completed snapshot, never assumed faults. */
(function (root) {
  function priorities(s, mode = 'intelligent') {
    if (!['intelligent', 'gaming', 'extreme'].includes(mode)) mode = 'intelligent';
    if (!s) return [];
    const list = [], errors = s.errors || [];
    const add = (priority, title, evidence, action, view, badge) => list.push({ priority, title, evidence, action, view, badge });
    const names = { cpu: 'CPU', memory: 'memoria', disks: 'almacenamiento', physicalDisks: 'estado físico de discos', processes: 'procesos', startup: 'inicio', plans: 'energía', gpu: 'GPU', configuration: 'ajustes de Windows' };
    if (!errors.includes('physicalDisks')) for (const disk of s.physicalDisks || []) {
      if (['Warning','Unhealthy'].includes(disk.HealthStatus)) add(0, `Proteger los datos de ${disk.Name}`, `Windows reporta ${disk.HealthStatus}. Prioriza una copia de tus archivos importantes y revisar la unidad antes de buscar más rendimiento.`, 'Ver estado de discos', 'tuneup', 'Aviso del disco');
    }
    if (errors.length) add(0, 'Completar las lecturas pendientes', `Windows no pudo consultar: ${errors.map(key => names[key] || key).join(', ')}. Las recomendaciones solo cubren los datos disponibles.`, 'Volver a analizar', 'scan');
    if (!errors.includes('disks')) for (const d of s.disks || []) {
      if (Number.isFinite(d.Size) && d.Size > 0 && Number.isFinite(d.FreeSpace) && d.FreeSpace >= 0 && d.FreeSpace / d.Size < .15 && d.FreeSpace < 32 * 1024 ** 3)
        add(1, `Revisar el espacio de ${d.DeviceID}`, `${Math.round(d.FreeSpace / d.Size * 100)} % libre en esta unidad. Considera mover archivos que reconozcas a otra unidad; no se borra nada automáticamente.`, 'Ver almacenamiento', 'processes');
    }
    const m = s.memory;
    if (!errors.includes('memory') && Number.isFinite(m?.total) && m.total > 0 && Number.isFinite(m.free) && m.free >= 0 && m.free <= m.total && (m.total - m.free) / m.total > .85)
      add(1, 'Revisar las aplicaciones que ocupan memoria', (() => {
        const top = !errors.includes('processes') && Array.isArray(s.processes)
          ? s.processes.filter(x => Number.isFinite(x.WorkingSet64) && x.WorkingSet64 > 0 && typeof x.ProcessName === 'string')
            .sort((a, b) => b.WorkingSet64 - a.WorkingSet64)[0] : null;
        const detail = top && top.WorkingSet64 >= m.total * .12
          ? ` El grupo ${top.ProcessName} tiene aprox. ${(top.WorkingSet64 / 1073741824).toFixed(1)} GB de memoria residente; revísalo antes de cerrar nada.` : '';
        return `${Math.round((m.total - m.free) / m.total * 100)} % de RAM ocupada en esta lectura.${detail} Guarda tu trabajo antes de cerrar aplicaciones que no necesites.`;
      })(), 'Ver recursos', 'processes');
    const cpu = s.cpu?.[0]?.LoadPercentage;
    if (!errors.includes('cpu') && Number.isFinite(cpu) && cpu > 80 && cpu <= 100)
      add(2, 'Comprobar si la carga de CPU se mantiene', `${cpu} % de carga${s.cpu[0].Samples > 1 ? ` media de ${s.cpu[0].Samples} muestras` : ' en una muestra'}. Revisa la tarea que está usando el procesador.`, 'Ver recursos', 'processes');
    // Startup inventory alone is not evidence of a problem: Windows also lists disabled items.
    // Keep the inventory accessible in its dedicated tab, without a default warning.
    // Choosing Economizador or enabling animations is not itself a fault.
    // Do not recommend changing intentional user preferences in Intelligent mode.
    // Explicit user-selected goals are preferences, never fabricated scan findings.
    // All changes still use the existing preview / apply / rollback engine.
    const power = s.configuration?.values?.power;
    const high = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
    const isAc = s.onBattery === false;
    const highAvailable = s.configuration?.plans?.some(p => p.id === high);
    const modeName = mode === 'gaming' ? 'Gaming' : 'Extremo';
    if (mode !== 'intelligent' && isAc && !errors.includes('plans') && !errors.includes('configuration') && highAvailable && power && power !== high) {
      list.push({ priority: 3, title: `Opcional (${modeName}): plan Alto rendimiento`, evidence: 'El equipo está conectado a corriente y Windows dispone de Alto rendimiento. No garantiza más FPS; puede aumentar temperatura, ruido y consumo. Se aplicará solo tras confirmación.', action: 'Revisar plan de energía', view: 'recommendations', changes: { power: high } });
    }
    if (mode === 'extreme' && !errors.includes('configuration')) {
      const changes = Object.fromEntries(['animations', 'menuAnimation', 'comboAnimation']
        .filter(key => s.configuration?.values?.[key] === true).map(key => [key, false]));
      if (Object.keys(changes).length) list.push({ priority: 3, title: 'Opcional (Extremo): reducir efectos de Windows', evidence: 'Es una preferencia del modo Extremo, no una avería detectada. Puede hacer que los menús parezcan más inmediatos; no aumenta necesariamente los FPS ni libera RAM.', action: 'Revisar efectos visuales', view: 'recommendations', changes });
    }
    return list.sort((a, b) => a.priority - b.priority);
  }
  if (typeof module !== 'undefined') module.exports = priorities;
  else root.starPriorities = priorities;
})(globalThis);
