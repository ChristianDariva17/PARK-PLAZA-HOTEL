# Park Plaza Docker stack

The Compose stack runs PostgreSQL, Redis, a one-shot database setup job, the API, the staff frontend, and the customer frontend. Browser API calls remain same-origin under `/api`; each Nginx frontend preserves that prefix and WebSocket upgrades when proxying to `http://api:3000`.

## Required configuration

Create `Backend/.env` from the repository example. These names have no fallback and must be configured before the first start:

- PostgreSQL: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- Customer authentication: `CUSTOMER_PORTAL_PROPERTY_ID`, `FIREBASE_PROJECT_ID`
- Initial data: `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_PROPERTY_CODE`, `BOOTSTRAP_PROPERTY_NAME`
- Production shared API: `API_REPLICA_MODE=shared`, a protected, highly available `REDIS_URL` using `rediss://`, and `REDIS_TLS=true`
- Production metrics: `METRICS_TOKEN` with at least 32 characters; scrape `/api/metrics` using `X-Metrics-Token`

Other Backend names have validated defaults. Compose explicitly sets the container-only database host/port/TLS mode and API host/port; its local Redis transport is explicitly `redis://` without TLS and must not be reused for production. These overrides do not change `Backend/.env` or affect host-side development commands.
The local Compose file publishes one API replica on `127.0.0.1:3000` for host tools; production horizontal scaling belongs behind an external load balancer or ingress and must not expose Redis publicly.

Do not invent or commit credentials. Setup fails clearly when required values are absent or invalid. `CUSTOMER_PORTAL_PROPERTY_ID` must be the UUID of the property identified by `BOOTSTRAP_PROPERTY_CODE`; on a fresh database that exact UUID is used to create the property. On an existing database a mismatch fails without creating a second property.

Local frontend environment files are excluded from Docker build contexts. The staff image therefore does not embed workstation-only `VITE_ZK_BRIDGE_URL` or `VITE_ZK_BRIDGE_TOKEN` values. The customer Firebase web configuration is client-side configuration already present in its source; no Backend environment or server credential is copied into either browser image.

## Start and operate

Run all commands from the repository root.

First start and starts after source changes:

```powershell
docker compose up --build
```

Normal detached start using existing images:

```powershell
docker compose up -d
```

Service URLs:

- Staff frontend: `http://localhost:5173`
- Customer frontend: `http://localhost:5174`
- API health: `http://localhost:3000/api/health/ready`
- PostgreSQL for host tools: `127.0.0.1:5433`

Inspect status and logs:

```powershell
docker compose ps -a
docker compose logs setup
docker compose logs -f api frontend customer-frontend
```

The setup service is intentionally one-shot and idempotent. It waits for PostgreSQL health, applies only pending Drizzle migrations, creates or validates the fixed property and administrator, then creates or validates room categories and rooms. The API never runs migrations and starts only after setup exits successfully.

Stop containers while preserving database data:

```powershell
docker compose down
```

Resetting the volume is destructive and permanently removes all PostgreSQL data:

```powershell
docker compose down -v
docker compose up --build
```

Never use the reset commands when the named volume contains data that must be retained. Changing `POSTGRES_PASSWORD` does not update credentials stored in an existing PostgreSQL volume.

## Backup and restore

Use the procedures in [`ops/README.md`](ops/README.md). Backups use `age`; keep the identity key outside the repository. Restore is restricted to an isolated database and must be validated before any recovery action.
