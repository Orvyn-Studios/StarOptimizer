# StarOptimizer: justification for `unvirtualizedResources`

Product ID 9NN60H8MJMT5 · Publisher Snow099 · This answers each item in the certification report of 24 Nov 2026, point by point. Everything below can be checked in the public source code: https://github.com/Orvyn-Studios/StarOptimizer/tree/feature/orvyn-staroptimizer-2 (file references are given in each section).

## Why the capability is needed

StarOptimizer changes a fixed set of the current user's Windows preferences and deletes a fixed set of the current user's cache and temporary files, always after the user confirms. With write virtualization enabled, those writes and deletions would go to a private package copy. Windows and the other apps would never see them, and the app would wrongly report success. The capability is used only so that these enumerated operations reach the real current-user locations. It is not used for anything else.

## 1. Complete manifest section (`build/appxmanifest.xml`)

```xml
<Package ... xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
             xmlns:desktop6="http://schemas.microsoft.com/appx/manifest/desktop/windows10/6"
             IgnorableNamespaces="desktop6 rescap">
  <Properties>
    ...
    <desktop6:RegistryWriteVirtualization>disabled</desktop6:RegistryWriteVirtualization>
    <desktop6:FileSystemWriteVirtualization>disabled</desktop6:FileSystemWriteVirtualization>
  </Properties>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
    <rescap:Capability Name="unvirtualizedResources" />
  </Capabilities>
```

These are the only `desktop6:` declarations. There are no `virtualization:` declarations, and no other virtualization, extension or capability entries.

## 2. Every HKCU registry path and value it may create, update or delete

Nothing is ever deleted from the registry. A value is only written after the user confirms it in a preview that shows the current and new value. A key is created only if it does not exist (`New-Item` without `-Force`, so existing keys are never recreated). Source: `src/tools.cjs` (`TOGGLES`, `setToggle`, `setStartup`) and `src/system.cjs` (`setVisual`).

| Key (all under HKCU) | Value | Type | Written values |
|---|---|---|---|
| `Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` | `EnableTransparency` | REG_DWORD | 0 / 1 |
| `Software\Microsoft\GameBar` | `AutoGameModeEnabled` | REG_DWORD | 0 / 1 |
| `Software\Microsoft\Windows\CurrentVersion\GameDVR` | `AppCaptureEnabled` | REG_DWORD | 0 / 1 |
| `Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager` | `SubscribedContent-338389Enabled` | REG_DWORD | 0 / 1 |
| `Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications` | `GlobalUserDisabled` | REG_DWORD | 0 / 1 |
| `Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run` | name of an **existing** value under `HKCU\...\CurrentVersion\Run` | REG_BINARY (12 bytes) | `02 00…` (enabled) or `03 00 00 00` + FILETIME (disabled), the format Task Manager uses |

Indirect writes made by Windows itself: the three animation settings are changed through the documented `SystemParametersInfoW` API (`SPI_SETCLIENTAREAANIMATION` 0x1043, `SPI_SETMENUANIMATION` 0x1003, `SPI_SETCOMBOBOXANIMATION` 0x1005, flags `SPIF_UPDATEINIFILE | SPIF_SENDCHANGE`). Windows saves them under `HKCU\Control Panel\Desktop`. The app never writes that key directly.

