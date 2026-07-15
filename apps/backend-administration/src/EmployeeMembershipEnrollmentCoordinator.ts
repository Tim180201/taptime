import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  normalizeCustomerNameV1,
  normalizeOrganizationNameV1,
} from '@taptime/administration-contract';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { MembershipId, OrganizationId } from '@taptime/core';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  CreateEmployeeMembershipInvitationCommand,
  CreateEmployeeMembershipInvitationResult,
  EmployeeEnrollmentCoordinatorControls,
  EmployeeMembershipSummary,
  ReadEmployeeMembershipsProjectionCommand,
  ReadEmployeeMembershipsProjectionResult,
  RedeemEmployeeMembershipInvitationCommand,
  RedeemEmployeeMembershipInvitationResult,
} from './types.js';

export const C3E1_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const C3E1_INVITATION_CREATOR_ROLE = 'taptime_employee_invitation_creator';
export const C3E1_ENROLLMENT_REDEEMER_ROLE = 'taptime_employee_enrollment_redeemer';

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const enrollmentCursorPattern = /^v1:e:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const invitationSecretPattern = /^[A-Za-z0-9_-]{43}$/;
const invitationDomain = Buffer.from('taptime:c3e1:employee-invitation:v1\0', 'utf8');
const DEFAULT_INTERNAL_DEADLINE_MILLISECONDS = 8_000;
const DEADLINE_SAFETY_MILLISECONDS = 100;

interface ResolvedActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: string;
}

interface CreateInvitationRow extends QueryResultRow {
  readonly result_status:
    | 'command_id_conflict'
    | 'forbidden'
    | 'invalid_request'
    | 'invitation_created_token_unavailable'
    | 'invitation_limit_reached'
    | 'succeeded';
  readonly result_expires_at: Date | string | null;
}

interface EmployeeProjectionRow extends QueryResultRow {
  readonly organization_id: string;
  readonly organization_name: string;
  readonly membership_id: string | null;
  readonly membership_display_name: string | null;
}

interface RedemptionRow extends QueryResultRow {
  readonly result_status: 'enrollment_unavailable' | 'invalid_request' | 'succeeded';
  readonly result_organization_name: string | null;
  readonly result_membership_display_name: string | null;
}

export class C3E1DeadlineExceededError extends Error {
  constructor() {
    super('C3E1 operation deadline exceeded');
    this.name = 'C3E1DeadlineExceededError';
  }
}

