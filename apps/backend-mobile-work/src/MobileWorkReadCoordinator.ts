import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  MOBILE_CURSOR_MAXIMUM_ASCII_CHARACTERS,
  MOBILE_OWN_TIME_LIMIT_MAXIMUM,
  MOBILE_WORK_TARGET_LIMIT_MAXIMUM,
  validateMobileOwnTimeQueryRequest,
  validateMobileWorkTargetQueryRequest,
  type MobileOwnTimeQueryResponse,
  type MobileWorkTargetQueryResponse,
  type SafeOwnTimeRecord,
  type WorkTargetType,
} from '@taptime/mobile-work-contract';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { MobileReadCommand, MobileReadResult, MobileWorkReader } from './types.js';

const IDENTITY_ROLE = 'taptime_identity_resolver';
const OWN_TIME_ROLE = 'taptime_mobile_own_time_reader';
const TARGET_ROLE = 'taptime_mobile_target_reader';

interface ActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: 'employee' | 'administrator';
}

interface OwnTimeRow extends QueryResultRow {
  readonly row_kind: 'active' | 'history';
  readonly time_record_id: string;
  readonly source: 'canonical' | 'recovered';
  readonly target_type: WorkTargetType;
  readonly target_display_name: string;
  readonly status: 'started' | 'stopped';
  readonly started_at: Date;
  readonly stopped_at: Date | null;
  readonly started_via: 'nfc' | 'manual' | null;
  readonly stopped_via: 'nfc' | 'manual' | null;
  readonly window_started_at: Date;
  readonly window_ended_at: Date;
}

interface TargetRow extends QueryResultRow {
  readonly target_type: WorkTargetType;
  readonly target_id: string;
  readonly display_name: string;
  readonly row_version: string | number;
}

interface OwnTimeCursor {
  readonly windowStartedAtMilliseconds: number;
  readonly windowEndedAtMilliseconds: number;
  readonly startedAtMilliseconds: number;
  readonly timeRecordId: string;
  readonly signature: string;
}

interface TargetCursor {
  readonly typeRank: number;
  readonly displayName: string;
  readonly targetId: string;
}

export class MobileWorkReadCoordinator implements MobileWorkReader {
  private readonly ownTimeCursorHmacKey: Buffer;

  constructor(
    private readonly ownTimePool: Pool,
    private readonly targetPool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    ownTimeCursorHmacKey: string,
  ) {
    this.ownTimeCursorHmacKey = parseOwnTimeCursorHmacKey(ownTimeCursorHmacKey);
  }

