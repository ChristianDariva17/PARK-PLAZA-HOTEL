# Bridge local ZKTeco ZK9500

Servicio Windows x86 para ZKFinger Standard SDK 5.3.0.33. Expone una API HTTP versionada sólo en `127.0.0.1`, exige un token local y nunca devuelve imágenes ni templates biométricos.

## Arquitectura

- `.NET Framework 4.0` Console x86 y `HttpListener`, compatibles con el toolchain y wrapper instalados.
- `ZkFingerprintDevice` encapsula `zkfp2`: inicialización, apertura, tres capturas, `DBMerge`, `DBMatch` y cierre.
- `FileTemplateStore` cifra cada template con Windows DPAPI y restringe la ACL del directorio al usuario actual, `SYSTEM` y Administradores. El bridge falla al iniciar si no puede asegurarla.
- `OperationManager` serializa el lector, informa progreso y permite cancelar. `FileAuditLog` registra intentos en JSON Lines sin biometría.
- `HttpBridgeServer` limita bind, CORS, token, validación y errores del contrato.

## Preparación

Desde PowerShell de 32 o 64 bits:

```powershell
cd "C:\Users\crist\Downloads\prototipo park plaza\bridge"
.\setup.ps1
```

El script copia únicamente el wrapper administrado x86 a `bridge\vendor` ignorado, genera `bridge.config.json`, crea `.env.local` para Vite con el mismo token y reserva `http://127.0.0.1:17345/` para el usuario actual. La reserva puede exigir ejecutar `setup.ps1` una vez como administrador. No incorpora binarios vendor al proyecto. Si Vite usa otro puerto, agregá su origen exacto a `AllowedOrigins`.

## Ejecución

```powershell
cd "C:\Users\crist\Downloads\prototipo park plaza\bridge"
.\start.ps1
```

En otra terminal:

```powershell
cd "C:\Users\crist\Downloads\prototipo park plaza"
npm run dev
```

DPAPI usa el usuario de Windows que ejecuta el bridge. Cambiar de usuario impide descifrar templates existentes por diseño.

## Contrato HTTP v1

Todas las rutas requieren `X-Bridge-Token`. Los errores usan `{ "error": { "code": "...", "message": "..." } }`.

- `GET /api/v1/health`: salud del proceso y resumen del dispositivo.
- `GET /api/v1/device`: SDK, conexión, cantidad e índice del lector.
- `POST /api/v1/enroll`: body `{ "subjectType": "client|employee", "subjectId": "...", "timeoutMs": 30000 }`; devuelve `202` y una operación.
- `POST /api/v1/verify`: mismo body; devuelve `202` y una operación.
- `GET /api/v1/operations/{operationId}`: progreso y resultado terminal.
- `DELETE /api/v1/operations/{operationId}`: solicita cancelación.

El enrolamiento terminal devuelve sólo `templateReference` y `enrolledAt`. La verificación devuelve `matched`, `score` y la referencia opaca. Los templates cifrados nunca forman parte del contrato.

## Verificación recomendada

```powershell
& "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\MSBuild.exe" .\ParkPlaza.Zk9500Bridge.csproj /t:Rebuild /p:Configuration=Release /p:Platform=x86 /nologo
```

Después de iniciar el servicio, validar salud con el token configurado y ejecutar manualmente enrolamiento, cancelación, timeout, verificación coincidente/no coincidente, desconexión del lector y cierre con `Ctrl+C`. Esta implementación no afirma haber sido probada contra hardware desde el bridge.
