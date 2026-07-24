import type {
  AccessTokenVerificationResult,
  AccessTokenVerifier,
} from '@taptime/backend-identity';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MobileWorkReadCoordinator } from '../src/index.js';

const installerConnectionString = process.env.DA5_MOBILE_WORK_DATABASE_URL
  ?? process.env.OFFLINE_SYNC_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3';
const runtimePassword = process.env.DA5_MOBILE_WORK_RUNTIME_PASSWORD
  ?? 'da5-mobile-work-local-synthetic-only';
const runtimeLogin = 'taptime_da5_mobile_work_runtime';
const issuer = 'https://da5-mobile-work.invalid/auth';
const cursorHmacKey = Buffer.alloc(32, 0x51).toString('base64url');
const rotatedCursorHmacKey = Buffer.alloc(32, 0x52).toString('base64url');
const ids = Object.freeze({
  organization: '00000000-0000-4000-8000-000000000551',
  user: '10000000-0000-4000-8000-000000000551',
  otherUser: '10000000-0000-4000-8000-000000000552',
  identity: '11000000-0000-4000-8000-000000000551',
  otherIdentity: '11000000-0000-4000-8000-000000000552',
  membership: '12000000-0000-4000-8000-000000000551',
  otherMembership: '12000000-0000-4000-8000-000000000552',
  customer: '20000000-0000-4000-8000-000000000551',
  tag: '30000000-0000-4000-8000-000000000551',
  assignment: '40000000-0000-4000-8000-000000000551',
  activeEntry: '60000000-0000-4000-8000-000000000550',
  stoppedEntries: [
    '60000000-0000-4000-8000-000000000551',
    '60000000-0000-4000-8000-000000000552',
    '60000000-0000-4000-8000-000000000553',
  ],
} as const);
const tokens = Object.freeze({ user: 'da5-user', other: 'da5-other' });
const subjects: Readonly<Record<string, string>> = Object.freeze({
  [tokens.user]: 'da5-user',
  [tokens.other]: 'da5-other',
});
const verifier: AccessTokenVerifier = Object.freeze({
  async verify(accessToken: string): Promise<AccessTokenVerificationResult> {
    const subject = subjects[accessToken];
    return subject === undefined
      ? { status: 'rejected', reason: 'invalid_signature' }
      : { status: 'verified', identity: { issuer, subject } };
  },
});
const installerPool = new Pool({ connectionString: installerConnectionString, max: 2 });
const runtimePool = new Pool({
  connectionString: runtimeConnectionString(
    installerConnectionString,
    runtimeLogin,
    runtimePassword,
  ),
  max: 2,
});
const coordinator = new MobileWorkReadCoordinator(
  runtimePool,
  runtimePool,
  verifier,
  cursorHmacKey,
);
const continuationCoordinator = new MobileWorkReadCoordinator(
  runtimePool,
  runtimePool,
  verifier,
  cursorHmacKey,
);
const rotatedCoordinator = new MobileWorkReadCoordinator(
  runtimePool,
  runtimePool,
  verifier,
  rotatedCursorHmacKey,
);

beforeAll(async () => {
  await prepareRuntimeLogin();
  await seed();
}, 30_000);

afterAll(async () => {
  await runtimePool.end();
  await cleanup();
  await installerPool.end();
});

describe('Mobile own-time PostgreSQL pagination', () => {
  it('keeps one immutable frame across separated requests and returns every record once',
    async () => {
      const first = await coordinator.queryOwnTime({
        accessToken: tokens.user,
        request: { expectedMembershipId: ids.membership, cursor: null, limit: 1 },
      });
      expect(first.status).toBe('succeeded');
      if (first.status !== 'succeeded') return;
      expect(first.response.activeRecord?.timeRecordId).toBe(ids.activeEntry);
      expect(first.response.records).toHaveLength(1);
      expect(first.response.nextCursor).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 25));
      const second = await continuationCoordinator.queryOwnTime({
        accessToken: tokens.user,
        request: {
          expectedMembershipId: ids.membership,
          cursor: first.response.nextCursor,
          limit: 1,
        },
      });
      expect(second.status).toBe('succeeded');
      if (second.status !== 'succeeded') return;
      expect(second.response.activeRecord).toEqual(first.response.activeRecord);
      expect(second.response.windowStartedAt).toBe(first.response.windowStartedAt);
      expect(second.response.windowEndedAt).toBe(first.response.windowEndedAt);
      expect(second.response.nextCursor).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 25));
      const third = await coordinator.queryOwnTime({
        accessToken: tokens.user,
        request: {
          expectedMembershipId: ids.membership,
          cursor: second.response.nextCursor,
          limit: 1,
        },
      });
      expect(third.status).toBe('succeeded');
      if (third.status !== 'succeeded') return;
      expect(third.response.windowStartedAt).toBe(first.response.windowStartedAt);
      expect(third.response.windowEndedAt).toBe(first.response.windowEndedAt);
      expect(third.response.nextCursor).toBeNull();

      const recordIds = [
        ...first.response.records,
        ...second.response.records,
        ...third.response.records,
      ].map((record) => record.timeRecordId);
      expect(recordIds).toHaveLength(3);
      expect(new Set(recordIds)).toEqual(new Set(ids.stoppedEntries));
    });

  it('rejects cursor tampering, cross-user reuse and future or malformed SQL frames', async () => {
    const first = await coordinator.queryOwnTime({
      accessToken: tokens.user,
      request: { expectedMembershipId: ids.membership, cursor: null, limit: 1 },
    });
    expect(first.status).toBe('succeeded');
    if (first.status !== 'succeeded' || first.response.nextCursor === null) return;
    const cursor = first.response.nextCursor;
    const tampered = `${cursor.slice(0, -1)}${cursor.endsWith('A') ? 'B' : 'A'}`;

    await expect(coordinator.queryOwnTime({
      accessToken: tokens.user,
      request: { expectedMembershipId: ids.membership, cursor: tampered, limit: 1 },
    })).resolves.toEqual({ status: 'invalid_request' });
    await expect(coordinator.queryOwnTime({
      accessToken: tokens.other,
      request: { expectedMembershipId: ids.otherMembership, cursor, limit: 1 },
    })).resolves.toEqual({ status: 'invalid_request' });
    await expect(rotatedCoordinator.queryOwnTime({
      accessToken: tokens.user,
      request: { expectedMembershipId: ids.membership, cursor, limit: 1 },
    })).resolves.toEqual({ status: 'invalid_request' });

    await expectRejectedFrame('32 days', '-31 days');
    await expectRejectedFrame('-1 day', '-31 days');
  });
});

