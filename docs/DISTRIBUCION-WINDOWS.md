# Distribución y bloqueos de Windows

La revisión 0.6.2 reemplaza las llamadas a PowerShell (`-EncodedCommand`) y `Add-Type` por `StarOptimizer.System.exe`. Su código está en `native/SystemProbe.cs`: consulta WMI y procesos, lee las opciones visuales y permite modificar únicamente tres ajustes conocidos mediante `SystemParametersInfoW`. El historial, la revisión previa, la verificación y la restauración siguen en el motor existente.

El componente se compila en el equipo de desarrollo con el compilador de .NET Framework 4.x incluido en Windows 10/11. El PC que recibe la app no compila código ni ejecuta scripts. El programa usa el .NET Framework 4.x de Windows. No hay descarga de componentes al arrancar.

Esto elimina esos patrones del funcionamiento de la app, pero no demuestra que fueran la causa de una detección. Tampoco garantiza la aceptación del nuevo ejecutable.

## Preparar una compilación de prueba

En Windows 10/11 x64:

```sh
npm ci
npm run build:native
npm test
npm run dist
node test/native-helper.test.cjs
node test/ui.cjs dist/win-unpacked/StarOptimizer.exe
node test/workflow.cjs dist/win-unpacked/StarOptimizer.exe
```

El hook `beforePack` recompila el componente antes de empaquetar. Si la compilación falla, el paquete no se genera. El ejecutable queda en `dist/StarOptimizer-0.6.2-portable.exe`. La carpeta `resources/app.asar.unpacked` debe acompañar a una ejecución desde `win-unpacked`; el portable ya la incluye.

Las pruebas del componente son de lectura y de rechazo de argumentos inválidos; no modifican ajustes reales. Las pruebas de restauración usan un adaptador simulado. El flujo de GitHub Actions ejecuta estas comprobaciones en Windows y guarda un artefacto de prueba sin firma. Al recibir un tag `v` o una rama `release/v` cuya versión coincida con `package.json`, publica una beta con EXE, ZIP y hashes SHA-256 solo después de pasar las pruebas. Las ejecuciones para pull requests no publican releases.

## Firmar cuando se disponga de certificado

La firma ya no está deshabilitada. electron-builder 26 acepta credenciales `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` (o `CSC_LINK` / `CSC_KEY_PASSWORD`) para certificados compatibles; un certificado protegido por token o un servicio de firma requiere la configuración indicada por su proveedor en `win.signtoolOptions` o `win.azureSignOptions`. No guardes certificados ni contraseñas en Git.

```sh
npm run dist:signed
```

Este comando falla si electron-builder no firma y verifica después con `Get-AuthenticodeSignature` que el ejecutable principal, el componente incluido y el portable tienen firma válida y sello de tiempo. También se solicita firmar las DLL mediante `win.signExts`. Para Smart App Control debe usarse un certificado de un proveedor de confianza; uno autofirmado no proporciona confianza para distribución pública.

## Distinguir el bloqueo

- **Smart App Control / Control inteligente:** puede permitir una app sin firma si su servicio la reconoce como fiable. Si no puede decidir y no hay una firma válida, puede bloquearla. Ser una app de código abierto o alojada en GitHub no concede confianza automáticamente.
- **SmartScreen:** evalúa la reputación de las descargas. Una firma nueva tampoco garantiza que desaparezca inmediatamente el aviso de reputación.
- **Antivirus:** hay que conservar el fabricante, el nombre exacto de detección y el archivo afectado. Revisar el binario concreto y, si corresponde, enviarlo a su fabricante como posible falso positivo. La firma no elimina automáticamente las detecciones de malware.

No se ha analizado el nuevo binario con el antivirus del equipo afectado ni se ha validado en un equipo con Control inteligente activo. Antes de afirmar que se ha solucionado el aviso, hay que probar el paquete concreto allí.

Referencias oficiales: [Smart App Control](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions), [firma para Smart App Control](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control), [reputación de SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [envío a Microsoft para análisis](https://www.microsoft.com/en-us/wdsi/filesubmission) y [opciones Windows de electron-builder 26](https://www.electron.build/v26/docs/win/).