The app never writes `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. It reads it to list startup apps, and only toggles their approval flag above.

## 3. Every filesystem directory and file category it may clean

Source: `src/tools.cjs` (`cleanupTargets`, `walk`, `createCleanup`). The user selects categories after a preview with sizes. Then only regular files are deleted, with `unlink`, and emptied subfolders are removed with a non-recursive `rmdir`.

| Category | Location | Rule |
|---|---|---|
| Temporary files | `%TEMP%` (the current user's temp folder) | files older than 24 h; locked/in-use files are skipped |
| Crash dumps | `%LOCALAPPDATA%\CrashDumps` | all files |
| Chrome cache | `%LOCALAPPDATA%\Google\Chrome\User Data\<Default\|Profile N\|Guest Profile>\{Cache\Cache_Data, Code Cache, GPUCache}` | only while `chrome` is not running |
| Edge cache | `%LOCALAPPDATA%\Microsoft\Edge\User Data\<profile>\{same three folders}` | only while `msedge` is not running |
| Brave cache | `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\<profile>\{same three folders}` | only while `brave` is not running |
| Discord cache | `%APPDATA%\discord\{Cache\Cache_Data, Code Cache, GPUCache}` | only while `discord` is not running |
| Explorer thumbnails | `%LOCALAPPDATA%\Microsoft\Windows\Explorer\thumbcache_*.db` | top level only, files matching the pattern |
| Recycle Bin | current user's Recycle Bin | emptied with `Clear-RecycleBin` (Shell API), only if selected |

Safety rules in the file walker: it never follows symbolic links or junctions, and only enters folders whose resolved real path stays inside the resolved root. It stops after 300,000 entries and never deletes a folder that still has files in it.

## 4. Fixed catalogue or dynamic targets

Fixed. Every registry key and value, SPI action, cleanup root and process name above is a constant compiled into the app. Nothing is downloaded, and the app makes no network requests. Neither the user nor the UI can supply a path, key or value. The UI talks to the main process through IPC. The IPC accepts only identifiers that are looked up in these constant tables (`src/optimizer.cjs` `valid`, `src/tools.cjs` `TOGGLES` / `cleanupTargets`). The two parameters that come from the system are re-validated against the live system before use:

- the power plan GUID must match a plan returned by `powercfg /list`;
- the startup entry name must match an existing value under `HKCU\...\CurrentVersion\Run`. It is passed to PowerShell base64-encoded, never interpolated as code.

## 5. Scope of the capability

Confirmed: `unvirtualizedResources` is used only for the registry writes in section 2, the deletions in section 3, and the app's own data folder (section 9). The app writes nowhere else.

## 6. Confirmations

- **HKLM writes:** none. The app never opens HKLM for writing.
- **Windows, Program Files, ProgramData or other system directories:** never modified.
- **Services, scheduled tasks, DNS/network settings, firewall rules, Defender/security settings, certificates:** never read for change, never modified.
- **Startup entries:** only the per-user enable/disable flag in `StartupApproved\Run` (section 2), the same action as Task Manager's Enable/Disable. Entries are never created, edited or removed.
- **Power plans:** the app only selects which **existing** plan is active, with the inbox tool `powercfg.exe /setactive <GUID>`. This goes through the Windows power service, which needs no elevation and is not affected by package virtualization. Plans are never created, duplicated, edited or deleted.
- **Unrelated third-party application data:** none, except the disposable cache folders of Chrome, Edge, Brave and Discord listed in section 3. They are deleted only when the user selects that category and while that app is closed. Profiles, cookies, history, passwords, bookmarks and messages are never touched.

## 7. Packaged process vs. elevated helper

There is **no elevated helper**. The package declares no elevation and the app never requests it: no `runas`, no `requireAdministrator`, no service, no COM elevation. Everything runs as the current user at medium integrity, inside the package.

Process model:

- The **main process** (`src/main.cjs`) does all the work. The **renderer** is sandboxed (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`) and can only call named IPC handlers. Each handler checks that the sender is the app's own main frame and page URL, and validates every argument.
- For reads and the writes above, the main process starts short-lived inbox child processes with fixed arguments: `powershell.exe -NoProfile -NonInteractive -EncodedCommand <script built from the constant tables>` and `powercfg.exe` (`/list`, `/setactive <validated GUID>`, `/batteryreport /xml /output <temp file>`, which the app deletes right after reading). Each one has a 30-second timeout and exits when done.
- **Lifetime:** nothing stays running after the window closes, and there is no persistent component. No service, scheduled task, startup entry, tray icon or background process is ever installed.

## 8. Reversible vs. permanent

- **Reversible:** every setting in section 2 and the power plan. Before each write, the app saves a journal entry with the original value. After writing, it reads the value back and checks it. If any step fails, the changes already made are rolled back automatically. The user can restore the original values at any time from History. A restore only writes if the current value still equals the value StarOptimizer set (or the original). If another program changed it, the app refuses to overwrite it and tells the user. Startup-app toggles are reversed from the same screen or Task Manager.
- **Permanent:** every file deletion in section 3, including emptying the Recycle Bin. Files are not moved to the Recycle Bin. The UI states before deletion that they cannot be recovered.

## 9. Backup/history locations, formats, retention, tamper protection

- **Location:** the package's own data folder, `%LOCALAPPDATA%\Packages\Snow099.StarOptimizer_nfewzxn8tes42\LocalState` (set in `src/main.cjs`). It is per user, and Windows removes it on uninstall.
- **Files and formats (UTF-8 JSON):**
  - `optimization-journal.json`: per operation, id, timestamp, status, and per setting key, before value, after value and state;
  - `cleanup-log.json`: date, bytes freed, file counts and categories;
  - `measurements.json`: CPU/memory samples the user chose to record;
  - Electron `Local Storage`: theme, mode and device-type preferences.
- **Retention:** journal: every entry that can still be restored, plus the latest 100 finished entries. Cleanup log: latest 100. Measurements: latest 50.
- **Integrity:** writes are atomic (write to `.tmp`, flush, rename). On every read the journal is schema-validated: GUIDs, ISO dates, known statuses, only known setting keys, and values of the right type (boolean or power-plan GUID). If the file is corrupt or has been edited into anything invalid, the app makes **no** further changes and tells the user. Because only catalogue keys and typed values are accepted, an edited journal cannot make the app write any other key, path or value. Restores also check the live value first (section 8).

## 10. Crashes, interrupted changes, update, uninstall

- **Crash or interruption:** the journal entry is saved as `pending` **before** Windows is touched, and each setting's state (`writing` / `applied`) is saved as it goes. On the next launch, History shows the entry as "Operación interrumpida" (interrupted) and offers recovery. Until it is resolved, no new changes are allowed. A failed automatic rollback is shown as "Requiere recuperación" (needs recovery) with a retry button.
- **App update:** the LocalState data folder is kept across updates, so History and restore keep working.
- **Uninstall:** Windows removes the package and its LocalState folder. Nothing else is left behind: no service, task, startup entry or file of the app. The user's Windows settings stay as the user last chose, since they are ordinary per-user preferences. The documentation tells users to restore them from History before uninstalling if they want to. All of them can also be changed in Windows Settings.

## 11. User-facing documentation

Persistence, restoration and complete removal are documented for users (Spanish and English) at:
https://github.com/Orvyn-Studios/StarOptimizer/blob/feature/orvyn-staroptimizer-2/docs/CHANGES_AND_REMOVAL.md

The same information is summarised in the app's privacy policy and in the Store description.
