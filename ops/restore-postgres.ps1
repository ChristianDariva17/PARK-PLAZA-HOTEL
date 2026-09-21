param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [Parameter(Mandatory = $true)]
  [string]$AgeIdentityFile,
  [string]$TargetDatabase = 'park_plaza_restore'
)

$ErrorActionPreference = 'Stop'
$age = Get-Command age -ErrorAction SilentlyContinue
if (-not $age) {
  throw 'The age CLI is required. Install age and make it available on PATH before restoring backups.'
}

if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) {
  throw "Backup file not found: $BackupFile"
}
if (-not (Test-Path -LiteralPath $AgeIdentityFile -PathType Leaf)) {
  throw "Age identity file not found: $AgeIdentityFile"
}
if ($TargetDatabase -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
  throw 'TargetDatabase must be a valid PostgreSQL identifier.'
}

$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$resolvedIdentity = (Resolve-Path -LiteralPath $AgeIdentityFile).Path
$plainFileName = "park-plaza-restore-$([guid]::NewGuid().ToString('N')).dump"
$localPlaintext = Join-Path ([System.IO.Path]::GetTempPath()) $plainFileName
$containerBackup = "/tmp/$plainFileName"
$sourceDatabase = (docker compose exec -T postgres sh -c 'printf %s "$POSTGRES_DB"').Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not read the configured PostgreSQL database name.' }
$databaseUser = (docker compose exec -T postgres sh -c 'printf %s "$POSTGRES_USER"').Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($databaseUser)) { throw 'Could not read the configured PostgreSQL user.' }
if ($TargetDatabase -eq $sourceDatabase) {
  throw "Refusing to restore over the configured database '$sourceDatabase'. Use a separate restore database."
}

$checksumFile = "$resolvedBackup.sha256"
if (Test-Path -LiteralPath $checksumFile -PathType Leaf) {
  $expectedHash = (Get-Content -LiteralPath $checksumFile -Raw).Split(' ')[0].Trim().ToLowerInvariant()
  $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedBackup).Hash.ToLowerInvariant()
  if ($expectedHash -ne $actualHash) { throw 'Backup checksum does not match.' }
}

try {
  & age -d -i $resolvedIdentity -o $localPlaintext $resolvedBackup
  if ($LASTEXITCODE -ne 0) { throw 'age decryption failed.' }

  docker compose cp $localPlaintext "postgres:$containerBackup"
  if ($LASTEXITCODE -ne 0) { throw 'Could not copy the backup into the PostgreSQL container.' }

  $createDatabase = "set -eu; createdb -U `"`$POSTGRES_USER`" '$TargetDatabase' 2>/dev/null || true"
  docker compose exec -T postgres sh -c $createDatabase
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the restore database.' }

  $restoreCommand = "set -eu; pg_restore --format=custom --clean --if-exists --no-owner --dbname='$TargetDatabase' -U `"`$POSTGRES_USER`" '$containerBackup'"
  docker compose exec -T postgres sh -c $restoreCommand
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }

  $validationQuery = "select 'reservations', count(*) from information_schema.tables where table_schema = 'public' and table_name = 'reservations'; select 'schema_sentinel', coalesce((select version from schema_sentinels where key = 'application_schema'), 'missing');"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U $databaseUser -d $TargetDatabase -Atc $validationQuery
  if ($LASTEXITCODE -ne 0) { throw 'Restored database validation failed.' }
  Write-Output "Backup restored into isolated database: $TargetDatabase"
}
finally {
  docker compose exec -T postgres sh -c "rm -f '$containerBackup'" | Out-Null
  if (Test-Path -LiteralPath $localPlaintext) { Remove-Item -LiteralPath $localPlaintext -Force }
}
