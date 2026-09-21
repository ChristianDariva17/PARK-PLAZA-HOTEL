# PostgreSQL Backup Runbook

These scripts create and restore PostgreSQL backups without modifying the configured application database during a restore.

## Quick path

1. Start PostgreSQL only: `docker compose up -d postgres`.
2. Create an encrypted backup: `./ops/backup-postgres.ps1 -AgeRecipient age1...`.
3. Verify the generated `.sha256` file and copy both files to encrypted external storage.
4. Restore into an isolated database: `./ops/restore-postgres.ps1 -BackupFile ./backups/park-plaza-<timestamp>.dump.age -AgeIdentityFile ./secrets/age-key.txt`.
5. Validate the restored database before using it for any recovery decision.
6. Run `./ops/audit-postgres.ps1` after migration or restore and retain its output with the deployment evidence. For an isolated restore, pass `-DatabaseName park_plaza_restore`.

The scripts do not print database credentials, and restore refuses to target the configured application database. The backup script requires an `age` recipient and never leaves the plaintext dump as a persistent artifact.

## Backup policy

The operational owner must set these values before production use:

| Control | Required decision |
| --- | --- |
| RPO | Maximum acceptable data loss, for example 24 hours |
| RTO | Maximum acceptable recovery time, for example 2 hours |
| Schedule | Backup frequency and owner |
| External storage | Encrypted location outside the application host |
| Retention | Number of daily, weekly, and monthly copies |
| Restore drill | Frequency and evidence required |

The Docker named volume is not a backup. Backups must leave the host and must be tested by restoring them.

## Restore safety

- Restore into `park_plaza_restore` or another isolated database first.
- Do not run `docker compose down -v`; that permanently deletes the named volume.
- Do not overwrite production from this script.
- Treat backup files as sensitive because they contain the complete database.
- Keep the checksum beside the backup and verify it before restoration.

## Current limits

- The scripts provide logical dump and isolated restore, not point-in-time recovery.
- The encrypted artifact uses `age`; keep the identity file outside the repository and protect it with the approved secret-management process.
- WAL archiving or managed PostgreSQL snapshots must be added if the selected RPO requires less than one dump interval.
- External storage and retention are intentionally not automated until the storage provider and policy are approved.

## Migration gate

The API readiness check requires the `schema_sentinels.application_schema` row to match `DATABASE_SCHEMA_VERSION`. A fresh database and an upgraded database must report the same sentinel version before traffic is enabled.

For a fresh-schema rehearsal against an alternate database, create that database first with the configured PostgreSQL role, then run the setup service with the alternate `POSTGRES_DB`. The setup service intentionally migrates an existing database; it does not create arbitrary database names.

## Replica policy

The API supports `API_REPLICA_MODE=shared` when `REDIS_URL` points to a highly available Redis deployment. Redis provides distributed throttling and the Socket.IO pub/sub adapter. Startup fails closed if shared mode cannot connect to Redis. Use `API_REPLICA_MODE=single` only when the deployment intentionally has one API replica.

The `/api/metrics` endpoint exposes Prometheus text metrics. In production, set `METRICS_TOKEN` to a secret of at least 32 characters and configure the scraper to send it as `X-Metrics-Token`; do not publish this endpoint through a public ingress. Production shared Redis must use a `rediss://` URL with `REDIS_TLS=true` and a trusted CA strategy. The local Compose Redis service is intentionally unauthenticated and plaintext; it must not be reused as a production Redis deployment without network isolation, authentication, TLS, persistence, and HA policy.

## Phase 4 verification

The pull request gate is defined in `.github/workflows/verification.yml`. It runs the backend typecheck, Oxlint, build, unit tests, V8 coverage thresholds, PostgreSQL integration tests, production dependency audit, OpenAPI contract check, both frontend builds/lints/tests, and the available Playwright smoke suites.

The OpenAPI contract is available at `/api/docs-json` only outside `NODE_ENV=production`. `Backend` exposes it through `npm run verify:contract`; the check validates required routes, DTO schemas, and permission metadata. Keep authenticated E2E credentials in CI secrets; the default smoke suites intentionally run without credentials.
