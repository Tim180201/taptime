# TapTim.e Backend Identity — Block B4

This isolated Node 24 workspace proves the non-production B4 identity boundary:

```text
verified asymmetric-JWKS Access Token
  -> issuer + subject
  -> PostgreSQL IdentityBinding
  -> current active Membership
  -> immutable RequestActorContext
```

It is **not** an HTTP API, Supabase deployment, Mobile login integration, invitation/bootstrap
system, account-linking implementation, repository adapter or lifecycle-ingestion service. It uses
only synthetic test identities, locally generated keys/JWKS and the current backend-schema
migrations `001` through `006`.

The configured JWKS URL is accepted only when it is exactly
`<issuer>/.well-known/jwks.json`; issuer and signing keys therefore form one trust anchor rather
than two independently configurable authorities. Issuer and JWKS use HTTPS in production.
Unencrypted HTTP is accepted only for numeric loopback test infrastructure (`127.0.0.0/8` and
`::1`); remote hosts, DNS names such as `localhost`, lookalike hostnames and non-HTTP(S) protocols
are rejected during configuration.

Required local database environment:

```text
B4_DATABASE_URL=postgresql://<installer>@127.0.0.1:5432/taptime_b4
B4_RUNTIME_PASSWORD=<synthetic-test-only-password>
```

Commands:

```text
npm run typecheck --workspace=@taptime/backend-identity
npm test --workspace=@taptime/backend-identity
npm run build --workspace=@taptime/backend-identity
```

The installer connection is used only to apply migrations and seed/inspect disposable test data.
Normal resolution uses a separate `NOINHERIT` runtime login which can assume only
`taptime_identity_resolver`; that role has no direct table reads and may execute only the two narrow
identity/Membership resolver functions approved in migrations `004` and `005`.

`withRequestActorTransaction` only propagates a `RequestActorContext` already returned by the
authoritative resolution service into transaction-local settings. It does not choose a role or
authorize again. The completed B5 boundary and current B6 lifecycle boundary each perform their
own current-Membership check and select a fixed restricted role inside their actual transaction.
