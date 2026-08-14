# Authentication and authorization

The API uses opaque, revocable sessions in a high-priority HttpOnly `SameSite=Strict` cookie scoped to `/api`. Production cookies require HTTPS through the `Secure` attribute. The raw token is returned only as a cookie and PostgreSQL stores its SHA-256 digest, so altering the cookie cannot produce another valid session. Sessions have an absolute lifetime of at most eight hours, an idle lifetime of at most thirty minutes, and a partial unique index enforces one active session per account.

Accounts belong to exactly one property and one role. Staff records are separate and may reference one unique account from the same property. The backend resolves controlled `resource.action` permissions on every authenticated request. Controllers can use `@RequirePermissions('resource.action')`; the global guards authenticate first and authorize second. Use `@Public()` only for intentionally anonymous endpoints.

Administrators with `accounts.read` can list property accounts, roles, and backend staff link data through `GET /api/accounts`. `accounts.manage` protects account creation, patching, and temporary-password reset. Creation and reset set `passwordChangeRequired`; while flagged, the backend permits only session inspection, logout, and `POST /api/auth/change-password`. A successful change clears the flag, revokes all sessions, clears the cookie, and requires a fresh login. Disabling, role changes, email changes, and password resets revoke sessions in the same transaction. Self-disable, self-reset, and disabling or demoting the last active property administrator are rejected.

The React frontend uses the real cookie session, exposes `#/cuentas-acceso` only with `accounts.read`, keeps account state outside hotel mock context, and blocks the ordinary application shell while a password change is required. Backend authorization remains authoritative.

Passwords use Node's native versioned scrypt format with random salts. New passwords must contain at least twelve characters. Compromised-password checks use the official Pwned Passwords Range API, which is free and requires no API key. The backend sends only the first five uppercase characters of the password's SHA-1 digest and compares suffixes locally, so neither the plaintext password nor its complete digest leaves the process. Requests use HIBP response padding, a five-second timeout, and a bounded response size. Password provisioning fails closed if the internet dependency times out, returns an error, or sends invalid data. Login verification does not call HIBP.

Login defense is persisted in PostgreSQL for both hashed IP and hashed normalized account identifier. Updates take row locks, use a configurable rolling window, progressive response delay, and temporary lockout. Audit events are append-only at the database layer and metadata recursively removes password, token, secret, authorization, and cookie fields.

## Configuration

Add these values to the local environment. Development CORS remains disabled unless the explicit comma-separated allowlist is non-empty. Production assumes same-origin hosting under `/api`.

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:5173
AUTH_COOKIE_NAME=pp_session
AUTH_SESSION_MAX_HOURS=8
AUTH_SESSION_IDLE_MINUTES=30
AUTH_LOGIN_MAX_FAILURES=5
AUTH_LOGIN_BASE_DELAY_MS=250
AUTH_LOGIN_MAX_DELAY_MS=4000
AUTH_LOGIN_LOCK_MINUTES=15
AUTH_LOGIN_WINDOW_MINUTES=15
```

`API_TRUST_PROXY_HOPS` defaults to `0`, so forwarded client IP headers are not trusted. Set it to the exact number of trusted reverse-proxy hops in production; login defense relies on this boundary.

In PowerShell, configure the hop count only when the API is actually behind trusted proxies:

```powershell
$env:API_TRUST_PROXY_HOPS = '1'
```

## Initial administrator

After migration, ensure the backend can reach `api.pwnedpasswords.com`, set the following only in the process environment, and run `npm run bootstrap:admin` from `Backend/`. Password policy and the HIBP Range API response are validated before PostgreSQL is opened. The command is idempotent and concurrency-safe: it creates or renames the property and creates the account only if its globally normalized email does not exist. It never updates an existing password.

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
$env:BOOTSTRAP_ADMIN_PASSWORD = Read-Host 'Initial password'
$env:BOOTSTRAP_PROPERTY_CODE = 'park-plaza'
$env:BOOTSTRAP_PROPERTY_NAME = 'Park Plaza Hotel'
npm run bootstrap:admin
Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_PASSWORD, Env:BOOTSTRAP_PROPERTY_CODE, Env:BOOTSTRAP_PROPERTY_NAME
```

Recovery endpoints are deliberately out of scope. `recovery_tokens` is ready for future one-use tokens stored as hashes with expiration and an atomic `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now()` consumption boundary.
