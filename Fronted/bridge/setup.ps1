param(
    [string]$SdkRoot = "C:\Users\crist\Downloads\ZKFingerSDK_Windows_Standard\ZKFinger Standard SDK 5.3.0.33"
)

$ErrorActionPreference = "Stop"
$bridgeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $bridgeRoot
$wrapperSource = Join-Path $SdkRoot "C#\lib\x86\libzkfpcsharp.dll"
$vendorDirectory = Join-Path $bridgeRoot "vendor"
$configPath = Join-Path $bridgeRoot "bridge.config.json"
$envPath = Join-Path $projectRoot ".env.local"
$listenerUrl = "http://127.0.0.1:17345/"

if (-not (Test-Path -LiteralPath $wrapperSource)) {
    throw "x86 wrapper not found at $wrapperSource"
}

$urlReservation = netsh http show urlacl url=$listenerUrl 2>$null | Out-String
if ($urlReservation -notmatch [Regex]::Escape($listenerUrl)) {
    $windowsUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    netsh http add urlacl url=$listenerUrl user="$windowsUser" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not reserve $listenerUrl. Run setup.ps1 once from an elevated PowerShell session."
    }
    "Reserved the localhost listener for $windowsUser."
}

New-Item -ItemType Directory -Path $vendorDirectory -Force | Out-Null
Copy-Item -LiteralPath $wrapperSource -Destination (Join-Path $vendorDirectory "libzkfpcsharp.dll") -Force

if (-not (Test-Path -LiteralPath $configPath)) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [Convert]::ToBase64String($bytes)
    $config = Get-Content -LiteralPath (Join-Path $bridgeRoot "bridge.config.json.example") -Raw | ConvertFrom-Json
    $config.ApiToken = $token
    $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8
    @("VITE_ZK_BRIDGE_URL=http://127.0.0.1:17345", "VITE_ZK_BRIDGE_TOKEN=$token") | Set-Content -LiteralPath $envPath -Encoding UTF8
    "Created bridge.config.json and .env.local with a shared local token."
} else {
    "bridge.config.json already exists; it was not replaced. Keep .env.local synchronized with its ApiToken."
}

"Copied the vendor wrapper. Native x86 runtime must remain installed in Windows."
