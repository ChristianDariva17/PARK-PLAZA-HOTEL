# PostgreSQL Backup Runbook

These scripts create and restore PostgreSQL backups without modifying the configured application database during a restore.

## Quick path

1. Start PostgreSQL only: `docker compose up -d postgres`.
2. Create an encrypted backup: `./ops/backup-postgres.ps1 -AgeRecipient age1...`.
3. Verify the generated `.sha256` file and copy both files to encrypted external storage.
4. Restore into an isolated database: `./ops/restore-postgres.ps1 -BackupFile ./backups/park-plaza-<timestamp>.dump.age -AgeIdentityFile ./secrets/age-key.txt`.
5. Validate the restored database before using it for any recovery decision.

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