  async queryOwnTime(
    command: MobileReadCommand<Parameters<MobileWorkReader['queryOwnTime']>[0]['request']>,
  ): Promise<MobileReadResult<MobileOwnTimeQueryResponse>> {
    if (!validateMobileOwnTimeQueryRequest(command.request)) {
      return { status: 'invalid_request' };
    }
    const cursor = decodeOwnTimeCursor(command.request.cursor);
    if (cursor === undefined) return { status: 'invalid_request' };

    return this.withActor<MobileOwnTimeQueryResponse>(
      this.ownTimePool,
      command.accessToken,
      command.request.expectedMembershipId,
      OWN_TIME_ROLE,
      async (client, actor) => {
        if (
          cursor !== null
          && !isOwnTimeCursorAuthentic(cursor, actor, this.ownTimeCursorHmacKey)
        ) {
          return { status: 'invalid_request' };
        }
        const rows = await client.query<OwnTimeRow>(
          `SELECT row_kind, time_record_id, source, target_type, target_display_name,
                  status, started_at, stopped_at, started_via, stopped_via,
                  window_started_at, window_ended_at
           FROM taptime_server.read_mobile_own_time_v1(
             $1::uuid, $2::uuid, $3::uuid, $4::timestamptz, $5::timestamptz,
             $6::timestamptz, $7::uuid, $8
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            cursor === null
              ? null
              : new Date(cursor.windowStartedAtMilliseconds).toISOString(),
            cursor === null
              ? null
              : new Date(cursor.windowEndedAtMilliseconds).toISOString(),
            cursor === null
              ? null
              : new Date(cursor.startedAtMilliseconds).toISOString(),
            cursor?.timeRecordId ?? null,
            command.request.limit + 1,
          ],
        );
        const active = rows.rows.find((row) => row.row_kind === 'active');
        const history = rows.rows.filter((row) => row.row_kind === 'history');
        const hasMore = history.length > command.request.limit;
        const page = history.slice(0, command.request.limit);
        const last = page.at(-1);
        const fallback = await client.query<{ now: Date }>(
          'SELECT transaction_timestamp() AS now',
        );
        const endedAt = rows.rows[0]?.window_ended_at
          ?? (cursor === null
            ? fallback.rows[0]!.now
            : new Date(cursor.windowEndedAtMilliseconds));
        const startedAt = rows.rows[0]?.window_started_at
          ?? (cursor === null
            ? new Date(endedAt.getTime() - OWN_TIME_WINDOW_MILLISECONDS)
            : new Date(cursor.windowStartedAtMilliseconds));
        return {
          status: 'succeeded',
          response: {
            activeRecord: active === undefined ? null : mapOwnTimeRecord(active),
            records: page.map(mapOwnTimeRecord),
            nextCursor: hasMore && last !== undefined
              ? encodeOwnTimeCursor({
                  windowStartedAtMilliseconds: startedAt.getTime(),
                  windowEndedAtMilliseconds: endedAt.getTime(),
                  startedAtMilliseconds: last.started_at.getTime(),
                  timeRecordId: last.time_record_id,
                }, actor, this.ownTimeCursorHmacKey)
              : null,
            windowStartedAt: startedAt.toISOString(),
            windowEndedAt: endedAt.toISOString(),
          },
        };
      },
    );
  }

  async queryWorkTargets(
    command: MobileReadCommand<Parameters<MobileWorkReader['queryWorkTargets']>[0]['request']>,
  ): Promise<MobileReadResult<MobileWorkTargetQueryResponse>> {
    if (!validateMobileWorkTargetQueryRequest(command.request)) {
      return { status: 'invalid_request' };
    }
    const cursor = decodeCursor<TargetCursor>(command.request.cursor, isTargetCursor);
    if (cursor === undefined) return { status: 'invalid_request' };

    return this.withActor(
      this.targetPool,
      command.accessToken,
      command.request.expectedMembershipId,
      TARGET_ROLE,
      async (client, actor) => {
        const rows = await client.query<TargetRow>(
          `SELECT target_type, target_id, display_name, row_version
           FROM taptime_server.read_mobile_work_targets_v1(
             $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            cursor?.typeRank ?? null,
            cursor?.displayName ?? null,
            cursor?.targetId ?? null,
            command.request.limit + 1,
          ],
        );
        const hasMore = rows.rows.length > command.request.limit;
        const page = rows.rows.slice(0, command.request.limit);
        const last = page.at(-1);
        return {
          status: 'succeeded',
          response: {
            targets: page.map((row) => ({
              targetType: row.target_type,
              targetId: row.target_id,
              displayName: row.display_name,
            })),
            nextCursor: hasMore && last !== undefined
              ? encodeCursor({
                  typeRank: targetTypeRank(last.target_type),
                  displayName: last.display_name,
                  targetId: last.target_id,
                })
              : null,
          },
        };
      },
    );
  }

