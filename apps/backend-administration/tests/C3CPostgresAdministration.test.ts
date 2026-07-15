import { createHash } from 'node:crypto';
import {
  createCustomerCommandDigestV1,
  normalizeOrganizationNameV1,
  provisionNfcTagCommandDigestV1,
} from '@taptime/administration-contract';
import {
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  applyMigrationSet,
  loadMigrations,
  migrate,
} from '@taptime/backend-schema';
import { MembershipId } from '@taptime/core';
import { Pool, type PoolClient } from 'pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  AdminWriteSessionCoordinator,
  C3CDeadlineExceededError,
  InjectedC3CFailure,
} from '../src/index.js';
import type {
  AdminWriteStage,
  CreateCustomerCommand,
  ProvisionNfcTagCommand,
  ReadSetupProjectionCommand,
} from '../src/types.js';
import {
  C3C_RUNTIME_LOGIN,
  customerIds,
  ensureC3CRuntimeLogin,
  fixtureAccessTokenVerifier,
  fixtureTokens,
  ids,
  membershipIds,
  postgresErrorCode,
  removeC3CRuntimeLogin,
  runtimeConnectionString,
  seedC3C,
  syntheticPassword,
  truncateC3C,
  withAdminSetupContext,
} from './fixtures.js';

const installerDatabaseUrl = process.env.C3C_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3c';
const runtimePassword = syntheticPassword();
const commandIds = {
  create: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  createSecond: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
  provision: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  provisionSecond: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc',
} as const;
const contaminationCases = [
  {
    label: 'schema ACL',
    kind: 'schema_acl',
    role: 'taptime_admin_setup',
  },
  {
    label: 'relation ACL',
    kind: 'relation_acl',
    role: 'taptime_admin_setup_data_function_owner',
  },
  {
    label: 'schema ownership',
    kind: 'schema_owner',
    role: 'taptime_admin_setup_function_owner',
  },
  {
    label: 'database role setting',
    kind: 'role_setting',
    role: 'taptime_admin_setup_data_function_owner',
  },
] as const;

let installerPool: Pool;
let runtimePool: Pool;
let runtimeDatabaseUrl: string;
let coordinator: AdminWriteSessionCoordinator;

beforeAll(async () => {
  installerPool = new Pool({ connectionString: installerDatabaseUrl, max: 4 });
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await expect(migrate(installerPool)).resolves.toEqual({
    applied: ['001', '002', '003', '004', '005', '006', '007', '008'],
    alreadyApplied: [],
  });
  await ensureC3CRuntimeLogin(installerPool, runtimePassword);
  runtimeDatabaseUrl = runtimeConnectionString(installerDatabaseUrl, runtimePassword);
  runtimePool = new Pool({ connectionString: runtimeDatabaseUrl, max: 12 });
  coordinator = new AdminWriteSessionCoordinator(runtimePool, fixtureAccessTokenVerifier);
  await runtimePool.query('SELECT 1');
}, 30_000);

beforeEach(async () => {
  await truncateC3C(installerPool);
  await seedC3C(installerPool);
});

afterAll(async () => {
  await runtimePool?.end();
  if (installerPool !== undefined) {
    await removeC3CRuntimeLogin(installerPool);
    await installerPool.end();
  }
});