async function prepareRuntimeLogin(): Promise<void> {
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${runtimeLogin}') THEN
        CREATE ROLE ${runtimeLogin}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${runtimeLogin} WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD ${quoteLiteral(runtimePassword)};
    ALTER ROLE ${runtimeLogin} RESET ALL;
    DO $parents$
    DECLARE parent_name text;
    BEGIN
      FOR parent_name IN
        SELECT parent.rolname
        FROM pg_catalog.pg_auth_members AS membership
        JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
        JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
        WHERE member.rolname = '${runtimeLogin}'
      LOOP
        EXECUTE pg_catalog.format('REVOKE %I FROM ${runtimeLogin}', parent_name);
      END LOOP;
    END
    $parents$;
    GRANT taptime_identity_resolver TO ${runtimeLogin}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
    GRANT taptime_mobile_own_time_reader TO ${runtimeLogin}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
  `);
}

async function seed(): Promise<void> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO taptime_server.users (id) VALUES ($1), ($2)`,
      [ids.user, ids.otherUser],
    );
    await client.query(
      `INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject) VALUES
        ($1, $2, $5, 'da5-user'), ($3, $4, $5, 'da5-other')`,
      [ids.identity, ids.user, ids.otherIdentity, ids.otherUser, issuer],
    );
    await client.query(
      `INSERT INTO taptime_server.organizations (id, name) VALUES ($1, 'DA5 Mobile Work')`,
      [ids.organization],
    );
    await client.query(
      `INSERT INTO taptime_server.memberships
        (id, organization_id, user_id, role, created_by_user_id, display_name) VALUES
        ($1, $3, $4, 'employee', $5, 'Employee A'),
        ($2, $3, $5, 'employee', $5, 'Employee B')`,
      [ids.membership, ids.otherMembership, ids.organization, ids.user, ids.otherUser],
    );
    await client.query(
      `INSERT INTO taptime_server.customers
        (id, organization_id, display_name, active, activated_at)
       VALUES ($1, $2, 'Pagination Customer', true, transaction_timestamp())`,
      [ids.customer, ids.organization],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_tags
        (id, organization_id, display_name, payload_value)
       VALUES ($1, $2, 'Pagination Tag', 'da5-mobile-pagination')`,
      [ids.tag, ids.organization],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from)
       VALUES ($1, $2, $3, 'customer', $4, true, transaction_timestamp() - interval '1 day')`,
      [ids.assignment, ids.organization, ids.tag, ids.customer],
    );
    await client.query('COMMIT');
    for (const [index, entryId] of ids.stoppedEntries.entries()) {
      await insertStoppedEntry(client, entryId, index);
    }
    await client.query('BEGIN');
    await insertActiveEntry(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertStoppedEntry(
  client: PoolClient,
  entryId: string,
  index: number,
): Promise<void> {
  const suffix = String(561 + index * 2).padStart(12, '0');
  const stopSuffix = String(562 + index * 2).padStart(12, '0');
  const startEventId = `50000000-0000-4000-8000-${suffix}`;
  const stopEventId = `50000000-0000-4000-8000-${stopSuffix}`;
  const hoursAgo = index * 2 + 2;
  await client.query('BEGIN');
  await insertWorkEvent(client, startEventId, `${hoursAgo} hours`);
  await client.query(
    `INSERT INTO taptime_server.time_entries
      (id, organization_id, user_id, target_type, target_customer_id, status,
       start_work_event_id, started_at, row_version)
     VALUES ($1, $2, $3, 'customer', $4, 'started', $5,
       transaction_timestamp() - $6::interval, 1)`,
    [
      entryId, ids.organization, ids.user, ids.customer, startEventId, `${hoursAgo} hours`,
    ],
  );
  await insertDecision(client, startEventId, 'time_entry_started', entryId);
  await client.query('COMMIT');

  await client.query('BEGIN');
  await insertWorkEvent(client, stopEventId, `${hoursAgo - 1} hours`);
  await client.query(
    `UPDATE taptime_server.time_entries
     SET status = 'stopped', stop_work_event_id = $1,
         stopped_at = transaction_timestamp() - $3::interval, row_version = 2
     WHERE organization_id = $2 AND id = $4`,
    [stopEventId, ids.organization, `${hoursAgo - 1} hours`, entryId],
  );
  await insertDecision(client, stopEventId, 'time_entry_stopped', entryId);
  await client.query('COMMIT');
}

async function insertActiveEntry(client: PoolClient): Promise<void> {
  const eventId = '50000000-0000-4000-8000-000000000559';
  await insertWorkEvent(client, eventId, '30 minutes');
  await client.query(
    `INSERT INTO taptime_server.time_entries
      (id, organization_id, user_id, target_type, target_customer_id, status,
       start_work_event_id, started_at)
     VALUES ($1, $2, $3, 'customer', $4, 'started', $5,
       transaction_timestamp() - interval '30 minutes')`,
    [ids.activeEntry, ids.organization, ids.user, ids.customer, eventId],
  );
  await insertDecision(client, eventId, 'time_entry_started', ids.activeEntry);
}

async function insertWorkEvent(
  client: PoolClient,
  eventId: string,
  age: string,
): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.work_events
      (id, organization_id, assignment_id, nfc_tag_id, target_type,
       target_customer_id, triggered_by_user_id, occurred_at, content_hash,
       content_hash_algorithm, content_hash_version)
     VALUES ($1, $2, $3, $4, 'customer', $5, $6,
       transaction_timestamp() - $7::interval, repeat('a', 64), 'sha256', 1)`,
    [
      eventId, ids.organization, ids.assignment, ids.tag, ids.customer, ids.user, age,
    ],
  );
}

async function insertDecision(
  client: PoolClient,
  eventId: string,
  decisionType: 'time_entry_started' | 'time_entry_stopped',
  entryId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.canonical_decisions
      (work_event_id, organization_id, actor_user_id, target_type,
       target_customer_id, decision_type, time_entry_id, engine_version, decision_payload)
     VALUES ($1, $2, $3, 'customer', $4, $5, $6, 'da5-pagination-test', '{}')`,
    [eventId, ids.organization, ids.user, ids.customer, decisionType, entryId],
  );
}

