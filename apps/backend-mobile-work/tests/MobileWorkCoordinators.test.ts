import { createHash, createHmac } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import {
  MobileWorkReadCoordinator,
  ProjectAdministrationCoordinator,
} from '../src/index.js';

const ids = {
  organization: '00000000-0000-4000-8000-000000000001',
  user: '10000000-0000-4000-8000-000000000001',
  membership: '12000000-0000-4000-8000-000000000001',
  project: '20000000-0000-4000-8000-000000000001',
  command: '30000000-0000-4000-8000-000000000001',
  record: '40000000-0000-4000-8000-000000000001',
} as const;
const cursorHmacKey = Buffer.alloc(32, 0x41).toString('base64url');
const rotatedCursorHmacKey = Buffer.alloc(32, 0x42).toString('base64url');

const verifier = {
  verify: vi.fn(async () => ({
    status: 'verified' as const,
    identity: { issuer: 'https://issuer.invalid', subject: 'subject' },
  })),
} as unknown as AccessTokenVerifier;

function queryResult<Row extends Record<string, unknown>>(
  rows: readonly Row[] = [],
): QueryResult<Row> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows: [...rows],
  };
}

function scriptedPool(
  handler: (text: string, values?: readonly unknown[]) => QueryResult<Record<string, unknown>>,
): { readonly pool: Pool; readonly queries: string[]; readonly release: ReturnType<typeof vi.fn> } {
  const queries: string[] = [];
  const release = vi.fn();
  const client = {
    query: vi.fn(async (text: string, values?: readonly unknown[]) => {
      queries.push(text);
      return handler(text, values);
    }),
    release,
  } as unknown as PoolClient;
  return {
    pool: { connect: vi.fn(async () => client) } as unknown as Pool,
    queries,
    release,
  };
}

function actorRows(): QueryResult<Record<string, unknown>> {
  return queryResult([{
    user_id: ids.user,
    organization_id: ids.organization,
    membership_id: ids.membership,
    membership_role: 'administrator',
  }]);
}