describe('migration 007, roles and database contracts', () => {
  it('records exactly immutable migrations 001 through 008 and reruns without changes', async () => {
    expect((await loadMigrations()).map(({ version }) => version)).toEqual([
      '001', '002', '003', '004', '005', '006', '007', '008',
    ]);
    await expect(migrate(installerPool)).resolves.toEqual({
      applied: [],
      alreadyApplied: ['001', '002', '003', '004', '005', '006', '007', '008'],
    });
  });

  it.each(contaminationCases)(
    'atomically rejects pre-existing C3C $label contamination, then migrates cleanly',
    async ({ kind, role }) => {
      const database = `taptime_c3c_dirty_${kind}`;
      await installerPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)} WITH (FORCE)`);
      await installerPool.query(`CREATE DATABASE ${quoteIdentifier(database)}`);
      const url = new URL(installerDatabaseUrl);
      url.pathname = `/${database}`;
      const dirtyPool = new Pool({ connectionString: url.toString(), max: 2 });
      try {
        const migrations = await loadMigrations();
        await expect(applyMigrationSet(dirtyPool, migrations.slice(0, 6))).resolves.toEqual({
          applied: ['001', '002', '003', '004', '005', '006'],
          alreadyApplied: [],
        });
        await dirtyPool.query('CREATE SCHEMA dirty_c3c');
        if (kind === 'schema_acl') {
          await dirtyPool.query(`GRANT USAGE ON SCHEMA dirty_c3c TO ${role}`);
        } else if (kind === 'relation_acl') {
          await dirtyPool.query('CREATE TABLE dirty_c3c.marker (id integer)');
          await dirtyPool.query(`GRANT SELECT ON dirty_c3c.marker TO ${role}`);
        } else if (kind === 'schema_owner') {
          await dirtyPool.query(`ALTER SCHEMA dirty_c3c OWNER TO ${role}`);
        } else {
          await dirtyPool.query(
            `ALTER ROLE ${role} IN DATABASE ${quoteIdentifier(database)}
             SET search_path TO dirty_c3c, pg_catalog`,
          );
        }

        await expect(applyMigrationSet(dirtyPool, migrations.slice(6))).rejects.toMatchObject({
          code: '42501',
        });
        const atomicState = await dirtyPool.query<{
          ledger_rows: number;
          created_function: string | null;
        }>(`
          SELECT
            (SELECT count(*)::integer FROM ${B3_MIGRATION_TABLE} WHERE version = '007') AS ledger_rows,
            to_regprocedure('taptime_server.normalize_taptime_name_v1(text,text)')::text AS created_function
        `);
        expect(atomicState.rows[0]).toEqual({ ledger_rows: 0, created_function: null });

        if (kind === 'role_setting') {
          await dirtyPool.query(
            `ALTER ROLE ${role} IN DATABASE ${quoteIdentifier(database)} RESET search_path`,
          );
        } else {
          await dirtyPool.query('DROP SCHEMA dirty_c3c CASCADE');
        }
        await expect(applyMigrationSet(dirtyPool, migrations.slice(6))).resolves.toEqual({
          applied: ['007', '008'],
          alreadyApplied: [],
        });
      } finally {
        await dirtyPool.end();
        await installerPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)} WITH (FORCE)`);
        await ensureC3CRuntimeLogin(installerPool, runtimePassword);
      }
    },
    30_000,
  );

  it('fails closed when a pre-007 Organization name is outside taptime-name-v1', async () => {
    const database = 'taptime_c3c_invalid_organization_name';
    await installerPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)} WITH (FORCE)`);
    await installerPool.query(`CREATE DATABASE ${quoteIdentifier(database)}`);
    const url = new URL(installerDatabaseUrl);
    url.pathname = `/${database}`;
    const migrationPool = new Pool({ connectionString: url.toString(), max: 2 });
    try {
      const migrations = await loadMigrations();
      await expect(applyMigrationSet(migrationPool, migrations.slice(0, 6))).resolves.toEqual({
        applied: ['001', '002', '003', '004', '005', '006'],
        alreadyApplied: [],
      });
      await migrationPool.query(
        `INSERT INTO taptime_server.organizations (id, name)
         VALUES ('90000000-0000-4000-8000-000000000010', '  Not Canonical  ')`,
      );

      await expect(applyMigrationSet(migrationPool, migrations.slice(6))).rejects.toMatchObject({
        code: '23514',
      });
      const atomicState = await migrationPool.query<{ ledger_rows: number }>(`
        SELECT count(*)::integer AS ledger_rows
        FROM ${B3_MIGRATION_TABLE}
        WHERE version = '007'
      `);
      expect(atomicState.rows[0]).toEqual({ ledger_rows: 0 });

      await migrationPool.query(
        `UPDATE taptime_server.organizations
         SET name = 'Canonical Organization', row_version = row_version + 1
         WHERE id = '90000000-0000-4000-8000-000000000010'`,
      );
      await expect(applyMigrationSet(migrationPool, migrations.slice(6))).resolves.toEqual({
        applied: ['007', '008'],
        alreadyApplied: [],
      });
    } finally {
      await migrationPool.end();
      await installerPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)} WITH (FORCE)`);
      await ensureC3CRuntimeLogin(installerPool, runtimePassword);
    }
  }, 30_000);

  it('pins PostgreSQL 17, UTF8 and Unicode 15.1', async () => {
    const result = await installerPool.query<{
      major: string;
      encoding: string;
      unicode: string;
    }>(`
      SELECT
        substring(current_setting('server_version_num') FROM 1 FOR 2) AS major,
        current_setting('server_encoding') AS encoding,
        unicode_version() AS unicode
    `);
    expect(result.rows[0]).toEqual({ major: '17', encoding: 'UTF8', unicode: '15.1' });
  });

  it('normalizes setup roles and the runtime role graph exactly', async () => {
    const roles = await installerPool.query(`
      SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole,
        rolreplication, rolbypassrls
      FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'taptime_admin_setup',
        'taptime_admin_setup_function_owner',
        'taptime_admin_setup_data_function_owner',
        '${C3C_RUNTIME_LOGIN}'
      )
      ORDER BY rolname
    `);
    expect(roles.rows).toEqual([
      {
        rolname: 'taptime_admin_setup', rolcanlogin: false, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false,
        rolreplication: false, rolbypassrls: false,
      },
      {
        rolname: 'taptime_admin_setup_data_function_owner', rolcanlogin: false, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false,
        rolreplication: false, rolbypassrls: true,
      },
      {
        rolname: 'taptime_admin_setup_function_owner', rolcanlogin: false, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false,
        rolreplication: false, rolbypassrls: true,
      },
      {
        rolname: C3C_RUNTIME_LOGIN, rolcanlogin: true, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false,
        rolreplication: false, rolbypassrls: false,
      },
    ]);

    const edges = await installerPool.query(`
      SELECT parent.rolname AS parent, member.rolname AS member,
        edge.inherit_option, edge.set_option, edge.admin_option
      FROM pg_catalog.pg_auth_members AS edge
      JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      WHERE member.rolname = '${C3C_RUNTIME_LOGIN}'
         OR member.rolname IN (
           'taptime_admin_setup',
           'taptime_admin_setup_function_owner',
           'taptime_admin_setup_data_function_owner'
         )
         OR parent.rolname IN (
           'taptime_admin_setup_function_owner',
           'taptime_admin_setup_data_function_owner'
         )
      ORDER BY parent, member
    `);
    expect(edges.rows).toEqual([
      {
        parent: 'taptime_admin_setup', member: C3C_RUNTIME_LOGIN,
        inherit_option: false, set_option: true, admin_option: false,
      },
      {
        parent: 'taptime_identity_resolver', member: C3C_RUNTIME_LOGIN,
        inherit_option: false, set_option: true, admin_option: false,
      },
    ]);
  });

  it('keeps the setup role least-privileged and denies raw NFC reads', async () => {
    const privileges = await installerPool.query(`
      SELECT
        has_schema_privilege('taptime_admin_setup', '${B3_SCHEMA}', 'USAGE') AS schema_usage,
        has_any_column_privilege('taptime_admin_setup', '${B3_SCHEMA}.customers', 'SELECT') AS customer_select,
        has_any_column_privilege('taptime_admin_setup', '${B3_SCHEMA}.customers', 'INSERT') AS customer_insert,
        has_table_privilege('taptime_admin_setup', '${B3_SCHEMA}.customers', 'UPDATE') AS customer_update,
        has_table_privilege('taptime_admin_setup', '${B3_SCHEMA}.customers', 'DELETE') AS customer_delete,
        has_column_privilege('taptime_admin_setup', '${B3_SCHEMA}.nfc_tags', 'payload_value', 'SELECT') AS raw_select,
        has_column_privilege('taptime_admin_setup', '${B3_SCHEMA}.nfc_tags', 'payload_value', 'INSERT') AS raw_insert,
        has_column_privilege('taptime_admin_setup', '${B3_SCHEMA}.nfc_tags', 'validation_fingerprint', 'SELECT') AS fingerprint_select,
        has_function_privilege(
          'taptime_admin_setup',
          '${B3_SCHEMA}.insert_admin_setup_nfc_tag_v1(uuid,uuid,text,text)',
          'EXECUTE'
        ) AS safe_insert_execute,
        has_function_privilege(
          'public',
          '${B3_SCHEMA}.insert_admin_setup_nfc_tag_v1(uuid,uuid,text,text)',
          'EXECUTE'
        ) AS public_insert_execute,
        has_function_privilege(
          'taptime_admin_setup',
          '${B3_SCHEMA}.lock_admin_setup_active_customer_v1(uuid,uuid)',
          'EXECUTE'
        ) AS safe_lock_execute,
        has_function_privilege(
          'public',
          '${B3_SCHEMA}.lock_admin_setup_active_customer_v1(uuid,uuid)',
          'EXECUTE'
        ) AS public_lock_execute,
        has_function_privilege(
          'public',
          '${B3_SCHEMA}.enforce_admin_setup_receipt_integrity()',
          'EXECUTE'
        ) AS public_receipt_integrity_execute,
        has_table_privilege('taptime_admin_setup', '${B3_SCHEMA}.nfc_tags', 'UPDATE') AS tag_update,
        has_table_privilege('taptime_admin_setup', '${B3_SCHEMA}.nfc_tags', 'DELETE') AS tag_delete,
        has_table_privilege('taptime_admin_setup', '${B3_SCHEMA}.admin_setup_command_receipts', 'SELECT') AS receipt_select,
        has_table_privilege('taptime_admin_setup', '${B3_SCHEMA}.admin_setup_command_receipts', 'INSERT') AS receipt_insert,
        has_table_privilege('taptime_admin_setup', '${B3_SCHEMA}.admin_setup_command_receipts', 'UPDATE') AS receipt_update,
        has_table_privilege('taptime_admin_setup', '${B3_SCHEMA}.admin_setup_command_receipts', 'DELETE') AS receipt_delete
    `);
    expect(privileges.rows[0]).toEqual({
      schema_usage: true,
      customer_select: true,
      customer_insert: true,
      customer_update: false,
      customer_delete: false,
      raw_select: false,
      raw_insert: false,
      fingerprint_select: true,
      safe_insert_execute: true,
      public_insert_execute: false,
      safe_lock_execute: true,
      public_lock_execute: false,
      public_receipt_integrity_execute: false,
      tag_update: false,
      tag_delete: false,
      receipt_select: true,
      receipt_insert: true,
      receipt_update: false,
      receipt_delete: false,
    });

    await expect(withAdminSetupContext(runtimePool, 'adminA', async (client) => (
      postgresErrorCode(client.query('SELECT payload_value FROM taptime_server.nfc_tags'))
    ))).resolves.toBe('42501');
  });

  it('separates authority/audit ownership from exact data-capability ownership', async () => {
    const owned = await installerPool.query<{
      owner: string;
      functions: string[];
      relations: string;
    }>(`
      SELECT
        requested_owner.owner,
        COALESCE(pg_catalog.jsonb_agg(
          procedure.proname ORDER BY procedure.proname
        ) FILTER (WHERE namespace.oid IS NOT NULL), '[]'::jsonb) AS functions,
        (SELECT count(*)::text
         FROM pg_catalog.pg_class AS relation
         JOIN pg_catalog.pg_roles AS relation_owner ON relation_owner.oid = relation.relowner
         WHERE relation_owner.rolname = requested_owner.owner) AS relations
      FROM unnest(ARRAY[
        'taptime_admin_setup_function_owner',
        'taptime_admin_setup_data_function_owner'
      ]) AS requested_owner(owner)
      LEFT JOIN pg_catalog.pg_roles AS function_owner
        ON function_owner.rolname = requested_owner.owner
      LEFT JOIN pg_catalog.pg_proc AS procedure
        ON procedure.proowner = function_owner.oid
      LEFT JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
       AND namespace.nspname = '${B3_SCHEMA}'
      GROUP BY requested_owner.owner
      ORDER BY requested_owner.owner
    `);
    expect(owned.rows).toEqual([
      {
        owner: 'taptime_admin_setup_data_function_owner',
        functions: [
          'enforce_admin_setup_receipt_integrity',
          'insert_admin_setup_nfc_tag_v1',
          'lock_admin_setup_active_customer_v1',
        ],
        relations: '0',
      },
      {
        owner: 'taptime_admin_setup_function_owner',
        functions: ['append_administrative_audit_event', 'has_current_admin_setup_authority'],
        relations: '0',
      },
    ]);

    const grants = await installerPool.query<{ table_name: string; privilege_type: string }>(`
      SELECT table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee = 'taptime_admin_setup_function_owner'
      ORDER BY table_name, privilege_type
    `);
    expect(grants.rows).toEqual([
      { table_name: 'audit_events', privilege_type: 'INSERT' },
      { table_name: 'memberships', privilege_type: 'SELECT' },
    ]);

    const tagColumns = await installerPool.query<{
      column_name: string;
      privilege_type: string;
    }>(`
      SELECT column_name, privilege_type
      FROM information_schema.role_column_grants
      WHERE grantee = 'taptime_admin_setup_data_function_owner'
        AND table_schema = '${B3_SCHEMA}'
        AND table_name = 'nfc_tags'
      ORDER BY privilege_type, column_name
    `);
    expect(tagColumns.rows).toEqual([
      { column_name: 'display_name', privilege_type: 'INSERT' },
      { column_name: 'id', privilege_type: 'INSERT' },
      { column_name: 'organization_id', privilege_type: 'INSERT' },
      { column_name: 'payload_value', privilege_type: 'INSERT' },
      { column_name: 'display_name', privilege_type: 'SELECT' },
      { column_name: 'id', privilege_type: 'SELECT' },
      { column_name: 'organization_id', privilege_type: 'SELECT' },
      { column_name: 'payload_value', privilege_type: 'SELECT' },
      { column_name: 'validation_fingerprint', privilege_type: 'SELECT' },
    ]);

    const customerColumns = await installerPool.query<{
      column_name: string;
      privilege_type: string;
    }>(`
      SELECT column_name, privilege_type
      FROM information_schema.role_column_grants
      WHERE grantee = 'taptime_admin_setup_data_function_owner'
        AND table_schema = '${B3_SCHEMA}'
        AND table_name = 'customers'
      ORDER BY privilege_type, column_name
    `);
    expect(customerColumns.rows).toEqual([
      { column_name: 'active', privilege_type: 'SELECT' },
      { column_name: 'display_name', privilege_type: 'SELECT' },
      { column_name: 'id', privilege_type: 'SELECT' },
      { column_name: 'organization_id', privilege_type: 'SELECT' },
      { column_name: 'active', privilege_type: 'UPDATE' },
    ]);

    const assignmentColumns = await installerPool.query<{
      column_name: string;
      privilege_type: string;
    }>(`
      SELECT column_name, privilege_type
      FROM information_schema.role_column_grants
      WHERE grantee = 'taptime_admin_setup_data_function_owner'
        AND table_schema = '${B3_SCHEMA}'
        AND table_name = 'nfc_assignments'
      ORDER BY privilege_type, column_name
    `);
    expect(assignmentColumns.rows).toEqual([
      { column_name: 'active', privilege_type: 'SELECT' },
      { column_name: 'id', privilege_type: 'SELECT' },
      { column_name: 'nfc_tag_id', privilege_type: 'SELECT' },
      { column_name: 'organization_id', privilege_type: 'SELECT' },
      { column_name: 'target_customer_id', privilege_type: 'SELECT' },
      { column_name: 'target_type', privilege_type: 'SELECT' },
    ]);

    const auditColumns = await installerPool.query<{
      column_name: string;
      privilege_type: string;
    }>(`
      SELECT column_name, privilege_type
      FROM information_schema.role_column_grants
      WHERE grantee = 'taptime_admin_setup_data_function_owner'
        AND table_schema = '${B3_SCHEMA}'
        AND table_name = 'audit_events'
      ORDER BY privilege_type, column_name
    `);
    expect(auditColumns.rows).toEqual([
      { column_name: 'actor_user_id', privilege_type: 'SELECT' },
      { column_name: 'correlation_id', privilege_type: 'SELECT' },
      { column_name: 'entity_id', privilege_type: 'SELECT' },
      { column_name: 'entity_type', privilege_type: 'SELECT' },
      { column_name: 'event_type', privilege_type: 'SELECT' },
      { column_name: 'operator_principal', privilege_type: 'SELECT' },
      { column_name: 'organization_id', privilege_type: 'SELECT' },
      { column_name: 'payload', privilege_type: 'SELECT' },
    ]);

  });

  it('keeps the success receipt FORCE-RLS, append-only and free of raw request fields', async () => {
    const relation = await installerPool.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_catalog.pg_class
      WHERE oid = '${B3_SCHEMA}.admin_setup_command_receipts'::regclass
    `);
    expect(relation.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });

    const columns = await installerPool.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = '${B3_SCHEMA}'
        AND table_name = 'admin_setup_command_receipts'
      ORDER BY ordinal_position
    `);
    expect(columns.rows.map(({ column_name }) => column_name)).toEqual([
      'organization_id', 'command_id', 'actor_user_id', 'membership_id',
      'command_type', 'request_hash_version', 'request_hash', 'result_status',
      'result_customer_id', 'result_nfc_tag_id', 'result_nfc_assignment_id', 'created_at',
    ]);
    expect(columns.rows.map(({ column_name }) => column_name).join(' ')).not.toMatch(
      /token|issuer|subject|payload_value|display_name|email/i,
    );

    await expect(withAdminSetupContext(runtimePool, 'adminA', async (client) => (
      postgresErrorCode(client.query(
        `UPDATE taptime_server.customers
         SET display_name = 'Forbidden Update' WHERE id = $1`,
        [ids.customerA],
      ))
    ))).resolves.toBe('42501');
    await expect(withAdminSetupContext(runtimePool, 'adminA', async (client) => (
      postgresErrorCode(client.query(
        `DELETE FROM taptime_server.nfc_assignments WHERE id = $1`,
        [ids.assignmentA],
      ))
    ))).resolves.toBe('42501');
  });

  it('matches the shared name and digest contracts in SQL and rejects noncanonical direct rows', async () => {
    const result = await installerPool.query<{
      canonical_name: string;
      canonical_organization_name: string;
      invalid_name: string | null;
      null_kind_name: string | null;
      customer_hash: string;
      tag_hash: string;
    }>(`
      SELECT
        taptime_server.normalize_taptime_name_v1('  Cafe\u0301  ', 'customer') AS canonical_name,
        taptime_server.normalize_taptime_name_v1(
          '  TapTim.e GmbH  ', 'organization'
        ) AS canonical_organization_name,
        taptime_server.normalize_taptime_name_v1('A' || U&'\\200D' || 'B', 'customer') AS invalid_name,
        taptime_server.normalize_taptime_name_v1('Fail Closed', NULL) AS null_kind_name,
        encode(taptime_server.admin_create_customer_digest_v1($1, $2, $3, 'Café'), 'hex') AS customer_hash,
        encode(taptime_server.admin_provision_nfc_tag_digest_v1(
          $1, $2, $3, $4, 'Warehouse Tag', 'nfc:uid:v1:CC'
        ), 'hex') AS tag_hash
    `, [ids.organizationA, ids.adminA, ids.membershipAdminA, ids.customerA]);
    expect(normalizeOrganizationNameV1('  TapTim.e GmbH  ')).toEqual({
      status: 'valid',
      canonicalName: 'TapTim.e GmbH',
    });
    expect(result.rows[0]).toEqual({
      canonical_name: 'Café',
      canonical_organization_name: 'TapTim.e GmbH',
      invalid_name: null,
      null_kind_name: null,
      customer_hash: createCustomerCommandDigestV1(
        ids.organizationA,
        ids.adminA,
        ids.membershipAdminA,
        'Café',
      ),
      tag_hash: provisionNfcTagCommandDigestV1(
        ids.organizationA,
        ids.adminA,
        ids.membershipAdminA,
        ids.customerA,
        'Warehouse Tag',
        'nfc:uid:v1:CC',
      ),
    });

    await expect(withAdminSetupContext(runtimePool, 'adminA', async (client) => (
      postgresErrorCode(client.query(
        `INSERT INTO taptime_server.customers (id, organization_id, display_name, active)
         VALUES ('90000000-0000-4000-8000-000000000001', $1, '  Not Canonical  ', true)`,
        [ids.organizationA],
      ))
    ))).resolves.toBe('23514');
    await expect(withAdminSetupContext(runtimePool, 'adminA', async (client) => (
      postgresErrorCode(client.query(
        `SELECT * FROM taptime_server.insert_admin_setup_nfc_tag_v1(
          '90000000-0000-4000-8000-000000000002', $1, 'Invalid Tag', 'nfc:uid:v1:cc'
        )`,
        [ids.organizationA],
      ))
    ))).resolves.toBe('42501');

    const administrator = await installerPool.connect();
    try {
      await administrator.query('BEGIN');
      await administrator.query(
        `SELECT
           set_config('app.user_id', $1, true),
           set_config('app.organization_id', $2, true),
           set_config('app.membership_id', $3, true),
           set_config('app.membership_role', 'administrator', true),
           set_config('app.correlation_id', $4, true)`,
        [ids.adminA, ids.organizationA, ids.membershipAdminA, commandIds.create],
      );
      await administrator.query('SET LOCAL ROLE taptime_administrator');
      await expect(postgresErrorCode(administrator.query(
        `UPDATE taptime_server.organizations
         SET name = '  Not Canonical  '
         WHERE id = $1`,
        [ids.organizationA],
      ))).resolves.toBe('23514');
    } finally {
      await administrator.query('ROLLBACK').catch(() => undefined);
      administrator.release();
    }
  });

  it('enforces the exact SQL scalar boundaries for Customer and Tag display names', async () => {
    const result = await installerPool.query<{
      customer_at_limit: number;
      customer_over_limit: boolean;
      tag_at_limit: number;
      tag_over_limit: boolean;
    }>(`
      SELECT
        char_length(taptime_server.normalize_taptime_name_v1(repeat('C', 120), 'customer'))
          AS customer_at_limit,
        taptime_server.normalize_taptime_name_v1(repeat('C', 121), 'customer') IS NULL
          AS customer_over_limit,
        char_length(taptime_server.normalize_taptime_name_v1(repeat('T', 80), 'tag'))
          AS tag_at_limit,
        taptime_server.normalize_taptime_name_v1(repeat('T', 81), 'tag') IS NULL
          AS tag_over_limit
    `);
    expect(result.rows).toEqual([{
      customer_at_limit: 120,
      customer_over_limit: true,
      tag_at_limit: 80,
      tag_over_limit: true,
    }]);
  });

  it('shows zero setup rows and denies writes when derived context is absent', async () => {
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE taptime_admin_setup');
      await expect(client.query('SELECT id FROM taptime_server.customers')).resolves.toMatchObject({
        rows: [],
      });
      await expect(postgresErrorCode(client.query(
        `INSERT INTO taptime_server.customers (id, organization_id, display_name, active)
         VALUES ('90000000-0000-4000-8000-000000000003', $1, 'No Context', true)`,
        [ids.organizationA],
      ))).resolves.toBe('42501');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('rejects safe data capabilities for an Organization outside derived authority', async () => {
    await expect(withAdminSetupContext(runtimePool, 'adminA', async (client) => (
      postgresErrorCode(client.query(
        `SELECT * FROM taptime_server.insert_admin_setup_nfc_tag_v1(
          '90000000-0000-4000-8000-000000000004', $1, 'Cross Tenant Tag', 'nfc:uid:v1:CC'
        )`,
        [ids.organizationB],
      ))
    ))).resolves.toBe('42501');
    await expect(withAdminSetupContext(runtimePool, 'adminA', async (client) => (
      postgresErrorCode(client.query(
        'SELECT * FROM taptime_server.lock_admin_setup_active_customer_v1($1, $2)',
        [ids.organizationB, ids.customerB],
      ))
    ))).resolves.toBe('42501');
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });
});

