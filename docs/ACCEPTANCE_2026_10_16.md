# Revisión de aceptación posterior a la prerelease — 2026-10-16

**Resultado: no publicar como versión final todavía.** El usuario ha autorizado la publicación, pero la aceptación de interfaz y Windows no está completada. La autorización no convierte los fallos o pruebas bloqueadas en resultados aprobados. Se mantiene el trabajo en `feature/orvyn-staroptimizer-2`, sin modificar main.

La prerelease pública `v2.0.0-beta.1` existe y solo incluye código fuente, sin assets EXE. Este arreglo posterior en la rama de desarrollo no modifica ni sustituye el tag publicado. El [informe anterior](VALIDATION_2026_10_16.md) permanece como registro histórico; los resultados siguientes actualizan los bloqueos de esa primera sesión.

## Dependencias y pruebas reales

Electron y Playwright ya están instalados. `npm.cmd ls --depth=0` confirma Electron 44.2.0, electron-builder 26.15.3 y @playwright/test 1.63.0, sin dependencias directas faltantes. Node 24.20.0 y npm 11.19.0. No se ha repetido una instalación destructiva de node_modules mientras la red de la sesión sigue bloqueada; una instalación limpia reproducible con npm ci aún es un control pendiente.

`npm.cmd test`: **52 aprobadas, 0 fallos, 0 omitidas**. Incluye cuatro casos nuevos de inventario de discos: CIM válido, acceso denegado con lectura alternativa, datos inválidos y consulta vacía. Las mutaciones siguen verificándose con adaptadores aislados; no se han modificado ajustes Windows durante esta revisión.

## Escáner corregido sin elevar permisos

CIM continúa denegando el acceso al inventario de discos. Se comprobó directamente que `[System.IO.DriveInfo]::GetDrives()` sí proporciona el volumen fijo C:, su tamaño y su espacio disponible. El escáner ahora usa esa API de solo lectura si CIM falla o devuelve filas inválidas. No cambia permisos, políticas, seguridad ni configuración.

Se valida cada fila antes de usarla y se registra la procedencia en `sources.disks`. En la alternativa, `FreeSpace` procede de `AvailableFreeSpace`, es decir, el espacio disponible para el usuario, que puede diferir del total libre si hay cuotas. Los datos ausentes o incoherentes no se convierten en cero ni en un diagnóstico.

`npm.cmd run test:windows:smoke` termina con **código 0**, después de reforzar el control para exigir al menos un volumen fijo real. Resultado observado: un disco, fuente `windows-drive-info`, 30 grupos de procesos y un plan de energía. Duración de esa ejecución: 13 089 ms. No es un benchmark comparable ni demuestra una mejora de velocidad.

El resultado global permanece **PARTIAL**: inicio y GPU devuelven `0X80041003`; el estado físico de discos también sigue denegado en la consulta directa y su comando termina con código 1. No se declara salud de esos componentes ni compatibilidad exhaustiva por superar este smoke test.

## Electron: fallo real de arranque, no prueba aprobada

Se intentaron de nuevo los seis scripts de integración con las dependencias presentes:

| Script | Resultado observado |
| --- | --- |
| test:ui | Código 1, Assertion error interno de Playwright |
| test:workflow | Código 1, Assertion error |
| test:scan | Código 1, acceso denegado durante el arranque |
| test:live | Código 1, acceso denegado durante el arranque |
| test:nova | Código 1, acceso denegado durante el arranque |
| test:measure | Código 1, Assertion error |

La ejecución con DEBUG=pw:browser se guardó localmente en `artifacts/ui-launch-diagnostic.log` —no forma parte del repositorio publicado—. Electron llega a abrir el depurador, pero su proceso GPU termina con `-1073741515` (`0xC0000135`) antes de completar el inicio del test. También hay errores de cifrado del perfil y un intento de limpieza de Playwright denegado. No se ha identificado la dependencia concreta ni se ha demostrado un fallo funcional del renderizador de la aplicación.

Un sondeo con GPU desactivada tampoco resolvió el arranque. No se han parcheado Playwright, desactivado el sandbox, eliminado aserciones ni convertido estos fallos en skips. La instalación de Chromium disponible tampoco pudo completar un sondeo de automatización con sandbox en este entorno. Sin una ejecución real de interfaz no se certifican navegación, revisión/aplicación, rollback UI, Nova, capturas ni DPI.

## Pendientes antes de una versión final

1. Resolver el arranque de Electron y repetir los seis tests en un escritorio Windows utilizable, con perfiles de prueba aislados.
2. Reproducir npm ci con acceso de red, revisar dependencias y completar las lecturas/limitaciones del escáner en la matriz de máquinas.
3. Obtener la anotación exacta de GitHub Actions: el último run examinado tras la subida anterior volvió a tener runner_id=0 y cero pasos. No atribuir ese rechazo a una prueba de aplicación.
4. Verificar restauraciones nativas con respaldo y consentimiento específico, batería/corriente, Windows 10/11 y Modern Standby. No están cubiertas por una petición genérica de publicar un binario.
5. Medir recursos en reposo, visible/oculto y escaneo; revisar foco, accesibilidad, temas y DPI. Después preparar un portable, abrirlo y revisar integridad/firma antes de publicar.

## Nivo

A petición del usuario se ha iniciado Nivo de forma independiente en `C:\Users\angel\Documents\Codex\Nivo`, rama local `feature/nivo-mvp`. El usuario confirmó Tauri 2 + Rust. Hay vista web y esqueleto nativo, con cinco pruebas Node aprobadas. Rust/Cargo no están instalados; el componente de herramientas C++ está detectado. No es un binario nativo validado, no se ha publicado y no comparte runtime con StarOptimizer. La música, notificaciones y exclusión de pantalla completa son próximos hitos, no funciones simuladas.