describe('MobileWorkReadCoordinator', () => {
  it('uses the isolated own-time pool and returns the active record independently', async () => {
    const own = scriptedPool((text) => {
      if (text.includes('resolve_request_actor')) return actorRows();
      if (text.includes('read_mobile_own_time_v1')) {
        return queryResult([{
          row_kind: 'active',
          time_record_id: ids.record,
          source: 'canonical',
          target_type: 'project',
          target_display_name: 'Innenausbau',
          status: 'started',
          started_at: new Date('2026-07-24T08:00:00.000Z'),
          stopped_at: null,
          started_via: 'manual',
          stopped_via: null,
          window_started_at: new Date('2026-06-23T10:00:00.000Z'),
          window_ended_at: new Date('2026-07-24T10:00:00.000Z'),
        }]);
      }
      return queryResult();
    });
    const targets = scriptedPool(() => {
      throw new Error('target pool must not be used for own-time');
    });
    const coordinator = new MobileWorkReadCoordinator(
      own.pool,
      targets.pool,
      verifier,
      cursorHmacKey,
    );

    const result = await coordinator.queryOwnTime({
      accessToken: 'token',
      request: { expectedMembershipId: ids.membership, cursor: null, limit: 10 },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      response: {
        activeRecord: {
          targetType: 'project',
          targetDisplayName: 'Innenausbau',
          startedVia: 'manual',
        },
        records: [],
      },
    });
    expect(own.queries).toContain('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(own.queries.at(-1)).toBe('COMMIT');
    expect(own.release).toHaveBeenCalledOnce();
  });

  it('keeps one actor-bound own-time frame across pages and rejects tamper or cross-user reuse',
    async () => {
      const frameStarted = new Date('2026-06-23T10:00:00.000Z');
      const frameEnded = new Date('2026-07-24T10:00:00.000Z');
      const firstRecord = '40000000-0000-4000-8000-000000000011';
      const secondRecord = '40000000-0000-4000-8000-000000000012';
      const ownTimeValues: (readonly unknown[])[] = [];
      let page = 0;
      const own = scriptedPool((text, values) => {
        if (text.includes('resolve_request_actor')) return actorRows();
        if (text.includes('read_mobile_own_time_v1')) {
          ownTimeValues.push(values ?? []);
          page += 1;
          return queryResult(page === 1
            ? [
                ownTimeHistoryRow(firstRecord, '2026-07-24T09:00:00.000Z', frameStarted, frameEnded),
                ownTimeHistoryRow(secondRecord, '2026-07-24T08:00:00.000Z', frameStarted, frameEnded),
              ]
            : [
                ownTimeHistoryRow(secondRecord, '2026-07-24T08:00:00.000Z', frameStarted, frameEnded),
              ]);
        }
        if (text.includes('transaction_timestamp()')) {
          return queryResult([{ now: new Date('2026-07-24T11:00:00.000Z') }]);
        }
        return queryResult();
      });
      const coordinator = new MobileWorkReadCoordinator(
        own.pool,
        own.pool,
        verifier,
        cursorHmacKey,
      );

      const first = await coordinator.queryOwnTime({
        accessToken: 'token',
        request: { expectedMembershipId: ids.membership, cursor: null, limit: 1 },
      });
      expect(first.status).toBe('succeeded');
      if (first.status !== 'succeeded') return;
      expect(first.response.records.map((record) => record.timeRecordId)).toEqual([firstRecord]);
      expect(first.response.nextCursor).toMatch(/^v1:[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
      expect(first.response.nextCursor!.length).toBeLessThanOrEqual(256);

      const continuationCoordinator = new MobileWorkReadCoordinator(
        own.pool,
        own.pool,
        verifier,
        cursorHmacKey,
      );
      const second = await continuationCoordinator.queryOwnTime({
        accessToken: 'token',
        request: {
          expectedMembershipId: ids.membership,
          cursor: first.response.nextCursor,
          limit: 1,
        },
      });
      expect(second).toMatchObject({
        status: 'succeeded',
        response: {
          records: [{ timeRecordId: secondRecord }],
          windowStartedAt: frameStarted.toISOString(),
          windowEndedAt: frameEnded.toISOString(),
        },
      });
      expect(ownTimeValues[1]?.slice(3, 5)).toEqual([
        frameStarted.toISOString(),
        frameEnded.toISOString(),
      ]);

      const cursor = first.response.nextCursor!;
      const publiclyForgeableSignature = legacyActorOnlySignature(cursor, {
        organizationId: ids.organization,
        userId: ids.user,
        membershipId: ids.membership,
      });
      const publiclyForged = `${cursor.slice(0, cursor.lastIndexOf('.') + 1)}${publiclyForgeableSignature}`;
      await expect(coordinator.queryOwnTime({
        accessToken: 'token',
        request: { expectedMembershipId: ids.membership, cursor: publiclyForged, limit: 1 },
      })).resolves.toEqual({ status: 'invalid_request' });

      const tampered = `${cursor.slice(0, -1)}${cursor.endsWith('A') ? 'B' : 'A'}`;
      await expect(coordinator.queryOwnTime({
        accessToken: 'token',
        request: { expectedMembershipId: ids.membership, cursor: tampered, limit: 1 },
      })).resolves.toEqual({ status: 'invalid_request' });
      expect(ownTimeValues).toHaveLength(2);

      const otherActor = scriptedPool((text) => {
        if (text.includes('resolve_request_actor')) {
          return queryResult([{
            user_id: '10000000-0000-4000-8000-000000000099',
            organization_id: ids.organization,
            membership_id: ids.membership,
            membership_role: 'employee',
          }]);
        }
        return queryResult();
      });
      const otherCoordinator = new MobileWorkReadCoordinator(
        otherActor.pool,
        otherActor.pool,
        verifier,
        cursorHmacKey,
      );
      await expect(otherCoordinator.queryOwnTime({
        accessToken: 'other-token',
        request: { expectedMembershipId: ids.membership, cursor, limit: 1 },
      })).resolves.toEqual({ status: 'invalid_request' });
      expect(otherActor.queries.some((text) => text.includes('read_mobile_own_time_v1')))
        .toBe(false);

      const rotated = scriptedPool((text) => {
        if (text.includes('resolve_request_actor')) return actorRows();
        return queryResult();
      });
      const rotatedCoordinator = new MobileWorkReadCoordinator(
        rotated.pool,
        rotated.pool,
        verifier,
        rotatedCursorHmacKey,
      );
      await expect(rotatedCoordinator.queryOwnTime({
        accessToken: 'token-after-rotation',
        request: { expectedMembershipId: ids.membership, cursor, limit: 1 },
      })).resolves.toEqual({ status: 'invalid_request' });
      expect(rotated.queries.some((text) => text.includes('read_mobile_own_time_v1')))
        .toBe(false);
    });

  it('rejects malformed requests before token or database access', async () => {
    const pool = scriptedPool(() => queryResult());
    const coordinator = new MobileWorkReadCoordinator(
      pool.pool,
      pool.pool,
      verifier,
      cursorHmacKey,
    );

    await expect(coordinator.queryWorkTargets({
      accessToken: 'token',
      request: { expectedMembershipId: ids.membership, cursor: null, limit: 51 },
    })).resolves.toEqual({ status: 'invalid_request' });
    const outOfDateRangePayload = Buffer.from(JSON.stringify([
      8_640_000_000_000_001,
      8_640_002_678_400_001,
      8_640_000_000_000_002,
      ids.record,
    ]), 'utf8').toString('base64url');
    await expect(coordinator.queryOwnTime({
      accessToken: 'token',
      request: {
        expectedMembershipId: ids.membership,
        cursor: `v1:${outOfDateRangePayload}.${'A'.repeat(43)}`,
        limit: 1,
      },
    })).resolves.toEqual({ status: 'invalid_request' });
    expect(pool.queries).toEqual([]);
  });

  it('requires one canonical 32-byte server-side cursor HMAC key', () => {
    const pool = scriptedPool(() => queryResult());
    expect(() => new MobileWorkReadCoordinator(
      pool.pool,
      pool.pool,
      verifier,
      Buffer.alloc(31).toString('base64url'),
    )).toThrow('Mobile own-time cursor HMAC key');
    expect(() => new MobileWorkReadCoordinator(
      pool.pool,
      pool.pool,
      verifier,
      `${cursorHmacKey}=`,
    )).toThrow('Mobile own-time cursor HMAC key');
  });
});

function legacyActorOnlySignature(
  cursor: string,
  actor: {
    readonly organizationId: string;
    readonly userId: string;
    readonly membershipId: string;
  },
): string {
  const payload = cursor.slice(3, cursor.lastIndexOf('.'));
  const publiclyDerivedKey = createHash('sha256')
    .update(JSON.stringify([
      'taptime-mobile-own-time-cursor-v1',
      actor.organizationId,
      actor.userId,
      actor.membershipId,
    ]), 'utf8')
    .digest();
  return createHmac('sha256', publiclyDerivedKey)
    .update(payload, 'ascii')
    .digest('base64url');
}

function ownTimeHistoryRow(
  timeRecordId: string,
  startedAt: string,
  windowStartedAt: Date,
  windowEndedAt: Date,
) {
  return {
    row_kind: 'history',
    time_record_id: timeRecordId,
    source: 'canonical',
    target_type: 'customer',
    target_display_name: 'Kunde',
    status: 'stopped',
    started_at: new Date(startedAt),
    stopped_at: new Date(Date.parse(startedAt) + 30 * 60 * 1_000),
    started_via: 'nfc',
    stopped_via: 'nfc',
    window_started_at: windowStartedAt,
    window_ended_at: windowEndedAt,
  };
}

describe('ProjectAdministrationCoordinator', () => {
  it('creates a Project, receipt and audit in the administrator transaction', async () => {
    const database = scriptedPool((text) => {
      if (text.includes('lock_request_actor')) return actorRows();
      if (text.includes('project_command_receipts') && text.includes('SELECT')) {
        return queryResult();
      }
      if (text.includes('FROM taptime_server.projects') && text.includes('SELECT 1')) {
        return queryResult();
      }
      return queryResult();
    });
    const coordinator = new ProjectAdministrationCoordinator(database.pool, verifier);

    const result = await coordinator.createProject({
      accessToken: 'token',
      request: {
        expectedMembershipId: ids.membership,
        commandId: ids.command,
        projectId: ids.project,
        displayName: 'Innenausbau',
      },
    });

    expect(result).toEqual({
      status: 'succeeded',
      idempotentRetry: false,
      project: {
        projectId: ids.project,
        displayName: 'Innenausbau',
        active: true,
        rowVersion: 1,
      },
      receiptId: ids.command,
    });
    expect(database.queries.some((text) => text.includes('INSERT INTO taptime_server.projects')))
      .toBe(true);
    expect(database.queries.some((text) => text.includes('append_project_audit_v1')))
      .toBe(true);
    expect(database.queries.some((text) => text.includes('project_command_receipts')))
      .toBe(true);
    expect(database.queries.at(-1)).toBe('COMMIT');
  });

  it('returns the immutable receipt snapshot on an exact retry', async () => {
    const database = scriptedPool((text) => {
      if (text.includes('lock_request_actor')) return actorRows();
      if (text.includes('project_command_receipts') && text.includes('SELECT')) {
        return queryResult([{
          command_type: 'create',
          request_hash: requestHashForCreate(),
          project_id: ids.project,
          result_display_name: 'Innenausbau',
          result_active: true,
          result_row_version: '1',
        }]);
      }
      return queryResult();
    });
    const coordinator = new ProjectAdministrationCoordinator(database.pool, verifier);

    const result = await coordinator.createProject({
      accessToken: 'token',
      request: {
        expectedMembershipId: ids.membership,
        commandId: ids.command,
        projectId: ids.project,
        displayName: 'Innenausbau',
      },
    });

    expect(result).toMatchObject({
      status: 'succeeded',
      idempotentRetry: true,
      project: { displayName: 'Innenausbau', active: true, rowVersion: 1 },
    });
    expect(database.queries.filter((text) => text.includes('FROM taptime_server.projects')))
      .toEqual([]);
  });

  it('rolls back when Project deactivation observes active work', async () => {
    const database = scriptedPool((text) => {
      if (text.includes('lock_request_actor')) return actorRows();
      if (text.includes('project_command_receipts') && text.includes('SELECT')) {
        return queryResult();
      }
      if (text.includes('lock_project_for_administration_v1')) {
        return queryResult([{
          project_id: ids.project,
          display_name: 'Innenausbau',
          active: true,
          row_version: '1',
        }]);
      }
      if (text.includes('project_has_active_time_entry_v1')) {
        return queryResult([{ active: true }]);
      }
      return queryResult();
    });
    const coordinator = new ProjectAdministrationCoordinator(database.pool, verifier);

    await expect(coordinator.deactivateProject({
      accessToken: 'token',
      request: {
        expectedMembershipId: ids.membership,
        commandId: ids.command,
        projectId: ids.project,
        expectedRowVersion: 1,
      },
    })).resolves.toEqual({ status: 'project_in_use' });
    expect(database.queries.at(-1)).toBe('ROLLBACK');
  });
});

function requestHashForCreate(): string {
  const fields = [
    'project-create-v1',
    ids.organization,
    ids.user,
    ids.membership,
    ids.project,
    'Innenausbau',
  ];
  return createHash('sha256').update(JSON.stringify(fields), 'utf8').digest('hex');
}
