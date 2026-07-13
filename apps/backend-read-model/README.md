# TapTim.e Backend Read Model — Block B5

This private Node 24 workspace is the non-production Block B5 proof for tenant-safe, read-only
Organization/configuration repository adapters. It verifies raw access tokens through the existing
B4 Supabase JWT verifier, resolves current Membership authority inside the same PostgreSQL
transaction, selects a fixed restricted Employee or Administrator role and executes only the five
authorized reads under the existing B3 RLS policies.

The callback receives no database client, actor context or role selector. The transaction is
`READ COMMITTED READ ONLY`, all values are parameterized, and rejection or failure rolls back before
the pooled connection is released. Repository capabilities expire as soon as the callback settles,
so retained references cannot query through a released or subsequently re-leased pooled client.

This is not a production backend, HTTP API, cloud integration or general repository layer. It has no
write, list, raw-query, lifecycle or synchronization surface. Only synthetic local/CI data and
credentials may be used.

The workspace expects the current migrations `001` through `005` and the built `@taptime/backend-identity`
workspace. Run its direct PostgreSQL verification with:

```bash
B5_DATABASE_URL=postgresql://installer:password@127.0.0.1:5432/taptime_b5 \
B5_RUNTIME_PASSWORD=synthetic-only \
npm test --workspace=@taptime/backend-read-model
```
