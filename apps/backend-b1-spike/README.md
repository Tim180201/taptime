# TapTim.e Backend B1 Spike

> **Not production ready.** This workspace is disposable architecture evidence only. It is not a backend service, production migration, repository adapter or supported data store.

The workspace proves the ADR-0008 managed-Node transaction boundary against PostgreSQL using synthetic data. It imports the real `@taptime/core` `BusinessEngine`; SQL and helpers enforce persistence integrity and tenant isolation but contain no lifecycle business rules.

The build bundles the unchanged Core source into the disposable Node artifact and keeps `pg` external. This is necessary because the current private Core package is source-published for the monorepo's bundler-based toolchain; it does not change Core packaging for production.

## Direct PostgreSQL test

```sh
export B1_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/taptime_b1'
export B1_RUNTIME_PASSWORD='local-synthetic-b1-only'
export B1_RUNTIME_DATABASE_URL='postgresql://taptime_b1_runtime:local-synthetic-b1-only@127.0.0.1:5432/taptime_b1'
npm run typecheck --workspace=@taptime/backend-b1-spike
npm test --workspace=@taptime/backend-b1-spike
npm run build --workspace=@taptime/backend-b1-spike
```

`B1_DATABASE_URL` is used only by the privileged disposable installer and must be able to create the `taptime_b1_app`/`taptime_b1_runtime` roles and `b1_spike` schema. The lifecycle itself uses only `B1_RUNTIME_DATABASE_URL`: a separate `NOINHERIT`, non-owner, non-superuser login that may `SET ROLE taptime_b1_app` but has no direct table access. `B1_RUNTIME_PASSWORD` is synthetic test input; never reuse or log a production credential. Tests drop and recreate the schema and must never target a shared or production database.

Optional compatibility URLs:

- `B1_SUPAVISOR_SESSION_URL`
- `B1_SUPAVISOR_TRANSACTION_URL`

URLs alone are insufficient for an optional mode: the target database must already contain the disposable schema and least-privilege roles installed by the privileged B1 installer, and each URL must authenticate as the prepared runtime login. Modes are reported as skipped, not verified, when their URL is absent; a URL against an unprepared target fails rather than producing false evidence. No query in the lifecycle path is named; all request context and locks are transaction-scoped.
