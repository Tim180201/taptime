import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { applyMigrationSet, loadMigrations } from '../../apps/backend-schema/src/index.js';
import { createBackendApiRuntime, type BackendApiRuntimeConfiguration } from '../../apps/backend-api/src/runtime.js';
import { startSyntheticJwks, accessToken, listen, closeServer } from '../../apps/backend-api/tests/fixtures.js';

export const output = resolve(process.env.TAPTIME_PILOT_OUTPUT ?? '.t099a-review');
export const seed = 't099a-2026-10-22-v1';
const proxySecret = Buffer.alloc(32, 99).toString('base64url');
export const id = (label: string) => {
  const h = createHash('sha256').update(`${seed}:${label}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
};
export const iso = (time: number | Date) => new Date(time).toISOString();
export const save = async (path: string, value: unknown) => {
  await mkdir(resolve(output, path, '..'), { recursive: true });
  await writeFile(resolve(output, path), JSON.stringify(value, null, 2) + '\n');
};
export const requireStatus = <T extends { status: string }>(value: T, expected: string, context: string): T => {
  if (value.status !== expected) throw new Error(`${context}: ${JSON.stringify(value)}`);
  return value;
};
export function localDatabaseUrl(): URL {
  if (process.env.TAPTIME_PILOT_SIZE !== 'synthetic-local-only' || process.env.CI) {
    throw new Error('Local opt-in required: TAPTIME_PILOT_SIZE=synthetic-local-only; CI is forbidden');
  }
  const raw = process.env.TAPTIME_PILOT_DATABASE_URL;
  if (!raw) throw new Error('TAPTIME_PILOT_DATABASE_URL must explicitly select the local installer database');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', '[::1]'].includes(url.hostname)
      || !url.username || url.search || url.hash) throw new Error('Only a numeric loopback PostgreSQL URL without options is allowed');
  return url;
}
export async function environment(profile: string) {
  const base = localDatabaseUrl();
  const installer = new Pool({ connectionString: base.href, max: 1 });
  const suffix = randomUUID().replaceAll('-', '').slice(0,16);
  const databaseName = `t099a_${profile}_${suffix}`;
  const url = new URL(base); url.pathname = `/${databaseName}`;
  const db = new Pool({ connectionString: url.href, max: 10 });
  const logins: string[] = [];
  const seedPools: Pool[] = [];
  let created = false;
  let jwks: Awaited<ReturnType<typeof startSyntheticJwks>> | undefined;
  let runtime: ReturnType<typeof createBackendApiRuntime> | undefined;
  const cleanup = async () => {
    await runtime?.close();
    if (jwks) await closeServer(jwks.server);
    await Promise.all(seedPools.map(pool => pool.end()));
    await db.end();
    if (created) await installer.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    for (const login of logins.reverse()) await installer.query(`DROP ROLE "${login}"`);
    await installer.end();
    await save(`${profile}/resources.json`,{databaseName,logins,cleaned:true});
  };
  try {
    const version = (await installer.query('SHOW server_version')).rows[0].server_version as string;
    if (Number(version.split('.')[0]) !== 17) throw new Error('This brief requires PostgreSQL 17');
    await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
    await save(`${profile}/resources.json`,{databaseName,logins,cleaned:false});
    const migrations = await loadMigrations(resolve('apps/backend-schema/migrations'));
    // Measure the current schema. applyMigrationSet verifies its ledger; generate()
    // verifies the resulting fixture instead of pinning the age of this runner.
    await save(`${profile}/migrations.json`, migrations.map(migration => migration.version));
    await applyMigrationSet(db, migrations);
    jwks = await startSyntheticJwks();
    // Derive the actual privilege graph from the production login source.
    const source = await readFile('infrastructure/postgres/server-runtime-logins.sql', 'utf8');
    const graph = new Map<string, string[]>();
    for (const match of source.matchAll(/GRANT\s+([a-z_,\s]+?)\s+TO\s+taptime_([a-z_]+);/g)) {
      graph.set(match[2]!, match[1]!.split(',').map(s => s.trim()));
    }
    graph.set('operator', ['taptime_platform_operator']);
    const names: Record<string, string> = {
      session:'session', readModel:'read_model', lifecycle:'lifecycle', administration:'administration',
      employeeInvitation:'invitation', employeeEnrollment:'enrollment', reassignment:'reassignment',
      offlineLease:'offline_lease', offlineEvent:'offline_event', offlineReconciliation:'offline_reconciliation',
      timeEntryExport:'time_export', timeReviewRead:'time_review_read', timeReviewWrite:'time_review_write',
      manualLifecycle:'manual_lifecycle', mobileOwnTime:'mobile_own_time', mobileTarget:'mobile_target',
      projectAdministration:'project_administration', operator:'operator',
    };
    const configuration: Record<string, string> = { supabaseIssuer: jwks.issuerA,
      mobileOwnTimeCursorHmacKey: Buffer.alloc(32, 99).toString('base64url'), operatorVersion:'synthetic-T099a' };
    const urls: Record<string, string> = {};
    for (const [key, name] of Object.entries(names)) {
      const parents = graph.get(name);
      if (!parents?.length || !parents.every(role => /^taptime_[a-z_]+$/.test(role))) throw new Error(`Missing production roles: ${name}`);
      const login = `t099a_${suffix}_${name}`;
      const password = randomUUID();
      await db.query(`CREATE ROLE "${login}" LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
      logins.push(login);
      await save(`${profile}/resources.json`,{databaseName,logins,cleaned:false});
      await db.query(`GRANT ${parents.join(', ')} TO "${login}"`);
      const runtimeUrl = new URL(url); runtimeUrl.username = login; runtimeUrl.password = password;
      configuration[`${key}DatabaseUrl`] = urls[key] = runtimeUrl.href;
    }
    const diagnostics: unknown[] = [];
    runtime = createBackendApiRuntime(configuration as unknown as BackendApiRuntimeConfiguration, {
      // Same explicit archive test adapter as historical fixture generation. The online
      // coordinator otherwise commits then returns 503 without a real archive service.
      // This measures DB/HTTP capacity, never external durability or archive latency.
      lifecycleArchiveDurability:{requireOffsiteArchive:async()=>({requiredWalFile:'000000010000000000000001',offsiteArchived:true})},
      // Same trusted-proxy mode as production; only local fixture addresses are supplied.
      clientAddressMode: { mode:'trusted_proxy', sharedSecret:proxySecret },
      operatorHost:'operator.pilot.invalid', onDiagnostic: event => { diagnostics.push(event); },
    });
    await listen(runtime.server);
    const address = runtime.server.address();
    if (!address || typeof address === 'string') throw new Error('Missing local HTTP address');
    const origin = `http://127.0.0.1:${address.port}`;
    return { db, urls, databaseName, version, issuer:jwks.issuerA, origin, diagnostics, cleanup,
      token: (subject: string, operator = false) => accessToken(jwks!, {
        subject, expiresAt:Math.floor(Date.now()/1000)+24*3600,
        claims: { email:'synthetic-pilot@example.invalid', aal:operator?'aal2':'aal1' },
      }),
      seedPool: (kind: string) => {
        if (!urls[kind]) throw new Error(`Missing seed role ${kind}`);
        const pool = new Pool({ connectionString:urls[kind], max:8 }); seedPools.push(pool); return pool;
      },
    };
  } catch (error) { await cleanup(); throw error; }
}
export type Environment = Awaited<ReturnType<typeof environment>>;
export const proxyHeaders = (address: string) => ({
  'x-taptime-proxy-secret':proxySecret,
  'x-forwarded-for':address,
});