async function expectRejectedFrame(windowAge: string, windowStartOffset: string): Promise<void> {
  const client = await runtimePool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query('SET LOCAL ROLE taptime_identity_resolver');
    const actor = await client.query<{
      user_id: string;
      organization_id: string;
      membership_id: string;
      membership_role: string;
    }>(
      `SELECT user_id, organization_id, membership_id, membership_role
       FROM taptime_server.resolve_request_actor($1, $2)`,
      [issuer, 'da5-user'],
    );
    const row = actor.rows[0]!;
    await client.query(
      `SELECT set_config('app.user_id', $1, true),
              set_config('app.organization_id', $2, true),
              set_config('app.membership_id', $3, true),
              set_config('app.membership_role', $4, true)`,
      [row.user_id, row.organization_id, row.membership_id, row.membership_role],
    );
    await client.query('SET LOCAL ROLE taptime_mobile_own_time_reader');
    await expect(client.query(
      `SELECT *
       FROM taptime_server.read_mobile_own_time_v1(
         $1, $2, $3,
         transaction_timestamp() - $4::interval + $5::interval,
         transaction_timestamp() - $4::interval,
         transaction_timestamp() - $4::interval - interval '1 hour',
         $6, 2
       )`,
      [
        row.organization_id,
        row.user_id,
        row.membership_id,
        windowAge,
        windowStartOffset,
        ids.stoppedEntries[0],
      ],
    )).rejects.toMatchObject({ code: '42501' });
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

async function cleanup(): Promise<void> {
  await installerPool.query(`
    DROP OWNED BY ${runtimeLogin};
    DROP ROLE ${runtimeLogin};
  `).catch(async (error) => {
    await installerPool.query(`DROP OWNED BY ${runtimeLogin}; DROP ROLE IF EXISTS ${runtimeLogin}`)
      .catch(() => undefined);
    throw error;
  });
}

function runtimeConnectionString(
  installerUrl: string,
  login: string,
  password: string,
): string {
  const url = new URL(installerUrl);
  url.username = login;
  url.password = password;
  return url.href;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
