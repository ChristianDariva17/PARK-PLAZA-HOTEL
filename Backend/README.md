# Park Plaza API foundation

NestJS 11 on Fastify, Drizzle ORM with `pg`, and PostgreSQL 17 provide the API foundation, hotel/reservation model, authentication, granular authorization, account administration, and persistent auditing. The React frontend consumes the cookie-session and account APIs through relative `/api` requests. See `AUTHENTICATION.md` for security configuration and administrator bootstrap.

PostgreSQL is authoritative for integrity. Reservation dates use hotel calendar dates and `[check_in, check_out)` semantics, so a checkout date can be another reservation's check-in date. `pending`, `confirmed`, and `checked_in` reservations are protected from room overlap by a GiST exclusion constraint. Money is `numeric(14,2)` and must remain a string at future API/domain boundaries. Guest records contain ordinary PII and identity documents only; biometric templates and the Windows device bridge remain external infrastructure.

## Local setup

Run from `Backend/` unless a command says otherwise:

```sh
npm install
cp .env.example .env
npm run migrate
npm run start:dev
```

Edit `.env` before migration. Use a password of at least 16 characters. Local commands use the Compose host endpoint at `127.0.0.1:5433`; Compose overrides the API and migration containers to the internal endpoint `postgres:5432`.

`npm install` also regenerates `package-lock.json` for the declared direct runtime dependencies. Do not run migration or Docker builds with a stale lockfile.

## Docker workflow

Migration is intentionally separate from API startup, avoiding concurrent migration races. In PowerShell, use the explicit Compose file path below so each command works even when terminal executions do not preserve the previous working directory:

```powershell
Push-Location .\Backend
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Pop-Location

docker compose -f .\compose.yaml up -d postgres
docker compose -f .\compose.yaml --profile tools run --rm migrate
docker compose -f .\compose.yaml up -d --build api
docker compose -f .\compose.yaml ps
```

### Existing-volume credential recovery

`POSTGRES_PASSWORD` initializes the database user only when PostgreSQL creates an empty data directory. Changing `Backend/.env` later does not update the password stored in an existing `postgres_data` volume, and migration then fails with PostgreSQL error `28P01`. Choose the password already configured in `Backend/.env`; this procedure does not read or print that file.

To preserve existing data, set the password of the current container database user to that same value. The plaintext exists briefly in PowerShell memory and is sent twice to the interactive `psql` `\password` command over standard input because Docker cannot consume a `SecureString` directly; it is not interpolated into SQL, placed in a process argument, or printed:

```powershell
docker compose -f .\compose.yaml up -d postgres
$DatabasePassword = Read-Host 'Enter the password already configured in Backend/.env' -AsSecureString
$Credential = [pscredential]::new('database', $DatabasePassword)
$PlainPassword = $Credential.GetNetworkCredential().Password
try {
  @('\password', $PlainPassword, $PlainPassword, '\q') | docker compose -f .\compose.yaml exec -T postgres sh -lc 'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1'
} finally {
  $PlainPassword = $null
  $Credential = $null
  $DatabasePassword.Dispose()
}
```

If there is no data to preserve, recreate the database volume instead. This is destructive and permanently deletes all database data; the replacement volume is initialized from the current `Backend/.env`:

```powershell
$Confirmation = Read-Host 'Type DELETE to permanently remove the PostgreSQL volume'
if ($Confirmation -ne 'DELETE') { throw 'Volume deletion cancelled' }
docker compose -f .\compose.yaml down -v
docker compose -f .\compose.yaml up -d postgres
```

Do not use the destructive path when the volume contains data that must be retained. Neither path changes `Backend/.env`; the selected or initialized database password and that file must remain identical.

If a new terminal starts in `Backend/`, first return to the repository root with `Set-Location ..`. If it already starts at the repository root, do not run that command.

The initial `npm install` creates the lockfile required by the Docker build's reproducible `npm ci`. Commit that generated `Backend/package-lock.json` with this work unit.

Expected public endpoints: `GET http://localhost:3000/api/health/live`, `GET http://localhost:3000/api/health/ready`, and `POST http://localhost:3000/api/auth/login`. Authenticated endpoints include `GET /api/auth/session`, `POST /api/auth/logout`, `POST /api/auth/change-password`, and the permission-protected `/api/accounts` administration routes. PostgreSQL is available to host tools only at `127.0.0.1:5433`; containers continue to use `postgres:5432`.

## Verification

```powershell
Push-Location .\Backend
npm run build
npm test
npm run test:integration
Pop-Location
```

The unit tests validate environment rules, active reservation assumptions, authentication primitives, cookie handling, and both global guards. The integration test explicitly connects to the Compose PostgreSQL endpoint at `127.0.0.1:5433`, while reusing database credentials from `Backend/.env`, and verifies the hotel/security schema, exclusion constraint, system roles, one-session index, and append-only audit triggers. No command in this README was executed while authoring this work unit.

## Rollback and cleanup

There is no down migration because destructive production rollback requires an explicit data-preservation plan. Before production data exists, the complete Docker rollback boundary is:

```sh
docker compose down
docker compose down -v
```

`down -v` permanently deletes the named PostgreSQL volume and is only appropriate when there is no data to preserve. The source rollback boundary is `Backend/` plus root `compose.yaml`; removing those paths does not alter frontend behavior.

Deferred: public password recovery endpoints, business endpoints and services, PII encryption/retention, backups, observability, Redis, MinIO, and biometric integration.
