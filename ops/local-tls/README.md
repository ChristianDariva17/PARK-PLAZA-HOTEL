# Local TLS Rehearsal

This opt-in Compose overlay runs a fresh PostgreSQL volume and Redis with local CA-signed server certificates. It does not modify the default local stack or its existing volumes.

## Run

From the repository root:

```powershell
docker compose -p park-plaza-tls -f compose.yaml -f compose.local-tls.yaml up -d --build postgres redis setup api
```

The `tls-init` service generates a local CA and server certificates into the isolated `local_tls` Docker volume. The API is exposed at `http://127.0.0.1:3100`, and the TLS PostgreSQL port is `127.0.0.1:55433`. Readiness should return `200`:

```powershell
curl.exe -i http://127.0.0.1:3100/api/health/ready
```

The overlay verifies the application-side TLS configuration through `DATABASE_SSL_CA_FILE` and `REDIS_TLS_CA_FILE`. Private keys and certificates stay inside the isolated Docker volume and are never written to the repository.

## Stop

```powershell
docker compose -p park-plaza-tls -f compose.yaml -f compose.local-tls.yaml down
```

Use `down -v` only when intentionally deleting the isolated rehearsal database and local TLS material.

## Limits

- The certificates are self-signed by a local CA and are not production credentials.
- This overlay validates database and Redis transport TLS, not production certificate issuance, secret-manager permissions, or edge TLS/HSTS.
- The default Compose stack remains plaintext locally by explicit exception.
