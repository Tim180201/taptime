# TapTim.e Backend Schema — Blocks B3–C3E1

This workspace contains the versioned PostgreSQL 17 schema, migration runner and security
integration evidence through migrations `001`–`008`. Migration `006` adds the isolated C3B
bootstrap capability; migration `007` adds the narrow normal-administration role, display-name and
safe receipt/audit contracts; migration `008` adds the isolated Employee invitation/redemption
boundary. Migrations `001`–`007` remain immutable.

It is **not a production backend**, repository adapter, HTTP API, Auth provider integration or cloud deployment. It creates no Supabase resource and contains only synthetic test identities/data. The disposable B1 spike remains separate under `apps/backend-b1-spike`.

Required local environment:

```text
B3_DATABASE_URL=postgresql://<installer>@127.0.0.1:5432/taptime_b3
B3_RUNTIME_PASSWORD=<synthetic-test-only-password>
```

Commands:

```text
npm run typecheck --workspace=@taptime/backend-schema
npm run migrate --workspace=@taptime/backend-schema
npm run verify-migrations --workspace=@taptime/backend-schema
npm test --workspace=@taptime/backend-schema
npm run build --workspace=@taptime/backend-schema
```

Migrations `006` through `008` require an out-of-band PostgreSQL superuser installer because they
create deliberately isolated `BYPASSRLS` function-owner roles behind fixed capabilities. Migrations
must never run at application startup. Runtime tests create separate synthetic `NOINHERIT` logins
and never print their password. Do not reuse the test password or installer connection in a
deployed service.