describe('authority derivation and Customer commands', () => {
  it.each([
    [{ accessToken: '' }, 'empty token'],
    [{ commandId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }, 'noncanonical command UUID'],
    [{ expectedMembershipId: MembershipId('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA') }, 'noncanonical Membership UUID'],
    [{ displayName: 'A\u200DB' }, 'prohibited display name'],
  ] as const)('rejects invalid Customer input %# before any write', async (overrides, _case) => {
    await expect(coordinator.createCustomer(customerCommand(overrides))).resolves.toEqual({
      status: 'invalid_request',
    });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it.each([
    ['rejected token', fixtureTokens.rejected, membershipIds.adminA, 'unauthorized'],
    ['verified identity without Membership', fixtureTokens.orphan, membershipIds.adminA, 'unauthorized'],
    ['Employee Membership', fixtureTokens.employeeA, membershipIds.employeeA, 'forbidden'],
    ['stale expected Membership', fixtureTokens.adminA, membershipIds.employeeA, 'forbidden'],
    ['cross-tenant expected Membership', fixtureTokens.adminB, membershipIds.adminA, 'forbidden'],
  ] as const)('rejects %s without writes', async (_case, accessToken, expectedMembershipId, status) => {
    await expect(coordinator.createCustomer(customerCommand({
      accessToken,
      expectedMembershipId,
    }))).resolves.toEqual({ status });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it('creates one canonical Customer, one success receipt and one safe audit event', async () => {
    const result = await coordinator.createCustomer(customerCommand({ displayName: '  Cafe\u0301 Nord  ' }));
    expect(result).toMatchObject({
      status: 'succeeded',
      idempotentRetry: false,
      customer: { displayName: 'Café Nord', active: true },
    });
    if (result.status !== 'succeeded') {
      throw new Error('Expected a successful Customer result');
    }

    const customer = await installerPool.query(
      `SELECT id, organization_id, display_name, active
       FROM taptime_server.customers WHERE id = $1`,
      [result.customer.id],
    );
    expect(customer.rows).toEqual([{
      id: result.customer.id,
      organization_id: ids.organizationA,
      display_name: 'Café Nord',
      active: true,
    }]);

    const receipt = await installerPool.query(`
      SELECT organization_id, command_id, actor_user_id, membership_id, command_type,
        request_hash_version, encode(request_hash, 'hex') AS request_hash,
        result_status, result_customer_id, result_nfc_tag_id, result_nfc_assignment_id
      FROM taptime_server.admin_setup_command_receipts
    `);
    expect(receipt.rows).toEqual([{
      organization_id: ids.organizationA,
      command_id: commandIds.create,
      actor_user_id: ids.adminA,
      membership_id: ids.membershipAdminA,
      command_type: 'createCustomer',
      request_hash_version: 1,
      request_hash: createCustomerCommandDigestV1(
        ids.organizationA,
        ids.adminA,
        ids.membershipAdminA,
        'Café Nord',
      ),
      result_status: 'succeeded',
      result_customer_id: result.customer.id,
      result_nfc_tag_id: null,
      result_nfc_assignment_id: null,
    }]);
    expect(JSON.stringify(receipt.rows)).not.toContain('Café Nord');
    expect(JSON.stringify(receipt.rows)).not.toContain(fixtureTokens.adminA);

    const audit = await installerPool.query(`
      SELECT organization_id, actor_user_id, operator_principal, event_type,
        entity_type, entity_id, correlation_id, payload
      FROM taptime_server.audit_events
    `);
    expect(audit.rows).toEqual([{
      organization_id: ids.organizationA,
      actor_user_id: ids.adminA,
      operator_principal: null,
      event_type: 'CustomerCreated',
      entity_type: 'Customer',
      entity_id: result.customer.id,
      correlation_id: commandIds.create,
      payload: {},
    }]);
  });

  it('returns the original Customer for an exact retry and conflicts on divergence', async () => {
    const first = await coordinator.createCustomer(customerCommand());
    const retry = await coordinator.createCustomer(customerCommand());
    const conflict = await coordinator.createCustomer(customerCommand({ displayName: 'Different Name' }));

    expect(first).toMatchObject({ status: 'succeeded', idempotentRetry: false });
    expect(retry).toEqual({
      ...first,
      idempotentRetry: true,
    });
    expect(conflict).toEqual({ status: 'command_id_conflict' });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 1,
      audits: 1,
      receipts: 1,
    });
  });

  it('replays the stored Customer success after that Customer is later deactivated', async () => {
    const first = await coordinator.createCustomer(customerCommand());
    if (first.status !== 'succeeded') {
      throw new Error('Expected initial Customer creation to succeed');
    }
    await installerPool.query(
      `UPDATE taptime_server.customers
       SET active = false,
           deactivated_at = transaction_timestamp(),
           row_version = row_version + 1
       WHERE id = $1`,
      [first.customer.id],
    );

    await expect(coordinator.createCustomer(customerCommand())).resolves.toEqual({
      ...first,
      idempotentRetry: true,
    });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 1,
      audits: 1,
      receipts: 1,
    });
  });

  it('serializes concurrent exact retries into one write and one retry', async () => {
    const results = await Promise.all([
      coordinator.createCustomer(customerCommand()),
      coordinator.createCustomer(customerCommand()),
    ]);
    expect(results.map((result) => (
      result.status === 'succeeded' ? result.idempotentRetry : result.status
    )).sort()).toEqual([false, true]);
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 1,
      audits: 1,
      receipts: 1,
    });
  });

  it('allows duplicate Customer display names under distinct command IDs', async () => {
    const results = await Promise.all([
      coordinator.createCustomer(customerCommand({ displayName: 'Shared Customer Name' })),
      coordinator.createCustomer(customerCommand({
        commandId: commandIds.createSecond,
        displayName: 'Shared Customer Name',
      })),
    ]);
    expect(results).toHaveLength(2);
    expect(results.every((result) => (
      result.status === 'succeeded' && result.idempotentRetry === false
    ))).toBe(true);
    const createdIds = results.flatMap((result) => (
      result.status === 'succeeded' ? [result.customer.id] : []
    ));
    expect(new Set(createdIds).size).toBe(2);
    const duplicates = await installerPool.query<{
      id: string;
      display_name: string;
    }>(`
      SELECT id, display_name
      FROM taptime_server.customers
      WHERE organization_id = $1 AND display_name = 'Shared Customer Name'
      ORDER BY id
    `, [ids.organizationA]);
    expect(duplicates.rows).toHaveLength(2);
    expect(duplicates.rows.every(({ display_name }) => display_name === 'Shared Customer Name')).toBe(true);
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 2,
      audits: 2,
      receipts: 2,
    });
  });

  it('names command receipts independently per Organization', async () => {
    const results = await Promise.all([
      coordinator.createCustomer(customerCommand({ displayName: 'Organization A Customer' })),
      coordinator.createCustomer(customerCommand({
        accessToken: fixtureTokens.adminB,
        expectedMembershipId: membershipIds.adminB,
        displayName: 'Organization B Customer',
      })),
    ]);
    expect(results.every((result) => (
      result.status === 'succeeded' && result.idempotentRetry === false
    ))).toBe(true);
    const receipts = await installerPool.query<{
      organization_id: string;
      command_id: string;
      command_type: string;
      result_status: string;
    }>(`
      SELECT organization_id, command_id, command_type, result_status
      FROM taptime_server.admin_setup_command_receipts
      WHERE command_id = $1
      ORDER BY organization_id
    `, [commandIds.create]);
    expect(receipts.rows).toEqual([
      {
        organization_id: ids.organizationA,
        command_id: commandIds.create,
        command_type: 'createCustomer',
        result_status: 'succeeded',
      },
      {
        organization_id: ids.organizationB,
        command_id: commandIds.create,
        command_type: 'createCustomer',
        result_status: 'succeeded',
      },
    ]);
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 2,
      audits: 2,
      receipts: 2,
    });
  });

  it('re-reads an exact externally committed Customer receipt and rolls its local attempt back', async () => {
    const requestHash = createCustomerCommandDigestV1(
      ids.organizationA,
      ids.adminA,
      ids.membershipAdminA,
      'New Customer',
    );
    const result = await coordinator.createCustomer(customerCommand(), {
      afterWrite: async (stage) => {
        if (stage === 'customer_and_audit') {
          await commitAdversarialCustomerReceipt({
            displayName: 'New Customer',
            requestHash,
          });
        }
      },
    });
    expect(result).toEqual({
      status: 'succeeded',
      idempotentRetry: true,
      customer: {
        id: ids.adversarialCustomerA,
        displayName: 'New Customer',
        active: true,
      },
    });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 1,
      audits: 1,
      receipts: 1,
    });
    const namedCustomers = await installerPool.query<{ id: string }>(`
      SELECT id FROM taptime_server.customers WHERE display_name = 'New Customer'
    `);
    expect(namedCustomers.rows).toEqual([{ id: ids.adversarialCustomerA }]);
  });

  it('rejects an exact Customer receipt whose result resource does not match its digest', async () => {
    const requestHash = createCustomerCommandDigestV1(
      ids.organizationA,
      ids.adminA,
      ids.membershipAdminA,
      'New Customer',
    );
    await expect(postgresErrorCode(commitAdversarialCustomerReceipt({
      displayName: 'Mismatched Customer',
      requestHash,
    }))).resolves.toBe('23514');
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it('maps a divergent externally committed Customer receipt to conflict and rolls back locally', async () => {
    const divergentHash = createCustomerCommandDigestV1(
      ids.organizationA,
      ids.adminA,
      ids.membershipAdminA,
      'Externally Committed Customer',
    );
    const result = await coordinator.createCustomer(customerCommand(), {
      afterWrite: async (stage) => {
        if (stage === 'customer_and_audit') {
          await commitAdversarialCustomerReceipt({
            displayName: 'Externally Committed Customer',
            requestHash: divergentHash,
          });
        }
      },
    });
    expect(result).toEqual({ status: 'command_id_conflict' });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 1,
      audits: 1,
      receipts: 1,
    });
    const localRows = await installerPool.query<{ count: number }>(`
      SELECT count(*)::integer AS count
      FROM taptime_server.customers WHERE display_name = 'New Customer'
    `);
    expect(localRows.rows[0]).toEqual({ count: 0 });
  });

  it('serializes the same Organization command ID across two Administrators', async () => {
    const results = await Promise.all([
      coordinator.createCustomer(customerCommand()),
      coordinator.createCustomer(customerCommand({
        accessToken: fixtureTokens.adminA2,
        expectedMembershipId: membershipIds.adminA2,
      })),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([
      'command_id_conflict', 'succeeded',
    ]);
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 1,
      audits: 1,
      receipts: 1,
    });
  });

  it('holds the resolved Membership lock through commit and rejects it after revocation', async () => {
    let revocationWhileLockedCode: string | undefined;
    await expect(coordinator.createCustomer(customerCommand(), {
      afterAuthorityLocked: async () => {
        const revoker = await installerPool.connect();
        try {
          await revoker.query('BEGIN');
          await revoker.query("SET LOCAL statement_timeout = '100ms'");
          revocationWhileLockedCode = await postgresErrorCode(revoker.query(
            `UPDATE taptime_server.memberships
             SET revoked_at = '2026-07-14T00:00:00Z', row_version = row_version + 1
             WHERE id = $1`,
            [ids.membershipAdminA],
          ));
          await revoker.query('ROLLBACK');
        } finally {
          revoker.release();
        }
      },
    })).resolves.toMatchObject({ status: 'succeeded' });
    expect(revocationWhileLockedCode).toBe('57014');

    await installerPool.query(
      `UPDATE taptime_server.memberships
       SET revoked_at = '2026-07-14T00:00:00Z', row_version = row_version + 1
       WHERE id = $1`,
      [ids.membershipAdminA],
    );
    await expect(coordinator.createCustomer(customerCommand({
      commandId: commandIds.createSecond,
    }))).resolves.toEqual({ status: 'unauthorized' });
  });
});