export class EmployeeMembershipEnrollmentCoordinator {
  constructor(
    private readonly invitationCreatorPool: Pool,
    private readonly enrollmentRedeemerPool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async createInvitation(
    command: CreateEmployeeMembershipInvitationCommand,
    controls: EmployeeEnrollmentCoordinatorControls = {},
  ): Promise<CreateEmployeeMembershipInvitationResult> {
    const normalized = typeof command.displayName === 'string'
      ? normalizeCustomerNameV1(command.displayName)
      : { status: 'invalid' as const };
    if (
      !validAccessToken(command.accessToken)
      || !isCanonicalUuid(command.expectedMembershipId)
      || !isCanonicalUuid(command.commandId)
      || normalized.status === 'invalid'
    ) {
      return { status: 'invalid_request' };
    }

    const secretBytes = randomBytes(32);
    const invitationSecret = secretBytes.toString('base64url');
    const tokenDigest = createHash('sha256')
      .update(invitationDomain)
      .update(secretBytes)
      .digest();

    return this.withAdministratorAuthority(
      command.accessToken,
      command.expectedMembershipId,
      command.commandId,
      controls,
      async (client) => {
        const result = await client.query<CreateInvitationRow>(
          `SELECT result_status, result_expires_at
           FROM taptime_server.create_employee_membership_invitation_v1($1, $2, $3, $4)`,
          [command.commandId, randomUUID(), normalized.canonicalName, tokenDigest],
        );
        const row = onlyRow(result.rows, 'Invitation creation');
        if (row.result_status !== 'succeeded') {
          return { status: row.result_status };
        }
        if (row.result_expires_at === null) {
          throw new Error('Invitation creation omitted its expiry');
        }
        const expiresAt = canonicalTimestamp(row.result_expires_at);
        if (invitationSecret.length !== 43) {
          throw new Error('Generated invitation secret is not canonical');
        }
        return Object.freeze({ status: 'succeeded', invitationSecret, expiresAt });
      },
    );
  }

  async readEmployeeMembershipsProjection(
    command: ReadEmployeeMembershipsProjectionCommand,
    controls: EmployeeEnrollmentCoordinatorControls = {},
  ): Promise<ReadEmployeeMembershipsProjectionResult> {
    const cursor = parseCursor(command.cursor);
    if (
      !validAccessToken(command.accessToken)
      || !isCanonicalUuid(command.expectedMembershipId)
      || cursor === undefined
      || !Number.isSafeInteger(command.limit)
      || command.limit < 1
      || command.limit > 20
    ) {
      return { status: 'invalid_request' };
    }

    return this.withAdministratorAuthority(
      command.accessToken,
      command.expectedMembershipId,
      randomUUID(),
      controls,
      async (client) => {
        const result = await client.query<EmployeeProjectionRow>(
          `SELECT organization_id, organization_name, membership_id, membership_display_name
           FROM taptime_server.read_employee_memberships_projection_v1($1, $2)`,
          [cursor, command.limit],
        );
        if (result.rows.length === 0) {
          throw new Error('Employee projection omitted its Organization');
        }
        const first = result.rows[0]!;
        const normalizedOrganization = normalizeOrganizationNameV1(first.organization_name);
        if (
          !isCanonicalUuid(first.organization_id)
          || normalizedOrganization.status === 'invalid'
          || normalizedOrganization.canonicalName !== first.organization_name
        ) {
          throw new Error('Employee projection returned an invalid Organization');
        }

        const projected = result.rows.filter(
          (row): row is EmployeeProjectionRow & { membership_id: string; membership_display_name: string } => {
            if (
              row.organization_id !== first.organization_id
              || row.organization_name !== first.organization_name
              || (row.membership_id === null) !== (row.membership_display_name === null)
            ) {
              throw new Error('Employee projection page is not Organization-consistent');
            }
            return row.membership_id !== null;
          },
        );
        const hasMore = projected.length > command.limit;
        const page = projected.slice(0, command.limit);
        const seen = new Set<string>();
        const employeeMemberships: EmployeeMembershipSummary[] = page.map((row) => {
          const normalizedName = normalizeCustomerNameV1(row.membership_display_name);
          if (
            !isCanonicalUuid(row.membership_id)
            || seen.has(row.membership_id)
            || normalizedName.status === 'invalid'
            || normalizedName.canonicalName !== row.membership_display_name
          ) {
            throw new Error('Employee projection returned an invalid Membership');
          }
          seen.add(row.membership_id);
          return Object.freeze({
            id: MembershipId(row.membership_id),
            displayName: row.membership_display_name,
            role: 'employee' as const,
            active: true as const,
          });
        });
        const last = page.at(-1);
        return Object.freeze({
          status: 'succeeded',
          organization: Object.freeze({
            id: OrganizationId(first.organization_id),
            name: first.organization_name,
          }),
          employeeMemberships: Object.freeze(employeeMemberships),
          nextCursor: hasMore && last !== undefined ? `v1:e:${last.membership_id}` : null,
        });
      },
    );
  }

  async redeemInvitation(
    command: RedeemEmployeeMembershipInvitationCommand,
    controls: EmployeeEnrollmentCoordinatorControls = {},
  ): Promise<RedeemEmployeeMembershipInvitationResult> {
    const secretBytes = parseInvitationSecret(command.invitationSecret);
    if (
      !validAccessToken(command.accessToken)
      || !isCanonicalUuid(command.commandId)
      || secretBytes === null
    ) {
      return { status: 'invalid_request' };
    }
    const deadline = controls.deadlineEpochMilliseconds
      ?? Date.now() + DEFAULT_INTERNAL_DEADLINE_MILLISECONDS;
    assertBeforeDeadline(deadline);
    const verification = await this.accessTokenVerifier.verify(command.accessToken);
    if (verification.status === 'rejected') {
      return { status: 'unauthorized' };
    }
    assertBeforeDeadline(deadline);

    const tokenDigest = createHash('sha256')
      .update(invitationDomain)
      .update(secretBytes)
      .digest();
    return withTransaction(this.enrollmentRedeemerPool, deadline, controls, async (client) => {
      await client.query(`SET LOCAL ROLE ${C3E1_ENROLLMENT_REDEEMER_ROLE}`);
      const result = await client.query<RedemptionRow>(
        `SELECT result_status, result_organization_name, result_membership_display_name
         FROM taptime_server.redeem_employee_membership_invitation_v1(
           $1, $2, $3, $4, $5, $6, $7
         )`,
        [
          command.commandId,
          tokenDigest,
          verification.identity.issuer,
          verification.identity.subject,
          randomUUID(),
          randomUUID(),
          randomUUID(),
        ],
      );
      const row = onlyRow(result.rows, 'Invitation redemption');
      if (row.result_status !== 'succeeded') {
        return { status: row.result_status };
      }
      if (
        row.result_organization_name === null
        || row.result_membership_display_name === null
        || !isCanonicalName(row.result_organization_name, normalizeOrganizationNameV1)
        || !isCanonicalName(row.result_membership_display_name, normalizeCustomerNameV1)
      ) {
        throw new Error('Invitation redemption returned unsafe display data');
      }
      return Object.freeze({
        status: 'succeeded',
        organizationName: row.result_organization_name,
        membershipDisplayName: row.result_membership_display_name,
        role: 'employee' as const,
      });
    });
  }

  private async withAdministratorAuthority<Value>(
    accessToken: string,
    expectedMembershipId: MembershipId,
    correlationId: string,
    controls: EmployeeEnrollmentCoordinatorControls,
    operation: (client: PoolClient) => Promise<Value>,
  ): Promise<Value | { readonly status: 'unauthorized' } | { readonly status: 'forbidden' }> {
    const deadline = controls.deadlineEpochMilliseconds
      ?? Date.now() + DEFAULT_INTERNAL_DEADLINE_MILLISECONDS;
    assertBeforeDeadline(deadline);
    const verification = await this.accessTokenVerifier.verify(accessToken);
    if (verification.status === 'rejected') {
      return { status: 'unauthorized' };
    }
    assertBeforeDeadline(deadline);

    return withTransaction(this.invitationCreatorPool, deadline, controls, async (client) => {
      await client.query(`SET LOCAL ROLE ${C3E1_IDENTITY_RESOLVER_ROLE}`);
      const authority = await client.query<ResolvedActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.lock_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      if (authority.rows.length > 1) {
        throw new Error('Employee invitation resolver returned multiple Memberships');
      }
      const actor = authority.rows[0];
      if (actor === undefined) {
        return { status: 'unauthorized' } as const;
      }
      if (
        actor.membership_role !== 'administrator'
        || actor.membership_id !== expectedMembershipId
      ) {
        return { status: 'forbidden' } as const;
      }
      await client.query(
        `SELECT
           set_config('app.user_id', $1, true),
           set_config('app.organization_id', $2, true),
           set_config('app.membership_id', $3, true),
           set_config('app.membership_role', 'administrator', true),
           set_config('app.correlation_id', $4, true)`,
        [actor.user_id, actor.organization_id, actor.membership_id, correlationId],
      );
      await client.query(`SET LOCAL ROLE ${C3E1_INVITATION_CREATOR_ROLE}`);
      return operation(client);
    });
  }
}

async function withTransaction<Value>(
  pool: Pool,
  deadline: number,
  controls: EmployeeEnrollmentCoordinatorControls,
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const client = await pool.connect();
  let connectionFailure: Error | undefined;
  const recordConnectionFailure = (error: Error): void => {
    connectionFailure ??= error;
  };
  const assertActive = (): void => {
    assertBeforeDeadline(deadline);
    if (connectionFailure !== undefined) throw connectionFailure;
  };
  client.on('error', recordConnectionFailure);
  let transactionOpen = false;
  try {
    assertActive();
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE');
    transactionOpen = true;
    await setDatabaseDeadlines(client, deadline);
    const value = await operation(client);
    assertActive();
    await controls.beforeCommit?.();
    assertActive();
    await client.query('COMMIT');
    transactionOpen = false;
    return value;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original verifier, database, deadline or mapping failure.
      }
    }
    throw error;
  } finally {
    client.off('error', recordConnectionFailure);
    client.release(connectionFailure);
  }
}

function validAccessToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value);
}

function parseCursor(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 256) {
    return undefined;
  }
  return enrollmentCursorPattern.exec(value)?.[1];
}

function parseInvitationSecret(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !invitationSecretPattern.test(value)) {
    return null;
  }
  const decoded = Buffer.from(value, 'base64url');
  return decoded.length === 32 && decoded.toString('base64url') === value ? decoded : null;
}

function canonicalTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const canonical = date.toISOString();
  if (canonical.length !== 24) {
    throw new Error('Invitation expiry is not a canonical UTC millisecond timestamp');
  }
  return canonical;
}

function isCanonicalName(
  value: string,
  normalize: (candidate: string) => { readonly status: 'invalid' } | {
    readonly status: 'valid'; readonly canonicalName: string;
  },
): boolean {
  const result = normalize(value);
  return result.status === 'valid' && result.canonicalName === value;
}

function onlyRow<Row>(rows: readonly Row[], operation: string): Row {
  if (rows.length !== 1) {
    throw new Error(`${operation} returned an invalid row count`);
  }
  return rows[0]!;
}

function assertBeforeDeadline(deadlineEpochMilliseconds: number): void {
  if (!Number.isSafeInteger(deadlineEpochMilliseconds) || deadlineEpochMilliseconds <= Date.now()) {
    throw new C3E1DeadlineExceededError();
  }
}

async function setDatabaseDeadlines(
  client: PoolClient,
  deadlineEpochMilliseconds: number,
): Promise<void> {
  const remaining = deadlineEpochMilliseconds - Date.now() - DEADLINE_SAFETY_MILLISECONDS;
  if (remaining < 1) {
    throw new C3E1DeadlineExceededError();
  }
  await client.query(
    `SELECT
       set_config('lock_timeout', $1, true),
       set_config('statement_timeout', $1, true),
       set_config('transaction_timeout', $1, true)`,
    [`${remaining}ms`],
  );
}