  private async withActor<Response>(
    pool: Pool,
    accessToken: string,
    expectedMembershipId: string,
    role: typeof OWN_TIME_ROLE | typeof TARGET_ROLE,
    operation: (
      client: PoolClient,
      actor: ActorRow,
    ) => Promise<MobileReadResult<Response>>,
  ): Promise<MobileReadResult<Response>> {
    const verification = await this.accessTokenVerifier.verify(accessToken);
    if (verification.status === 'rejected') return { status: 'unauthorized' };
    const client = await pool.connect();
    let open = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      open = true;
      await client.query(`SET LOCAL ROLE ${IDENTITY_ROLE}`);
      const actorResult = await client.query<ActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.resolve_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      const actor = actorResult.rows[0];
      if (actorResult.rows.length !== 1 || actor === undefined
        || actor.membership_id !== expectedMembershipId) {
        await client.query('ROLLBACK');
        open = false;
        return { status: 'forbidden' };
      }
      await setActorContext(client, actor);
      await client.query(`SET LOCAL ROLE ${role}`);
      const result = await operation(client, actor);
      await client.query('COMMIT');
      open = false;
      return result;
    } catch (error) {
      if (open) await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

function mapOwnTimeRecord(row: OwnTimeRow): SafeOwnTimeRecord {
  return {
    timeRecordId: row.time_record_id,
    source: row.source,
    targetType: row.target_type,
    targetDisplayName: row.target_display_name,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    stoppedAt: row.stopped_at?.toISOString() ?? null,
    startedVia: row.source === 'recovered' ? null : row.started_via,
    stoppedVia: row.source === 'recovered' ? null : row.stopped_via,
  };
}

async function setActorContext(client: PoolClient, actor: ActorRow): Promise<void> {
  await client.query(
    `SELECT set_config('app.user_id', $1, true),
            set_config('app.organization_id', $2, true),
            set_config('app.membership_id', $3, true),
            set_config('app.membership_role', $4, true)`,
    [actor.user_id, actor.organization_id, actor.membership_id, actor.membership_role],
  );
}

function targetTypeRank(type: WorkTargetType): number {
  return type === 'customer' ? 1 : type === 'project' ? 2 : 3;
}

const OWN_TIME_WINDOW_MILLISECONDS = 31 * 24 * 60 * 60 * 1_000;
const MAXIMUM_DATE_MILLISECONDS = 8_640_000_000_000_000;
const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OWN_TIME_CURSOR_HMAC_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function encodeOwnTimeCursor(
  value: Omit<OwnTimeCursor, 'signature'>,
  actor: ActorRow,
  hmacKey: Buffer,
): string {
  const payload = Buffer.from(JSON.stringify([
    value.windowStartedAtMilliseconds,
    value.windowEndedAtMilliseconds,
    value.startedAtMilliseconds,
    value.timeRecordId,
  ]), 'utf8').toString('base64url');
  const signature = signOwnTimeCursorPayload(payload, actor, hmacKey);
  const cursor = `v1:${payload}.${signature}`;
  if (cursor.length > MOBILE_CURSOR_MAXIMUM_ASCII_CHARACTERS) {
    throw new Error('Mobile own-time cursor exceeds its closed transport bound');
  }
  return cursor;
}

function decodeOwnTimeCursor(value: string | null): OwnTimeCursor | null | undefined {
  if (value === null) return null;
  const match = /^v1:([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (match === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(match[1]!, 'base64url').toString('utf8'));
    if (
      !Array.isArray(parsed)
      || parsed.length !== 4
      || !parsed.slice(0, 3).every(isValidDateMilliseconds)
      || typeof parsed[3] !== 'string'
      || !CANONICAL_UUID_PATTERN.test(parsed[3])
      || parsed[1] - parsed[0] !== OWN_TIME_WINDOW_MILLISECONDS
      || parsed[2] < parsed[0]
      || parsed[2] >= parsed[1]
    ) return undefined;
    return {
      windowStartedAtMilliseconds: parsed[0] as number,
      windowEndedAtMilliseconds: parsed[1] as number,
      startedAtMilliseconds: parsed[2] as number,
      timeRecordId: parsed[3],
      signature: match[2]!,
    };
  } catch {
    return undefined;
  }
}

function isOwnTimeCursorAuthentic(
  cursor: OwnTimeCursor,
  actor: ActorRow,
  hmacKey: Buffer,
): boolean {
  const payload = Buffer.from(JSON.stringify([
    cursor.windowStartedAtMilliseconds,
    cursor.windowEndedAtMilliseconds,
    cursor.startedAtMilliseconds,
    cursor.timeRecordId,
  ]), 'utf8').toString('base64url');
  const expected = Buffer.from(signOwnTimeCursorPayload(payload, actor, hmacKey), 'ascii');
  const actual = Buffer.from(cursor.signature, 'ascii');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signOwnTimeCursorPayload(
  payload: string,
  actor: ActorRow,
  hmacKey: Buffer,
): string {
  const actorBoundKey = createHmac('sha256', hmacKey)
    .update(JSON.stringify([
      'taptime-mobile-own-time-cursor-v1',
      actor.organization_id,
      actor.user_id,
      actor.membership_id,
    ]), 'utf8')
    .digest();
  return createHmac('sha256', actorBoundKey).update(payload, 'ascii').digest('base64url');
}

function parseOwnTimeCursorHmacKey(value: string): Buffer {
  if (!OWN_TIME_CURSOR_HMAC_KEY_PATTERN.test(value)) {
    throw new Error(
      'Mobile own-time cursor HMAC key must be canonical unpadded base64url for 32 bytes',
    );
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length !== 32 || decoded.toString('base64url') !== value) {
    throw new Error(
      'Mobile own-time cursor HMAC key must be canonical unpadded base64url for 32 bytes',
    );
  }
  return Buffer.from(decoded);
}

function isValidDateMilliseconds(value: unknown): value is number {
  return Number.isSafeInteger(value)
    && Number(value) >= 0
    && Number(value) <= MAXIMUM_DATE_MILLISECONDS;
}

function encodeCursor(value: unknown): string {
  return `v1:${Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')}`;
}

function decodeCursor<Value>(
  value: string | null,
  predicate: (candidate: unknown) => candidate is Value,
): Value | null | undefined {
  if (value === null) return null;
  if (!value.startsWith('v1:')) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value.slice(3), 'base64url').toString('utf8'));
    return predicate(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isTargetCursor(value: unknown): value is TargetCursor {
  return isRecord(value)
    && Object.keys(value).length === 3
    && Number.isInteger(value.typeRank)
    && Number(value.typeRank) >= 1
    && Number(value.typeRank) <= 3
    && typeof value.displayName === 'string'
    && typeof value.targetId === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original failure.
  }
}

void MOBILE_OWN_TIME_LIMIT_MAXIMUM;
void MOBILE_WORK_TARGET_LIMIT_MAXIMUM;
