param(
  [string]$OutputDirectory = (Join-Path (Get-Location) 'backups'),
  [Parameter(Mandatory = $true)]
  [string]$AgeRecipient
)

$ErrorActionPreference = 'Stop'
$age = Get-Command age -ErrorAction SilentlyContinue
if (-not $age) {
  throw 'The age CLI is required. Install age and make it available on PATH before creating backups.'
}
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
$fileName = "park-plaza-$timestamp.dump"
$destination = Join-Path $OutputDirectory "$fileName.age"
$localPlaintext = Join-Path $OutputDirectory "$fileName.plaintext"
$remotePath = "/tmp/$fileName"

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

try {
  docker compose ps postgres --status running | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL container is not running.' }

  $dumpCommand = "set -eu; pg_dump --format=custom --no-owner --file='$remotePath' -U `"`$POSTGRES_USER`" `"`$POSTGRES_DB`""
  docker compose exec -T postgres sh -c $dumpCommand
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }

  docker compose cp "postgres:$remotePath" $localPlaintext
  if ($LASTEXITCODE -ne 0) { throw 'Could not copy the dump out of the PostgreSQL container.' }

  $item = Get-Item -LiteralPath $localPlaintext
  if ($item.Length -eq 0) { throw 'The generated backup is empty.' }
  & age -r $AgeRecipient -o $destination $localPlaintext
  if ($LASTEXITCODE -ne 0) { throw 'age encryption failed.' }
  Remove-Item -LiteralPath $localPlaintext -Force

  $item = Get-Item -LiteralPath $destination
  if ($item.Length -eq 0) { throw 'The encrypted backup is empty.' }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash.ToLowerInvariant()
  "$hash  $(Split-Path -Leaf $destination)" | Set-Content -LiteralPath "$destination.sha256" -Encoding ASCII
  Write-Output "Backup created: $destination"
  Write-Output "SHA-256: $hash"
}
finally {
  docker compose exec -T postgres sh -c "rm -f '$remotePath'" | Out-Null
  if (Test-Path -LiteralPath $localPlaintext) { Remove-Item -LiteralPath $localPlaintext -Force }
}
