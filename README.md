# StarOptimizer 2.0 (beta de desarrollo)

> **Rama Orvyn 2.0:** No es una versión estable ni certificada en Windows. No distribuir ni fusionar hasta superar los controles en [docs/ORVYN_2_0.md](docs/ORVYN_2_0.md). La descarga de `releases/latest` sigue apuntando a la versión estable anterior.


Aplicación de escritorio para Windows 10/11 x64. Versión 2.0.0-beta.1 (en pruebas): recomendaciones con actualización periódica y revisión conjunta de ajustes automáticos compatibles. Conserva diagnóstico local, perfiles, mediciones antes/después, búsquedas, exportación y ajustes reversibles. Beta sin firma digital. Consulta `GUIA-PUESTA-A-PUNTO.md` para utilizarla en otro equipo.

## Ejecutar

**[Versiones anteriores para Windows](https://github.com/SnoW-099/StarOptimizer/releases/latest)**. Ese enlace corresponde a la versión publicada anterior, no a esta beta 2.0. El repositorio es público; esta rama está en desarrollo y no acredita un ejecutable 2.0 validado. La descarga del código fuente no incluye un programa compilado.

La compilación portable de esta rama solo debe prepararse después de superar las pruebas. Windows puede mostrar una advertencia de editor desconocido si el binario no está firmado. Algunas políticas de empresa o del entorno de ejecución pueden impedir leer o modificar ajustes; la app informa del error.

Para desarrollo, con Node.js **22.12.0 o posterior** y npm instalados:

```sh
npm ci
npm start
```

En Windows PowerShell puedes usar `npm.cmd ci` y `npm.cmd start` si la política de scripts bloquea `npm.ps1`; no es necesario cambiar esa política. Los resultados reales y los bloqueos actuales están en [el informe de aceptación actualizado](docs/ACCEPTANCE_2026_10_16.md).

## Qué hace

- Recomendados distingue tres objetivos: **Inteligente** muestra problemas respaldados por lecturas y datos no disponibles; **Gaming** añade la opción de Alto rendimiento si existe, el plan original sigue disponible y consta conexión a corriente; **Extremo** añade reducciones visuales opcionales y reversibles. Los ajustes opcionales se revisan antes de confirmar. No crea planes ni modifica sus valores internos. Identificadores de referencia: [Microsoft Power Policy Settings](https://learn.microsoft.com/en-us/windows/win32/power/power-policy-settings).

- El análisis completo toma ocho muestras de CPU y comunica su media. En Recomendados, CPU/RAM se consultan cada cinco segundos mientras la sección está visible, con una media móvil de tres a seis muestras para CPU; el inventario completo se renueva cada minuto. Las recomendaciones se recalculan. Puedes pausar el directo; también se pausa durante mediciones, operaciones y revisión de cambios. Cada dato conserva su fecha si una actualización falla.
- Las animaciones activadas no son un fallo. Su reducción opcional aparece en Extremo; los ajustes manuales también permanecen en Optimizar. Cada cambio usa revisión, confirmación, verificación e historial de restauración: no ejecuta texto arbitrario en CMD, no cierra aplicaciones y no borra archivos. Los avisos de memoria, almacenamiento y hardware requieren una decisión manual; no se presentan como reparaciones automáticas.

- Puesta a punto guía análisis, medición inicial, inicio, perfiles, controles de Windows y comparación final. Las mediciones toman doce muestras y guardan media/pico de CPU y RAM media en `%APPDATA%/StarOptimizer/measurements.json`, conservando las lecturas anteriores. No mide FPS ni declara ganancias de velocidad. El backend impide aplicar cambios durante la medición.
- Consulta `Get-PhysicalDisk` para mostrar nombre, tipo y estados de salud/operativo, sin números de serie. Si falla o no hay datos, indica no disponible. Un aviso reportado se prioriza antes de ajustes de rendimiento. Esto no sustituye pruebas de salud ni sensores de temperatura.

Referencia técnica: [Get-PhysicalDisk, Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/storage/get-physicaldisk). El estado procede del proveedor de almacenamiento de Windows y no equivale a una prueba exhaustiva del dispositivo.

- Al pulsar Analizar, Nova piensa y lee mientras Windows reúne datos. La bombilla aparece tras recibir los resultados; el resumen distingue análisis completo, parcial y fallo. No se simula un porcentaje de avance. Puedes continuar en segundo plano.
- Recomendados permanece bloqueado hasta recibir un análisis. Ordena avisos físicos de discos, lecturas pendientes, presión de almacenamiento/memoria, CPU y opciones del modo elegido. Cada punto muestra evidencia y una acción. El inventario de inicio no se considera por sí solo un problema. Los datos ausentes no se convierten en diagnósticos. La sección se desbloquea de nuevo tras analizar en cada sesión.

- Consulta CPU, RAM, discos locales, GPU/controlador, hasta 30 grupos de procesos por consumo de memoria y entradas de inicio, con búsquedas.
- Ofrece un monitor opcional de CPU/RAM cada cinco segundos. Se pausa fuera de Inicio, al ocultar la app y durante operaciones. El resto de los datos conserva la fecha del análisis completo.
- Señala CPU por encima del 80 %, RAM por encima del 85 % y unidades con menos del 15 % **y** menos de 32 GiB libres como señales para revisar, sin confundirlas con fallos de hardware.
- Prepara perfiles Equilibrado, Más directo y Rendimiento. Los perfiles solo seleccionan opciones: nunca se aplican automáticamente.
- Cambia a un plan de energía existente y/o reduce animaciones de interfaz, menús y listas mediante la API documentada `SystemParametersInfoW`. Sus efectos dependen de que cada aplicación respete esos ajustes.
- Muestra una revisión exacta de valores actuales y nuevos. La revisión caduca a los cinco minutos y se invalida si Windows cambia entre medias.
- Guarda los valores originales antes de escribir, verifica cada paso e intenta recuperar los pasos iniciados si falla el lote. Los fallos de recuperación siguen visibles en Historial.
- Restaura operaciones desde Historial, también tras reiniciar la aplicación.
- Abre controles oficiales para gestionar inicio, Modo Juego, preferencias gráficas, actualizaciones y energía.
- Exporta un diagnóstico JSON solo a petición del usuario. Incluye nombres de procesos, entradas de inicio e historial: revisarlo antes de compartirlo.

No borra archivos, limpia cachés, mata procesos, desactiva servicios/antivirus, instala drivers ni altera red o BIOS. No escribe valores de registro directamente: Windows persiste los ajustes visuales a través de su API. No envía telemetría ni necesita conexión para funcionar. Las mejoras dependen del problema real; cambiar la energía o reducir animaciones no garantiza más FPS. El inventario de inicio no indica con certeza si cada entrada está activada y no incluye todos los mecanismos de arranque.

## Recuperación

El historial está en `%APPDATA%/StarOptimizer/optimization-journal.json`. Se escribe con vaciado a disco del archivo temporal y reemplazo atómico. La versión 0.2 conserva la recuperación del antiguo `energy-journal.json`, sin borrarlo. Una vez escrito el nuevo historial, este es la fuente de verdad: evita usar la versión 0.1 para aplicar o restaurar nuevos cambios.

Se permiten operaciones independientes pendientes de restaurar, pero un mismo ajuste no puede sobrescribirse hasta recuperar su valor original. Una operación interrumpida bloquea nuevas optimizaciones hasta resolver la recuperación. Si otro programa cambió la energía a un tercer plan, la app evita sobrescribirlo. Si desaparece el plan original o Windows deniega permisos, la recuperación puede requerir intervención manual; no se presenta como completada. No borres los historiales si quieres conservar la recuperación. Los cambios hechos directamente en Ajustes de Windows no forman parte del historial. El cierre normal de la ventana se bloquea durante una escritura/verificación; un cierre forzado conserva los datos de recuperación ya registrados.

## Pruebas y compilación

```sh
npm test
npm run test:ui
npm run test:workflow
npm run test:nova
npm run test:scan
npm run test:measure
npm run test:live
npm run dist
```

Las pruebas unitarias cubren optimización, prioridades, persistencia de mediciones, ejecución de comandos y el controlador de Nova, incluidos datos ausentes, muestreo fallido e historial corrupto. Las mutaciones usan adaptadores aislados y directorios temporales. Las pruebas instrumentadas del controlador no acreditan renderizado real ni compatibilidad de Windows. `test:scan` verifica bloqueo inicial, error, fases visuales y resumen parcial; `test:measure` comprueba mediciones reales, exclusión de operaciones y recuperación de la lectura inicial tras reiniciar con un perfil de datos aislado. Consulta el informe de validación para distinguir pruebas aprobadas de pruebas bloqueadas.

`test:ui` ejecuta un diagnóstico real y lee las opciones nativas, prueba navegación, revisión/cancelación, búsqueda, apariencia, movimiento reducido y una ventana compacta. No aplica ajustes al anfitrión. `test:workflow` prueba desde los botones el ciclo revisión → aplicación → restauración y la recuperación automática de un lote fallido, con el motor real y un adaptador simulado dentro del proceso de prueba. La app distribuida no expone un modo de prueba. Ambas pruebas admiten un ejecutable empaquetado: `node test/ui.cjs dist/win-unpacked/StarOptimizer.exe` y `node test/workflow.cjs dist/win-unpacked/StarOptimizer.exe`.

## Diseño y referencia

Nova está dibujada con CSS propio siguiendo las referencias aportadas: círculo negro, ojos azules ovalados y pequeñas pupilas blancas. El cuerpo flota 16 px en un ciclo de 7 segundos. Las miradas amplias desplazan e inclinan el conjunto de ojos y cambian ligeramente su perspectiva; las pupilas acompañan con menos de 5 px de recorrido. El parpadeo alterna un cierre rápido de 360 ms y otro pausado de 720 ms, con párpados negros que dejan curvas azules al cerrar. Hacer clic centra la mirada sin mensajes. Al cambiar de sección, Nova viaja durante 1,05 segundos hacia su esquina o de vuelta al inicio usando sus coordenadas reales; un cambio de sección durante el viaje continúa desde la posición actual.

El parpadeo mantiene una cadencia de 10 segundos incluso en las pestañas secundarias. La mirada actualiza como máximo una vez por fotograma cuando llega movimiento de puntero; no hay un bucle JavaScript continuo. Ocultar la app, activar movimiento reducido o elegir Sencilla suspende los gestos. `test:nova` verifica cadencia, ambas duraciones, clics silenciosos y suspensión; `node test/nova-visual.cjs` comprueba las coordenadas de salida, los viajes interrumpidos y genera capturas visuales.

La interfaz utiliza tarjetas agrupadas, navegación lateral con etiquetas, tipografía del sistema y controles azules. El botón de tema en la barra superior alterna claro/oscuro y conserva la preferencia localmente. Cristal/Sencilla sigue controlando los efectos visuales de la app. No se han retirado las herramientas de optimización ni el historial.

Referencia visual aportada por el usuario: [Creature Company / LILGUY EYES](https://creature.company/eyes?swatch=circle-stoplight). No se distribuye código, imágenes ni animaciones descargadas de Creature Company. No se ha verificado una licencia que permita redistribuir sus assets.

## Arquitectura y límites

Electron con sandbox, aislamiento de contexto, sin Node en el renderizador, CSP local, comprobación de emisor IPC y lista cerrada de acciones. PowerShell usa comandos fijos codificados y `powercfg` recibe argumentos separados y GUIDs validados. El historial se escribe antes de cada mutación con reemplazo de archivo. Los permisos, las políticas de empresa o proveedores WMI pueden impedir lecturas o cambios; se presentan como datos no disponibles o errores recuperables.

Referencias: [seguridad de Electron](https://www.electronjs.org/docs/latest/tutorial/security), [powercfg de Microsoft](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/powercfg-command-line-options) y [SystemParametersInfoW](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-systemparametersinfow).

Antes de distribuir ampliamente: firmar el ejecutable y probar restauraciones reales en máquinas virtuales Windows 10/11, portátiles y equipos con Modern Standby. Las pruebas con adaptadores y el diagnóstico local no sustituyen esa matriz de hardware.
