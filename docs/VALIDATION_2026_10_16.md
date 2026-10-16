# Validación local de StarOptimizer 2.0 — 16 de octubre de 2026

**Dictamen: no fusionar ni publicar.** Hay pruebas unitarias reales aprobadas y cinco arreglos comprobados, pero la instalación de dependencias y parte del escáner están bloqueadas en esta sesión. La validación de Electron, las restauraciones sobre Windows y la matriz de hardware siguen pendientes. Este informe no certifica una versión estable.

## Estado inicial y alcance autorizado

- Repositorio: `SnoW-099/StarOptimizer`, ruta local `C:\Users\angel\StarOptimizer`.
- Rama: `feature/orvyn-staroptimizer-2`, inicialmente limpia, sobre `08fadccf1320c0a16acf0a59be9436ea8032270b`.
- PR [#1](https://github.com/SnoW-099/StarOptimizer/pull/1): abierto y en borrador al revisarlo.
- `origin/main` observado: `824440dbc5d3358304be0bc5befde27ad767fb9a`. No se ha modificado `main`, fusionado, etiquetado, publicado ni desplegado.
- Se han leído completos `AGENTS.md`, `CODEX_HANDOFF.md` y `ORVYN_2_0.md` antes de editar.
- El usuario autorizó subir cinco commits de arreglos y un sexto final a su cuenta. La conexión GitHub se ha comprobado como `SnoW-099`. La subida se dirige únicamente a la rama de desarrollo.

## Entorno y dependencias

| Comprobación | Resultado observado |
| --- | --- |
| Node.js | `v24.20.0` |
| npm | `11.19.0`, mediante `npm.cmd` |
| Git | `2.55.0.windows.3` |
| Windows reportado por Node | `10.0.26300` |
| CPU leída por Node | AMD Ryzen AI 7 445 con Radeon 840M |
| RAM total observada | Aproximadamente 15,2 GiB |
| Versión de esta rama | `2.0.0-beta.1`, sin release 2.0 |

PowerShell bloquea `npm.ps1` por su política de ejecución. `npm.cmd` funciona; no se ha cambiado la política. El lockfile requiere Node `>=22.12.0` para Electron 44.2.0, `@electron/get` y el extractor; ese mínimo queda declarado en `package.json` y su entrada raíz del lockfile. Los rangos y versiones de las dependencias se mantienen.

`npm.cmd ci` se ejecutó y terminó con código 1: `EACCES` al descargar `https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz`. También falló la consulta de avisos de seguridad y hubo advertencias `EPERM` de limpieza. No hay instalación completa: no se puede afirmar que las dependencias estén verificadas, libres de vulnerabilidades ni listas para arrancar Electron.

La conexión Git directa a `github.com:443` también falló. El conector GitHub sí permite consultar el repositorio. Ninguno de esos fallos justifica cambiar el lockfile, sustituir paquetes a ciegas, desactivar seguridad ni pedir privilegios de administrador para la aplicación.

## Cinco arreglos

1. **Escáner y comandos Windows.** Se separó el ejecutor en `src/windows-command.cjs`. Una consulta PowerShell correcta sin filas ahora produce un inventario vacío en vez de un error de JSON. Se conservan el tipo de fallo y su código en `errorDetails`, sin añadir comandos ni stderr sin filtrar al diagnóstico exportable. Se comprueban Unicode, salida vacía y errores mediante procesos reales de Node. El smoke test mantiene su condición de fallo cuando no hay inventario de discos.
2. **Modos y lecturas parciales.** El estado de configuración identifica las claves no disponibles. Gaming y Extremo conservan únicamente opciones con lecturas válidas si otro ajuste falla. Un error genérico antiguo sin detalle sigue bloqueando las opciones afectadas de forma conservadora. Gaming exige alimentación de red conocida y que tanto el plan de destino como el original figuren en la lista. Inteligente sigue sin tratar preferencias como averías.
3. **Nova y trabajo por fotograma.** La posición del personaje se consulta dentro del fotograma, después de agrupar eventos y antes de escribir estilos. Una ráfaga instrumentada de 100 eventos pasó de 100 llamadas a `getBoundingClientRect()` a una. Se conserva la última posición del puntero. Las pruebas verifican la cancelación de trabajo al ocultarse, activar movimiento reducido, usar apariencia sencilla o destruir el controlador.
4. **Integridad de mediciones.** Se rechazan muestras ausentes, cambios en la RAM total durante una serie y resúmenes persistidos con porcentajes, picos, RAM o cantidades de muestras imposibles. Un historial inválido se conserva y bloquea nuevas escrituras. Las pruebas usan archivos reales en directorios temporales.
5. **Requisito de Node.** El mínimo `>=22.12.0` queda declarado de forma consistente con el lockfile y el descargador de Electron. La comprobación de metadatos confirma que los rangos de dependencias no han cambiado.

El sexto commit reúne este informe y corrige documentación antigua: repositorio público, versión beta, política real de los modos, umbral doble de almacenamiento y uso de `npm.cmd` en PowerShell.

## Pruebas ejecutadas y límites

| Prueba | Resultado |
| --- | --- |
| `npm.cmd test`, antes de editar | 39 aprobadas, 0 fallos |
| `npm.cmd test`, tras los arreglos | 48 aprobadas, 0 fallos, 0 omitidas |
| Reproducción inicial de Nova | La nueva prueba falló con 100 consultas de posición por ráfaga; pasa tras el arreglo |
| Metadatos de runtime y lockfile | Aprobados mediante aserciones de Node |
| `git diff --check` | Sin errores |
| `node --check src/nova.js` | Aprobado |
| `npm.cmd run test:windows:smoke` | Ejecutado sobre el adaptador Windows real; falla por inventario de discos no disponible |
| `test:ui`, `test:workflow`, `test:scan`, `test:live`, `test:nova`, `test:measure` | Los seis se intentaron; todos terminan con `MODULE_NOT_FOUND: @playwright/test` antes de iniciar Electron |
| Compilación portable | No ejecutada: los controles previos no están aprobados |
| Restauración de ajustes sobre Windows | No ejecutada; requiere aprobación específica y respaldo según el contrato del repositorio |

Las pruebas de transacciones usan adaptadores aislados: no acreditan escrituras/restauraciones reales sobre este PC. Las pruebas de Nova ejecutan el controlador real con DOM y planificación instrumentados: no sustituyen Playwright, capturas, mediciones de GPU ni ensayos de DPI.

## Escáner real de Windows

Se observaron CPU, RAM, 30 grupos de procesos y un plan de energía. No se pudieron leer discos lógicos, GPU, inicio ni discos físicos. Las consultas CIM directas reprodujeron «Acceso denegado» (`0x80041003`); `Get-PhysicalDisk` también devolvió acceso denegado. No se ha determinado si la restricción procede exclusivamente del entorno de esta sesión o también de políticas del anfitrión. No se han alterado permisos WMI ni políticas de Windows.

Una ejecución después del primer arreglo duró **11 784 ms**, frente a **13 042 ms** de la ejecución inicial. Son lecturas parciales tomadas en condiciones distintas: esos tiempos **no demuestran una mejora de velocidad**. CPU observada en esas dos lecturas: 77 % y 61 %, respectivamente; son muestras de carga, no medidas de capacidad ni puntuaciones de salud.

El fallo ya expone:

```json
{
  "disks": { "kind": "access-denied", "code": "0X80041003" },
  "startup": { "kind": "access-denied", "code": "0X80041003" },
  "gpu": { "kind": "access-denied", "code": "0X80041003" },
  "physicalDisks": { "kind": "command-failed", "code": 1 }
}
```

La reducción medible de trabajo de Nova es de 100 a una consulta de posición para esa ráfaga instrumentada. No se ha medido una reducción de CPU/RAM de la aplicación completa, consumo en reposo, temperaturas, FPS o latencia visual. No se atribuyen ganancias de rendimiento al PC.

## Investigación de GitHub Actions

Se consultaron los jobs del [run del handoff](https://github.com/SnoW-099/StarOptimizer/actions/runs/38915744774) y del [run sobre el estado inicial de esta sesión](https://github.com/SnoW-099/StarOptimizer/actions/runs/38933434853).

En el segundo run, los tres jobs —unidades Windows, unidades Ubuntu e integración Windows— tienen `runner_id: 0`, nombre de runner vacío, `steps: []` y conclusión `failure`. Duraron entre tres y cuatro segundos el 16 de octubre de 2026 a las 16:37 UTC. Por tanto, no ejecutaron checkout, Node, npm ni ninguna prueba. No hay un fallo de aplicación demostrado por esos jobs.

El workflow solicita `windows-latest` y `ubuntu-latest`; no exige etiquetas de runners propios. No se ha cambiado YAML para intentar arreglar un rechazo anterior a la asignación del runner.

**Causa exacta pendiente.** El conector disponible rechaza el endpoint de anotaciones de check-runs, el acceso HTTP directo está bloqueado y la página del run no se ha podido obtener con el navegador web de herramientas. Hace falta copiar el texto de la anotación de Actions → run → Summary. No se ha confirmado un bloqueo de facturación, de elegibilidad o de políticas de cuenta.

La [documentación oficial de GitHub](https://docs.github.com/en/billing/concepts/product-billing/github-actions) indica que los runners estándar son gratuitos para repositorios públicos. Por eso no se debe asumir que la solución sea pagar o ampliar presupuesto. Si la anotación menciona facturación, el propietario debe contrastarla con el estado de su cuenta; si menciona políticas o elegibilidad, se debe resolver esa condición específica. No se han cambiado pagos, límites ni ajustes de la cuenta.

## Revisión de interfaz y Nova

Se aplicó la habilidad `ui-craft` para revisar estados y trabajo del controlador, manteniendo CSS, tipografía, colores y estructura existentes. Se inspeccionaron `renderer.js`, `nova.js`, `nova.css` y los tests de Electron. No se ha certificado contraste, teclado, DPI ni apariencia renderizada.

| Antes | Después | Por qué |
| --- | --- | --- |
| Una consulta de posición por evento del puntero | Una consulta por fotograma con la posición más reciente | Evita trabajo repetido; respeta el criterio de agrupar lecturas antes de escrituras |
| Suspensión de Nova implementada pero sin prueba unitaria del ciclo de vida | Cancelación comprobada al ocultarse, reducir movimiento, simplificar y destruir | La ausencia de trabajo debe verificarse, no suponerse |

Pendientes concretos: `render()` aún usa el texto «Última lectura completa» incluso en análisis parciales; Optimizar conserva perfiles distintos del selector de objetivos de Recomendados. Ambos necesitan una revisión conjunta en Electron para unificar mensajes y selección sin cambiar el consentimiento ni la recuperación. Se dejan registrados; no se declara solucionada la interfaz.

## Siguiente validación y Nivo

1. Abrir el repositorio con acceso permitido a npm y a las consultas Windows necesarias; repetir `npm.cmd ci`. No desactivar controles de seguridad como solución genérica.
2. Repetir unidades, smoke test y los seis tests Electron. Revisar capturas reales, ventanas pequeñas, temas, teclado y DPI 100/125/150/200 %.
3. Resolver la anotación concreta de Actions y verificar una ejecución con runner asignado y pasos reales.
4. Medir reposo visible/oculto, escaneo y Nova en condiciones controladas. Comparar mismas tareas, alimentación y entorno.
5. Tras aprobación específica y respaldo, probar aplicación/restauración nativas en Windows 10/11, batería/corriente y Modern Standby. Solo después preparar y verificar el portable sin publicarlo.
6. Entregar el informe de aceptación completo y solicitar autorización antes de fusionar o publicar.

**Nivo permanece pendiente.** La condición del usuario es empezar cuando StarOptimizer esté listo, y estos bloqueos impiden afirmarlo. Se mantiene como aplicación y repositorio independientes; no se han incorporado funciones Dynamic Island al optimizador ni creado un nuevo repositorio.
