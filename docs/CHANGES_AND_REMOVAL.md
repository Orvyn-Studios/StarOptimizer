# Qué cambia StarOptimizer y cómo deshacerlo · What StarOptimizer changes and how to undo it

[Español](#español) · [English](#english)

## Español

StarOptimizer solo cambia algo cuando tú lo confirmas, después de ver el valor actual y el nuevo. No necesita permisos de administrador, no instala servicios ni tareas programadas y no se queda en segundo plano al cerrarla.

### Ajustes de Windows (reversibles)

| Ajuste | Dónde lo guarda Windows |
|---|---|
| Plan de energía activo | Se elige entre los planes que ya existen en tu equipo (`powercfg /setactive`). No crea, edita ni borra planes. |
| Animaciones de interfaz, menús y listas | `HKCU\Control Panel\Desktop` (a través de la API `SystemParametersInfo` de Windows) |
| Efectos de transparencia | `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` · `EnableTransparency` |
| Modo Juego | `HKCU\Software\Microsoft\GameBar` · `AutoGameModeEnabled` |
| Grabación en segundo plano (Game Bar) | `HKCU\Software\Microsoft\Windows\CurrentVersion\GameDVR` · `AppCaptureEnabled` |
| Consejos y sugerencias de Windows | `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` · `SubscribedContent-338389Enabled` |
| Apps en segundo plano | `HKCU\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications` · `GlobalUserDisabled` |
| Activar o desactivar una app de inicio | `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run`: el mismo indicador que usa el Administrador de tareas. Nunca añade ni borra apps de inicio. |

**Cómo deshacerlo:** abre **Historial** y pulsa **Restaurar valores originales**. StarOptimizer solo restaura si el ajuste sigue como lo dejó. Si otro programa lo cambió después, no lo sobrescribe y te avisa. Las apps de inicio se vuelven a activar desde la misma pantalla o desde el Administrador de tareas. Todos estos ajustes también se pueden cambiar a mano en Configuración de Windows.

### Limpieza (permanente)

Los archivos que eliges borrar en **Limpieza** se eliminan definitivamente: no pasan por la papelera y no se pueden recuperar. Antes de borrar, la aplicación te muestra cuánto ocupa cada categoría.

- Archivos temporales de tu usuario (`%TEMP%`) con más de 24 horas. Se omiten los que estén en uso.
- Informes de errores (`%LOCALAPPDATA%\CrashDumps`).
- Caché de Chrome, Edge, Brave y Discord: solo las carpetas `Cache`, `Code Cache` y `GPUCache`, y solo si la aplicación está cerrada. No borra contraseñas, historial, cookies ni marcadores.
- Miniaturas del Explorador (`thumbcache_*.db`).
- Papelera de reciclaje (si la eliges).

### Datos de la aplicación

El historial de ajustes, el registro de limpiezas, las mediciones y tus preferencias se guardan en la carpeta privada de la aplicación (`%LOCALAPPDATA%\Packages\Snow099.StarOptimizer_…\LocalState`). Se conservan al actualizar la aplicación.

- Historial de ajustes: todo lo que aún se puede restaurar, más los 100 últimos cambios terminados.
- Registro de limpiezas: las 100 últimas.
- Mediciones: las 50 últimas.

Si la aplicación se cierra a mitad de un cambio (por ejemplo, por un corte de luz), el historial lo marca como **Operación interrumpida**. StarOptimizer no permite hacer más cambios hasta que lo recuperes desde Historial.

### Desinstalar por completo

1. Si quieres volver a como estaba tu equipo, abre **Historial** y restaura los cambios **antes** de desinstalar. Al desinstalar se borra el historial y ya no se podrán restaurar desde la aplicación, aunque sí desde Configuración de Windows.
2. Desinstala StarOptimizer desde **Configuración › Aplicaciones**. Windows borra la aplicación y toda su carpeta de datos. No queda ningún servicio, tarea programada, entrada de inicio ni proceso en segundo plano.

---

## English

StarOptimizer only changes something after you confirm it, having seen the current and the new value. It does not need administrator rights, installs no services or scheduled tasks, and does not keep running after you close it.

### Windows settings (reversible)

| Setting | Where Windows stores it |
|---|---|
| Active power plan | Chosen from the plans that already exist on your PC (`powercfg /setactive`). Plans are never created, edited or deleted. |
| Interface, menu and list animations | `HKCU\Control Panel\Desktop` (through the Windows `SystemParametersInfo` API) |
| Transparency effects | `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` · `EnableTransparency` |
| Game Mode | `HKCU\Software\Microsoft\GameBar` · `AutoGameModeEnabled` |
| Game Bar background recording | `HKCU\Software\Microsoft\Windows\CurrentVersion\GameDVR` · `AppCaptureEnabled` |
| Windows tips and suggestions | `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` · `SubscribedContent-338389Enabled` |
| Background apps | `HKCU\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications` · `GlobalUserDisabled` |
| Enable or disable a startup app | `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run`: the same flag Task Manager uses. Startup apps are never added or removed. |

**How to undo:** open **Historial** (History) and choose **Restaurar valores originales** (Restore original values). StarOptimizer only restores a setting that is still as it left it. If another program changed it since, it is not overwritten and you are told. Startup apps can be re-enabled from the same screen or from Task Manager. Every one of these settings can also be changed by hand in Windows Settings.

### Cleanup (permanent)

Files you choose to delete in **Limpieza** (Cleanup) are deleted permanently: they do not go to the Recycle Bin and cannot be recovered. The app shows the size of each category before anything is deleted.

- Your user's temporary files (`%TEMP%`) older than 24 hours. Files in use are skipped.
- Crash dumps (`%LOCALAPPDATA%\CrashDumps`).
- Chrome, Edge, Brave and Discord cache: only the `Cache`, `Code Cache` and `GPUCache` folders, and only while that app is closed. Passwords, history, cookies and bookmarks are never deleted.
- Explorer thumbnails (`thumbcache_*.db`).
- Recycle Bin (if you select it).

### App data

The settings history, cleanup log, measurements and your preferences are kept in the app's private folder (`%LOCALAPPDATA%\Packages\Snow099.StarOptimizer_…\LocalState`) and are kept when the app updates.

- Settings history: everything that can still be restored, plus the 100 most recent finished changes.
- Cleanup log: the latest 100.
- Measurements: the latest 50.

If the app closes in the middle of a change (for example, a power cut), the history marks it as **Operación interrumpida** (Interrupted operation) and StarOptimizer allows no further changes until you recover it from History.

### Complete removal

1. To return your PC to how it was, open **History** and restore your changes **before** uninstalling. Uninstalling deletes the history, so the app can no longer restore them, but you can still change them in Windows Settings.
2. Uninstall StarOptimizer from **Settings › Apps**. Windows removes the app and its whole data folder. No service, scheduled task, startup entry or background process is left behind.
