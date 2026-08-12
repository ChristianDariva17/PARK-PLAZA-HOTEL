$ErrorActionPreference = "Stop"
$bridgeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$msbuild = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\MSBuild.exe"
$project = Join-Path $bridgeRoot "ParkPlaza.Zk9500Bridge.csproj"

if (-not (Test-Path -LiteralPath (Join-Path $bridgeRoot "vendor\libzkfpcsharp.dll"))) {
    throw "Run .\setup.ps1 first to stage the x86 managed wrapper outside source control."
}
if (-not (Test-Path -LiteralPath (Join-Path $bridgeRoot "bridge.config.json"))) {
    throw "Run .\setup.ps1 first to create the local configuration."
}

& $msbuild $project /t:Build /p:Configuration=Release /p:Platform=x86 /nologo
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$output = Join-Path $bridgeRoot "bin\Release"
Copy-Item -LiteralPath (Join-Path $bridgeRoot "bridge.config.json") -Destination (Join-Path $output "bridge.config.json") -Force
& (Join-Path $output "ParkPlaza.Zk9500Bridge.exe")
