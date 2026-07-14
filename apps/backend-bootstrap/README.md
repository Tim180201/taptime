# TapTim.e Secure Organization Bootstrap — Block C3B

This isolated Node 24 workspace is the private operator plane for creating the first Organization
and its first Administrator. It is not an HTTP route, product role, Mobile/Admin-Web capability,
Supabase service-role integration or generic administration tool.

The command verifies the target Administrator's access token with the existing issuer-bound B4
verifier, normalizes the Organization name under `taptime-name-v1` (Unicode 15.1), then opens one
short-lived PostgreSQL session as an individually provisioned operator. It explicitly assumes only
`taptime_bootstrap_executor` and invokes the single migration-`006` SECURITY DEFINER capability.
Tokens and passwords are accepted only through hidden TTY input or the explicit bounded two-line
stdin channel; neither secret is accepted in argv, environment variables, a connection URL or the
platform target profile.

The non-secret, platform-owned JSON profile has exactly this shape; unknown top-level or
mode-specific keys are rejected:

```json
{
  "version": 1,
  "supabaseIssuer": "https://project.supabase.co/auth/v1",
  "database": {
    "mode": "remote",
    "host": "direct-postgres.example.internal",
    "port": 5432,
    "name": "taptime",
    "rootCaPath": "/etc/taptime/postgres-root-ca.pem"
  }
}
```

Remote profiles and CA files must be root-owned regular files, not symlinks or group/world
writable. Each is opened once with no-follow semantics, validated and bounded-read through that
same file handle. Remote mode requires an exact DNS host, a parseable CA certificate and TLS
hostname/CA verification; the PostgreSQL gateway independently revalidates this target so a
programmatic caller cannot downgrade remote mode to plaintext. The separate
`loopback-test` mode accepts only numeric loopback and deliberately disables TLS; it is never a
remote fallback.

Operator provisioning is out of band. Each principal must match
`taptime_bootstrap_operator_<opaque-id>`, where the opaque suffix is 12–36 lowercase ASCII
letters/digits so the complete principal fits PostgreSQL's 63-byte identifier limit. It must be
`LOGIN NOINHERIT`, expire within 24 hours, have no
privileged role attributes and have exactly one non-inheritable, settable, non-admin membership in
`taptime_bootstrap_executor`. One-human/one-principal inventory, credential delivery, database
`CONNECT`, server-side TLS/host policy and revocation remain mandatory operations evidence; the
repository cannot prove that humans did not share a credential.

Migration `006` targets a dedicated TapTim.e database. It revokes database `CREATE` and `TEMPORARY`
from `PUBLIC`, rejects any pre-existing current-database/shared-object dependency of either
bootstrap role, then grants only the fixed C3B graph. PostgreSQL roles are cluster-wide while
ordinary object catalogs are database-local; absence of ownership/ACLs inside another database is
therefore a platform/IAM audit and dedicated-cluster precondition, not a repository-proven global
claim.

The named operator is an explicit identity-attestation authority for this one bootstrap capability.
PostgreSQL receives verified issuer/subject values, not the provider token, and therefore cannot
cryptographically prove that the official CLI performed JWT verification. Direct capability use by
that same privileged operator is detectable through immutable `session_user` attribution but not
technically distinguishable from CLI use. Production operations must restrict, inventory and review
this authority; ordinary application credentials can never reach it.

Example invocation:

```bash
node apps/backend-bootstrap/dist/main.js \
  --profile /etc/taptime/bootstrap-production.json \
  --operator-login taptime_bootstrap_operator_0123456789ab \
  --request-id 12345678-1234-4123-8123-123456789abc \
  --organization-name "Example GmbH"
```

Use `--secrets-stdin` only with an approved protected channel containing exactly two bounded UTF-8
lines: access token first, database password second. Output is exactly one safe JSON line. Only a
success contains generated IDs; rejections never do.

Local verification uses a dedicated disposable PostgreSQL 17 database and a superuser installer:

```bash
export C3B_DATABASE_URL="postgresql://$USER@127.0.0.1:5432/taptime_c3b"
npm run build --workspace=@taptime/administration-contract
npm run typecheck --workspace=@taptime/backend-bootstrap
npm test --workspace=@taptime/backend-bootstrap
npm run build --workspace=@taptime/backend-bootstrap
```

This is production-shaped repository implementation, not a production-operational bootstrap. A
real direct PostgreSQL endpoint, platform-owned profile/CA, named short-lived operator credential,
IAM inventory and execution evidence remain deployment gates.