describe('NFC provisioning, failure precedence and atomic rollback', () => {
  it.each([
    [{ canonicalPayload: 'nfc:uid:v1:cc' }, 'noncanonical NFC payload'],
    [{ canonicalPayload: 'nfc:uid:v1:' }, 'empty NFC UID'],
    [{ canonicalPayload: undefined as unknown as string }, 'missing NFC payload'],
    [{ canonicalPayload: 42 as unknown as string }, 'non-string NFC payload'],
    [{ customerId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }, 'noncanonical Customer UUID'],
    [{ displayName: 'A\u200DB' }, 'prohibited display name'],
  ] as const)('rejects invalid provisioning input %# before any write', async (overrides, _case) => {
    await expect(coordinator.provisionNfcTag(provisionCommand(
      overrides as Partial<ProvisionNfcTagCommand>,
    ))).resolves.toEqual({ status: 'invalid_request' });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it('provisions one Tag and Assignment with two safe audits and a success receipt', async () => {
    const result = await coordinator.provisionNfcTag(provisionCommand());
    const fingerprint = fingerprintFor('nfc:uid:v1:CC');
    expect(result).toMatchObject({
      status: 'succeeded',
      idempotentRetry: false,
      nfcTag: {
        displayName: 'Warehouse Tag',
        validationFingerprint: fingerprint,
        assignmentState: 'assigned',
        targetCustomerId: ids.customerA,
      },
    });
    if (result.status !== 'succeeded') {
      throw new Error('Expected a successful Tag result');
    }

    const stored = await installerPool.query(`
      SELECT tag.id, tag.organization_id, tag.display_name, tag.payload_value,
        tag.validation_fingerprint, assignment.id AS assignment_id,
        assignment.target_customer_id
      FROM taptime_server.nfc_tags AS tag
      JOIN taptime_server.nfc_assignments AS assignment
        ON assignment.organization_id = tag.organization_id
       AND assignment.nfc_tag_id = tag.id
      WHERE tag.id = $1
    `, [result.nfcTag.id]);
    expect(stored.rows).toEqual([{
      id: result.nfcTag.id,
      organization_id: ids.organizationA,
      display_name: 'Warehouse Tag',
      payload_value: 'nfc:uid:v1:CC',
      validation_fingerprint: fingerprint,
      assignment_id: result.assignmentId,
      target_customer_id: ids.customerA,
    }]);

    const receipt = await installerPool.query(`
      SELECT command_type, encode(request_hash, 'hex') AS request_hash,
        result_customer_id, result_nfc_tag_id, result_nfc_assignment_id
      FROM taptime_server.admin_setup_command_receipts
    `);
    expect(receipt.rows).toEqual([{
      command_type: 'provisionNfcTag',
      request_hash: provisionNfcTagCommandDigestV1(
        ids.organizationA,
        ids.adminA,
        ids.membershipAdminA,
        ids.customerA,
        'Warehouse Tag',
        'nfc:uid:v1:CC',
      ),
      result_customer_id: null,
      result_nfc_tag_id: result.nfcTag.id,
      result_nfc_assignment_id: result.assignmentId,
    }]);
    expect(JSON.stringify(receipt.rows)).not.toContain('nfc:uid:v1:CC');

    const audits = await installerPool.query(`
      SELECT actor_user_id, operator_principal, event_type, entity_type,
        correlation_id, payload
      FROM taptime_server.audit_events
      ORDER BY event_type
    `);
    expect(audits.rows).toEqual([
      {
        actor_user_id: ids.adminA,
        operator_principal: null,
        event_type: 'NfcTagAssigned',
        entity_type: 'NfcAssignment',
        correlation_id: commandIds.provision,
        payload: {},
      },
      {
        actor_user_id: ids.adminA,
        operator_principal: null,
        event_type: 'NfcTagRegistered',
        entity_type: 'NfcTag',
        correlation_id: commandIds.provision,
        payload: {},
      },
    ]);
    expect(JSON.stringify(audits.rows)).not.toContain('nfc:uid:v1:CC');
  });

  it('returns the original Tag for an exact retry and conflicts on changed data', async () => {
    const first = await coordinator.provisionNfcTag(provisionCommand());
    const retry = await coordinator.provisionNfcTag(provisionCommand());
    const conflict = await coordinator.provisionNfcTag(provisionCommand({
      displayName: 'Changed Tag Name',
    }));
    expect(first).toMatchObject({ status: 'succeeded', idempotentRetry: false });
    expect(retry).toEqual({ ...first, idempotentRetry: true });
    expect(conflict).toEqual({ status: 'command_id_conflict' });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      tags: baselineCounts.tags + 1,
      assignments: baselineCounts.assignments + 1,
      audits: 2,
      receipts: 1,
    });
  });

  it('replays the stored Tag success after its Assignment and target are later inactive', async () => {
    const first = await coordinator.provisionNfcTag(provisionCommand());
    if (first.status !== 'succeeded') {
      throw new Error('Expected initial Tag provisioning to succeed');
    }
    const installer = await installerPool.connect();
    try {
      await installer.query('BEGIN');
      await installer.query(
        `UPDATE taptime_server.nfc_assignments
         SET active = false,
             valid_to = transaction_timestamp(),
             row_version = row_version + 1
         WHERE id = $1`,
        [first.assignmentId],
      );
      await installer.query(
        `UPDATE taptime_server.customers
         SET active = false,
             deactivated_at = transaction_timestamp(),
             row_version = row_version + 1
         WHERE id = $1`,
        [ids.customerA],
      );
      await installer.query('COMMIT');
    } catch (error) {
      await installer.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      installer.release();
    }

    await expect(coordinator.provisionNfcTag(provisionCommand())).resolves.toEqual({
      ...first,
      idempotentRetry: true,
    });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      tags: baselineCounts.tags + 1,
      assignments: baselineCounts.assignments + 1,
      audits: 2,
      receipts: 1,
    });
  });

  it('allows duplicate Tag display names when payloads and command IDs differ', async () => {
    const results = await Promise.all([
      coordinator.provisionNfcTag(provisionCommand({ displayName: 'Shared Tag Name' })),
      coordinator.provisionNfcTag(provisionCommand({
        commandId: commandIds.provisionSecond,
        displayName: 'Shared Tag Name',
        canonicalPayload: 'nfc:uid:v1:DD',
      })),
    ]);
    expect(results.every((result) => (
      result.status === 'succeeded' && result.idempotentRetry === false
    ))).toBe(true);
    const stored = await installerPool.query<{
      display_name: string;
      payload_value: string;
    }>(`
      SELECT display_name, payload_value
      FROM taptime_server.nfc_tags
      WHERE organization_id = $1 AND display_name = 'Shared Tag Name'
      ORDER BY payload_value
    `, [ids.organizationA]);
    expect(stored.rows).toEqual([
      { display_name: 'Shared Tag Name', payload_value: 'nfc:uid:v1:CC' },
      { display_name: 'Shared Tag Name', payload_value: 'nfc:uid:v1:DD' },
    ]);
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      tags: baselineCounts.tags + 2,
      assignments: baselineCounts.assignments + 2,
      audits: 4,
      receipts: 2,
    });
  });

  it('serializes concurrent same-payload commands to one success and one safe conflict', async () => {
    const results = await Promise.all([
      coordinator.provisionNfcTag(provisionCommand({ displayName: 'Concurrent Tag Alpha' })),
      coordinator.provisionNfcTag(provisionCommand({
        commandId: commandIds.provisionSecond,
        displayName: 'Concurrent Tag Beta',
      })),
    ]);
    const succeeded = results.filter((result) => result.status === 'succeeded');
    const conflicted = results.filter((result) => result.status === 'tag_payload_already_registered');
    expect(succeeded).toHaveLength(1);
    expect(succeeded[0]).toMatchObject({ status: 'succeeded', idempotentRetry: false });
    expect(conflicted).toEqual([{ status: 'tag_payload_already_registered' }]);
    expect(JSON.stringify(conflicted)).not.toMatch(
      /nfc:uid|Concurrent Tag|23505|duplicate key|constraint|postgres|sql/i,
    );
    const persisted = await installerPool.query<{
      display_name: string;
      payload_value: string;
    }>(`
      SELECT display_name, payload_value
      FROM taptime_server.nfc_tags
      WHERE organization_id = $1 AND payload_value = 'nfc:uid:v1:CC'
    `, [ids.organizationA]);
    expect(persisted.rows).toHaveLength(1);
    expect(['Concurrent Tag Alpha', 'Concurrent Tag Beta']).toContain(
      persisted.rows[0]!.display_name,
    );
    const safeEvidence = await installerPool.query<{
      command_id: string;
      audit_payloads: unknown[];
    }>(`
      SELECT receipt.command_id,
        ARRAY(
          SELECT audit.payload
          FROM taptime_server.audit_events AS audit
          WHERE audit.correlation_id = receipt.command_id::text
          ORDER BY audit.event_type
        ) AS audit_payloads
      FROM taptime_server.admin_setup_command_receipts AS receipt
    `);
    expect(safeEvidence.rows).toEqual([{
      command_id: succeeded[0]!.status === 'succeeded'
        ? results[0] === succeeded[0] ? commandIds.provision : commandIds.provisionSecond
        : commandIds.provision,
      audit_payloads: [{}, {}],
    }]);
    expect(JSON.stringify(safeEvidence.rows)).not.toMatch(/nfc:uid|Concurrent Tag/i);
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      tags: baselineCounts.tags + 1,
      assignments: baselineCounts.assignments + 1,
      audits: 2,
      receipts: 1,
    });
  });

  it('replays an exact externally committed Tag receipt only when its resources match', async () => {
    const requestHash = provisionNfcTagCommandDigestV1(
      ids.organizationA,
      ids.adminA,
      ids.membershipAdminA,
      ids.customerA,
      'Warehouse Tag',
      'nfc:uid:v1:CC',
    );
    const result = await coordinator.provisionNfcTag(provisionCommand(), {
      afterReceiptMiss: async () => {
        await commitMatchingTagReceipt(requestHash);
      },
    });
    expect(result).toEqual({
      status: 'succeeded',
      idempotentRetry: true,
      nfcTag: {
        id: ids.adversarialTagA,
        displayName: 'Warehouse Tag',
        validationFingerprint: fingerprintFor('nfc:uid:v1:CC'),
        assignmentState: 'assigned',
        targetCustomerId: ids.customerA,
      },
      assignmentId: ids.adversarialAssignmentA,
    });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      tags: baselineCounts.tags + 1,
      assignments: baselineCounts.assignments + 1,
      audits: 2,
      receipts: 1,
    });
    const localTags = await installerPool.query<{ count: number }>(`
      SELECT count(*)::integer AS count
      FROM taptime_server.nfc_tags WHERE payload_value = 'nfc:uid:v1:CC'
    `);
    expect(localTags.rows[0]).toEqual({ count: 1 });
  });

  it('rejects an exact Tag receipt whose result resources do not match its digest', async () => {
    const requestHash = provisionNfcTagCommandDigestV1(
      ids.organizationA,
      ids.adminA,
      ids.membershipAdminA,
      ids.customerA,
      'Warehouse Tag',
      'nfc:uid:v1:CC',
    );
    await expect(postgresErrorCode(
      commitAdversarialTagReceipt(requestHash),
    )).resolves.toBe('23514');
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it('maps a divergent externally committed Tag receipt to conflict and rolls back locally', async () => {
    const divergentHash = provisionNfcTagCommandDigestV1(
      ids.organizationA,
      ids.adminA,
      ids.membershipAdminA,
      ids.customerA,
      'Different External Tag',
      'nfc:uid:v1:DD',
    );
    const result = await coordinator.provisionNfcTag(provisionCommand(), {
      afterReceiptMiss: async () => {
        await commitMatchingDivergentTagReceipt(divergentHash);
      },
    });
    expect(result).toEqual({ status: 'command_id_conflict' });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      tags: baselineCounts.tags + 1,
      assignments: baselineCounts.assignments + 1,
      audits: 2,
      receipts: 1,
    });
    const localTags = await installerPool.query<{ count: number }>(`
      SELECT count(*)::integer AS count
      FROM taptime_server.nfc_tags WHERE payload_value = 'nfc:uid:v1:CC'
    `);
    expect(localTags.rows[0]).toEqual({ count: 0 });
  });

  it('conflicts when a command ID is reused across command types', async () => {
    await expect(coordinator.createCustomer(customerCommand({
      commandId: commandIds.provision,
    }))).resolves.toMatchObject({ status: 'succeeded' });
    await expect(coordinator.provisionNfcTag(provisionCommand())).resolves.toEqual({
      status: 'command_id_conflict',
    });
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      customers: baselineCounts.customers + 1,
      audits: 1,
      receipts: 1,
    });
  });

  it('checks same-tenant payload conflict before an unavailable target and rolls back cleanly', async () => {
    await expect(coordinator.provisionNfcTag(provisionCommand({
      customerId: customerIds.customerB,
      canonicalPayload: 'nfc:uid:v1:AA',
    }))).resolves.toEqual({ status: 'tag_payload_already_registered' });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it.each([
    ['missing', '90000000-0000-4000-8000-000000000099'],
    ['inactive', ids.inactiveCustomerA],
    ['cross-tenant', ids.customerB],
  ] as const)('maps a %s target to one neutral rejection with no partial rows', async (_case, customerId) => {
    await expect(coordinator.provisionNfcTag(provisionCommand({
      customerId: customerId as ProvisionNfcTagCommand['customerId'],
    }))).resolves.toEqual({ status: 'assignment_target_unavailable' });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it('rolls back its Tag and audit when the target is deactivated before the Customer lock', async () => {
    const result = await coordinator.provisionNfcTag(provisionCommand(), {
      afterWrite: async (stage) => {
        if (stage === 'nfc_tag_and_audit') {
          await installerPool.query(
            `UPDATE taptime_server.customers
             SET active = false,
               deactivated_at = '2026-07-15T00:00:00Z',
               row_version = row_version + 1
             WHERE id = $1`,
            [ids.customerA],
          );
        }
      },
    });
    expect(result).toEqual({ status: 'assignment_target_unavailable' });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
    const state = await installerPool.query<{ active: boolean; deactivated_at: Date | null }>(
      `SELECT active, deactivated_at
       FROM taptime_server.customers WHERE id = $1`,
      [ids.customerA],
    );
    expect(state.rows[0]).toMatchObject({ active: false });
    const leakedRows = await installerPool.query<{ tags: number; audits: number; receipts: number }>(`
      SELECT
        (SELECT count(*)::integer FROM taptime_server.nfc_tags
          WHERE payload_value = 'nfc:uid:v1:CC') AS tags,
        (SELECT count(*)::integer FROM taptime_server.audit_events
          WHERE correlation_id = $1) AS audits,
        (SELECT count(*)::integer FROM taptime_server.admin_setup_command_receipts
          WHERE command_id = $2) AS receipts
    `, [commandIds.provision, commandIds.provision]);
    expect(leakedRows.rows).toEqual([{ tags: 0, audits: 0, receipts: 0 }]);
  });

  it('holds the active Customer FOR SHARE lock through assignment commit', async () => {
    let deactivationWhileLockedCode: string | undefined;
    const result = await coordinator.provisionNfcTag(provisionCommand(), {
      afterWrite: async (stage) => {
        if (stage !== 'nfc_assignment_and_audit') {
          return;
        }
        const deactivator = await installerPool.connect();
        try {
          await deactivator.query('BEGIN');
          await deactivator.query("SET LOCAL statement_timeout = '100ms'");
          deactivationWhileLockedCode = await postgresErrorCode(deactivator.query(
            `UPDATE taptime_server.customers
             SET active = false,
               deactivated_at = '2026-07-15T00:00:00Z',
               row_version = row_version + 1
             WHERE id = $1`,
            [ids.customerA],
          ));
          await deactivator.query('ROLLBACK');
        } finally {
          await deactivator.query('ROLLBACK').catch(() => undefined);
          deactivator.release();
        }
      },
    });
    expect(deactivationWhileLockedCode).toBe('57014');
    expect(result).toMatchObject({ status: 'succeeded', idempotentRetry: false });
    const target = await installerPool.query<{ active: boolean }>(
      'SELECT active FROM taptime_server.customers WHERE id = $1',
      [ids.customerA],
    );
    expect(target.rows).toEqual([{ active: true }]);
    await expect(tableCounts()).resolves.toEqual({
      ...baselineCounts,
      tags: baselineCounts.tags + 1,
      assignments: baselineCounts.assignments + 1,
      audits: 2,
      receipts: 1,
    });
  });

  it('allows the same canonical payload in another Organization', async () => {
    const result = await coordinator.provisionNfcTag(provisionCommand({
      accessToken: fixtureTokens.adminB,
      expectedMembershipId: membershipIds.adminB,
      customerId: customerIds.customerB,
      canonicalPayload: 'nfc:uid:v1:AA',
    }));
    expect(result).toMatchObject({
      status: 'succeeded',
      nfcTag: { targetCustomerId: ids.customerB },
    });
    const organizations = await installerPool.query<{ organization_id: string }>(`
      SELECT organization_id FROM taptime_server.nfc_tags
      WHERE payload_value = 'nfc:uid:v1:AA'
      ORDER BY organization_id
    `);
    expect(organizations.rows).toEqual([
      { organization_id: ids.organizationA },
      { organization_id: ids.organizationB },
    ]);
  });

  it.each([
    'customer_and_audit',
    'receipt',
  ] as const)('rolls a Customer command back after injected %s failure', async (stage) => {
    await expect(coordinator.createCustomer(customerCommand(), {
      afterWrite: (observed) => {
        if (observed === stage) {
          throw new InjectedC3CFailure(observed);
        }
      },
    })).rejects.toMatchObject({ name: 'InjectedC3CFailure', stage });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it.each([
    'nfc_tag_and_audit',
    'nfc_assignment_and_audit',
    'receipt',
  ] as const)('rolls provisioning back after injected %s failure', async (stage) => {
    await expect(coordinator.provisionNfcTag(provisionCommand(), {
      afterWrite: (observed) => {
        if (observed === stage) {
          throw new InjectedC3CFailure(observed);
        }
      },
    })).rejects.toMatchObject({ name: 'InjectedC3CFailure', stage });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it('enforces the propagated deadline after a write and leaves no partial state', async () => {
    await expect(coordinator.createCustomer(customerCommand(), {
      deadlineEpochMilliseconds: Date.now() + 350,
      afterWrite: async (stage) => {
        if (stage === 'customer_and_audit') {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      },
    })).rejects.toSatisfy((error: unknown) => (
      error instanceof C3CDeadlineExceededError
      || (error instanceof Error && 'code' in error)
    ));
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
    await expect(runtimePool.query('SELECT 1 AS healthy')).resolves.toMatchObject({
      rows: [{ healthy: 1 }],
    });
  });
});

describe('setup projection, paging, isolation and session cleanup', () => {
  it.each([
    [fixtureTokens.orphan, membershipIds.adminA, 'unauthorized'],
    [fixtureTokens.employeeA, membershipIds.employeeA, 'forbidden'],
    [fixtureTokens.adminA, membershipIds.adminA2, 'forbidden'],
  ] as const)('does not expose projection data without exact Administrator authority %#', async (
    accessToken,
    expectedMembershipId,
    status,
  ) => {
    await expect(coordinator.readSetupProjection(projectionCommand({
      accessToken,
      expectedMembershipId,
    }))).resolves.toEqual({ status });
  });

  it('pages globally by Customer then Tag without exposing raw payloads', async () => {
    const first = await coordinator.readSetupProjection(projectionCommand({ limit: 2 }));
    expect(first).toEqual({
      status: 'succeeded',
      organization: { id: ids.organizationA, name: 'Synthetic Organization A' },
      customers: [
        { id: ids.customerA, displayName: 'Active Customer A', active: true },
        { id: ids.inactiveCustomerA, displayName: 'Inactive Customer A', active: false },
      ],
      nfcTags: [],
      nextCursor: `v1:c:${ids.inactiveCustomerA}`,
    });
    if (first.status !== 'succeeded') {
      throw new Error('Expected a successful first projection page');
    }
    const second = await coordinator.readSetupProjection(projectionCommand({
      cursor: first.nextCursor,
      limit: 2,
    }));
    expect(second).toEqual({
      status: 'succeeded',
      organization: { id: ids.organizationA, name: 'Synthetic Organization A' },
      customers: [],
      nfcTags: [
        {
          id: ids.tagAssignedA,
          displayName: 'Assigned Tag A',
          validationFingerprint: fingerprintFor('nfc:uid:v1:AA'),
          assignmentState: 'assigned',
          targetCustomerId: ids.customerA,
        },
        {
          id: ids.tagUnassignedA,
          displayName: 'Unassigned Tag A',
          validationFingerprint: fingerprintFor('nfc:uid:v1:BB'),
          assignmentState: 'unassigned',
          targetCustomerId: null,
        },
      ],
      nextCursor: null,
    });
    expect(JSON.stringify([first, second])).not.toContain('nfc:uid:v1:');
  });

  it('keeps keyset paging stable when a lower key is inserted after page one', async () => {
    const first = await coordinator.readSetupProjection(projectionCommand({ limit: 1 }));
    expect(first).toMatchObject({
      status: 'succeeded',
      customers: [{ id: ids.customerA }],
      nextCursor: `v1:c:${ids.customerA}`,
    });
    if (first.status !== 'succeeded') {
      throw new Error('Expected a successful first projection page');
    }
    await installerPool.query(
      `INSERT INTO taptime_server.customers
        (id, organization_id, display_name, active)
       VALUES ($1, $2, 'Inserted Behind Cursor', true)`,
      [ids.lowerCustomerA, ids.organizationA],
    );
    const rest = await coordinator.readSetupProjection(projectionCommand({
      cursor: first.nextCursor,
      limit: 20,
    }));
    expect(rest).toMatchObject({ status: 'succeeded' });
    expect(JSON.stringify(rest)).not.toContain(ids.lowerCustomerA);
    if (rest.status === 'succeeded') {
      expect([
        ...rest.customers.map(({ id }) => id),
        ...rest.nfcTags.map(({ id }) => id),
      ]).toEqual([
        ids.inactiveCustomerA,
        ids.tagAssignedA,
        ids.tagUnassignedA,
      ]);
    }
  });

  it('derives and isolates the second Organization projection', async () => {
    await expect(coordinator.readSetupProjection(projectionCommand({
      accessToken: fixtureTokens.adminB,
      expectedMembershipId: membershipIds.adminB,
    }))).resolves.toEqual({
      status: 'succeeded',
      organization: { id: ids.organizationB, name: 'Synthetic Organization B' },
      customers: [
        { id: ids.customerB, displayName: 'Active Customer B', active: true },
      ],
      nfcTags: [],
      nextCursor: null,
    });
  });

  it.each([
    [{ cursor: 'not-a-cursor' }, 'invalid cursor'],
    [{ cursor: `V1:C:${ids.customerA}` }, 'uppercase cursor'],
    [{ cursor: `v1:c:${ids.customerA}${'x'.repeat(257)}` }, 'oversized cursor'],
    [{ limit: 0 }, 'zero limit'],
    [{ limit: 21 }, 'oversized limit'],
  ] as const)('rejects invalid projection input %# without opening setup state', async (overrides, _case) => {
    await expect(coordinator.readSetupProjection(projectionCommand(overrides))).resolves.toEqual({
      status: 'invalid_request',
    });
    await expect(tableCounts()).resolves.toEqual(baselineCounts);
  });

  it('clears role and derived GUC context after commit and rollback on a reused connection', async () => {
    const dedicatedPool = new Pool({ connectionString: runtimeDatabaseUrl, max: 1 });
    const dedicatedCoordinator = new AdminWriteSessionCoordinator(
      dedicatedPool,
      fixtureAccessTokenVerifier,
    );
    try {
      await expect(dedicatedCoordinator.createCustomer(customerCommand())).resolves.toMatchObject({
        status: 'succeeded',
      });
      await expect(sessionState(dedicatedPool)).resolves.toSatisfy(isCleanSessionState);

      await expect(dedicatedCoordinator.createCustomer(customerCommand({
        commandId: commandIds.createSecond,
      }), {
        afterWrite: (stage: AdminWriteStage) => {
          throw new InjectedC3CFailure(stage);
        },
      })).rejects.toBeInstanceOf(InjectedC3CFailure);
      await expect(sessionState(dedicatedPool)).resolves.toSatisfy(isCleanSessionState);
    } finally {
      await dedicatedPool.end();
    }
  });
});

const baselineCounts = Object.freeze({
  customers: 3,
  tags: 2,
  assignments: 1,
  audits: 0,
  receipts: 0,
});

function customerCommand(
  overrides: Partial<CreateCustomerCommand> = {},
): CreateCustomerCommand {
  return {
    accessToken: fixtureTokens.adminA,
    expectedMembershipId: membershipIds.adminA,
    commandId: commandIds.create,
    displayName: 'New Customer',
    ...overrides,
  };
}

function provisionCommand(
  overrides: Partial<ProvisionNfcTagCommand> = {},
): ProvisionNfcTagCommand {
  return {
    accessToken: fixtureTokens.adminA,
    expectedMembershipId: membershipIds.adminA,
    commandId: commandIds.provision,
    customerId: customerIds.customerA,
    displayName: 'Warehouse Tag',
    canonicalPayload: 'nfc:uid:v1:CC',
    ...overrides,
  };
}

function projectionCommand(
  overrides: Partial<ReadSetupProjectionCommand> = {},
): ReadSetupProjectionCommand {
  return {
    accessToken: fixtureTokens.adminA,
    expectedMembershipId: membershipIds.adminA,
    cursor: null,
    limit: 20,
    ...overrides,
  };
}

async function tableCounts(): Promise<typeof baselineCounts> {
  const result = await installerPool.query<typeof baselineCounts>(`
    SELECT
      (SELECT count(*)::integer FROM taptime_server.customers) AS customers,
      (SELECT count(*)::integer FROM taptime_server.nfc_tags) AS tags,
      (SELECT count(*)::integer FROM taptime_server.nfc_assignments) AS assignments,
      (SELECT count(*)::integer FROM taptime_server.audit_events) AS audits,
      (SELECT count(*)::integer FROM taptime_server.admin_setup_command_receipts) AS receipts
  `);
  return result.rows[0]!;
}

async function commitAdversarialCustomerReceipt(input: {
  readonly displayName: string;
  readonly requestHash: string;
}): Promise<void> {
  await commitAdminSetupOperation(commandIds.create, async (client) => {
    await client.query(
      `INSERT INTO taptime_server.customers
        (id, organization_id, display_name, active)
       VALUES ($1, $2, $3, true)`,
      [ids.adversarialCustomerA, ids.organizationA, input.displayName],
    );
    await client.query(
      `INSERT INTO taptime_server.admin_setup_command_receipts (
         organization_id, command_id, actor_user_id, membership_id, command_type,
         request_hash_version, request_hash, result_status, result_customer_id,
         result_nfc_tag_id, result_nfc_assignment_id
       ) VALUES ($1, $2, $3, $4, 'createCustomer', 1, decode($5, 'hex'),
         'succeeded', $6, NULL, NULL)`,
      [
        ids.organizationA,
        commandIds.create,
        ids.adminA,
        ids.membershipAdminA,
        input.requestHash,
        ids.adversarialCustomerA,
      ],
    );
  });
}

async function commitAdversarialTagReceipt(requestHash: string): Promise<void> {
  await installerPool.query(
    `INSERT INTO taptime_server.admin_setup_command_receipts (
       organization_id, command_id, actor_user_id, membership_id, command_type,
       request_hash_version, request_hash, result_status, result_customer_id,
       result_nfc_tag_id, result_nfc_assignment_id
     ) VALUES ($1, $2, $3, $4, 'provisionNfcTag', 1, decode($5, 'hex'),
       'succeeded', NULL, $6, $7)`,
    [
      ids.organizationA,
      commandIds.provision,
      ids.adminA,
      ids.membershipAdminA,
      requestHash,
      ids.tagAssignedA,
      ids.assignmentA,
    ],
  );
}

async function commitMatchingTagReceipt(requestHash: string): Promise<void> {
  await commitAdminSetupOperation(commandIds.provision, async (client) => {
    await client.query(
      `SELECT * FROM taptime_server.insert_admin_setup_nfc_tag_v1(
         $1, $2, 'Warehouse Tag', 'nfc:uid:v1:CC'
       )`,
      [ids.adversarialTagA, ids.organizationA],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
       VALUES ($1, $2, $3, 'customer', $4, true)`,
      [
        ids.adversarialAssignmentA,
        ids.organizationA,
        ids.adversarialTagA,
        ids.customerA,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.admin_setup_command_receipts (
         organization_id, command_id, actor_user_id, membership_id, command_type,
         request_hash_version, request_hash, result_status, result_customer_id,
         result_nfc_tag_id, result_nfc_assignment_id
       ) VALUES ($1, $2, $3, $4, 'provisionNfcTag', 1, decode($5, 'hex'),
         'succeeded', NULL, $6, $7)`,
      [
        ids.organizationA,
        commandIds.provision,
        ids.adminA,
        ids.membershipAdminA,
        requestHash,
        ids.adversarialTagA,
        ids.adversarialAssignmentA,
      ],
    );
  });
}

async function commitMatchingDivergentTagReceipt(requestHash: string): Promise<void> {
  await commitAdminSetupOperation(commandIds.provision, async (client) => {
    await client.query(
      `SELECT * FROM taptime_server.insert_admin_setup_nfc_tag_v1(
         $1, $2, 'Different External Tag', 'nfc:uid:v1:DD'
       )`,
      [ids.adversarialDivergentTagA, ids.organizationA],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
       VALUES ($1, $2, $3, 'customer', $4, true)`,
      [
        ids.adversarialDivergentAssignmentA,
        ids.organizationA,
        ids.adversarialDivergentTagA,
        ids.customerA,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.admin_setup_command_receipts (
         organization_id, command_id, actor_user_id, membership_id, command_type,
         request_hash_version, request_hash, result_status, result_customer_id,
         result_nfc_tag_id, result_nfc_assignment_id
       ) VALUES ($1, $2, $3, $4, 'provisionNfcTag', 1, decode($5, 'hex'),
         'succeeded', NULL, $6, $7)`,
      [
        ids.organizationA,
        commandIds.provision,
        ids.adminA,
        ids.membershipAdminA,
        requestHash,
        ids.adversarialDivergentTagA,
        ids.adversarialDivergentAssignmentA,
      ],
    );
  });
}

async function commitAdminSetupOperation(
  commandId: string,
  operation: (client: PoolClient) => Promise<void>,
): Promise<void> {
  const client = await runtimePool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT
         set_config('app.user_id', $1, true),
         set_config('app.organization_id', $2, true),
         set_config('app.membership_id', $3, true),
         set_config('app.membership_role', 'administrator', true),
         set_config('app.correlation_id', $4, true)`,
      [ids.adminA, ids.organizationA, ids.membershipAdminA, commandId],
    );
    await client.query('SET LOCAL ROLE taptime_admin_setup');
    await operation(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function fingerprintFor(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 12).toUpperCase();
}

interface SessionState {
  readonly session_user: string;
  readonly current_user: string;
  readonly current_role: string;
  readonly user_context: string | null;
  readonly organization_context: string | null;
  readonly membership_context: string | null;
  readonly role_context: string | null;
}

async function sessionState(pool: Pool): Promise<SessionState> {
  const result = await pool.query<SessionState>(`
    SELECT
      session_user,
      current_user,
      current_role,
      current_setting('app.user_id', true) AS user_context,
      current_setting('app.organization_id', true) AS organization_context,
      current_setting('app.membership_id', true) AS membership_context,
      current_setting('app.membership_role', true) AS role_context
  `);
  return result.rows[0]!;
}

function isCleanSessionState(state: SessionState): boolean {
  return state.session_user === C3C_RUNTIME_LOGIN
    && state.current_user === C3C_RUNTIME_LOGIN
    && state.current_role === C3C_RUNTIME_LOGIN
    && [null, ''].includes(state.user_context)
    && [null, ''].includes(state.organization_context)
    && [null, ''].includes(state.membership_context)
    && [null, ''].includes(state.role_context);
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
