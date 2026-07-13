# TapTim.e Backend Schema — Block B3

This workspace contains the versioned PostgreSQL 17 schema, migration runner and security integration evidence for Block B3.

It is **not a production backend**, repository adapter, HTTP API, Auth integration or cloud deployment. It creates no Supabase resource and contains only synthetic test identities/data. The disposable B1 spike remains separate under `apps/backend-b1-spike`.

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

The installer connection requires schema/role creation privileges. Runtime tests create separate synthetic `NOINHERIT` logins and never print their password. Do not reuse the test password or installer connection in a deployed service.
