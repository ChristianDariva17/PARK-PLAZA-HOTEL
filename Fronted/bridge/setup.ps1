param(
    [string]$SdkRoot = "C:\Users\crist\Downloads\ZKFingerSDK_Windows_Standard\ZKFinger Standard SDK 5.3.0.33"
)

$ErrorActionPreference = "Stop"
$bridgeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $bridgeRoot
$wrapperSource = Join-Path $SdkRoot "C#\lib\x86\libzkfpcsharp.dll"
$vendorDirectory = Join-Path $bridgeRoot "vendor"
$configPath = Join-Path $bridgeRoot "bridge.config.json"
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
    $config.CapabilitySecret = $token
    $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8
    "Created bridge.config.json. Set BIOMETRIC_BRIDGE_CAPABILITY_SECRET to the same value in the backend environment."
} else {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if (-not $config.CapabilitySecret) {
        $bytes = New-Object byte[] 32
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $config | Add-Member -NotePropertyName CapabilitySecret -NotePropertyValue ([Convert]::ToBase64String($bytes))
        $config.PSObject.Properties.Remove("ApiToken")
        $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8
        "Updated bridge.config.json with a new CapabilitySecret. Set BIOMETRIC_BRIDGE_CAPABILITY_SECRET to the same value in the backend environment."
    } else {
        "bridge.config.json already exists; ensure CapabilitySecret matches BIOMETRIC_BRIDGE_CAPABILITY_SECRET in the backend environment."
    }
}

"Copied the vendor wrapper. Native x86 runtime must remain installed in Windows."
