import { OrganizationId, type MembershipRole } from '@taptime/core';
import type { SupabaseJwtAccessTokenVerifier } from '@taptime/backend-identity';
import type { Pool, PoolClient } from 'pg';
import { createTenantReadRepositories } from './readRepositories.js';
import type {
  TenantReadRepositories,
  TenantReadSessionCommand,
  TenantReadSessionResult,
} from './types.js';

const identityResolverRole = 'taptime_identity_resolver';

interface ResolvedActorRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: string;
}

export class TenantReadSessionCoordinator {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: SupabaseJwtAccessTokenVerifier,
  ) {}

  async run<Value>(
    command: TenantReadSessionCommand,
    operation: (repositories: TenantReadRepositories) => Promise<Value>,
  ): Promise<TenantReadSessionResult<Value>> {
    const verification = await this.accessTokenVerifier.verify(command.accessToken);
    if (verification.status === 'rejected') {
      return {
        status: 'rejected',
        reason: 'access_token_rejected',
        tokenReason: verification.reason,
      };
    }

    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
      transactionOpen = true;
      await client.query(`SET LOCAL ROLE ${identityResolverRole}`);
      const resolution = await client.query<ResolvedActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.resolve_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      if (resolution.rows.length > 1) {
        throw new Error('Identity resolver returned more than one active Membership');
      }

      const actor = resolution.rows[0];
      if (actor === undefined) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'rejected', reason: 'identity_or_membership_unavailable' };
      }
      if (actor.organization_id !== command.requestedOrganizationId) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'rejected', reason: 'requested_organization_mismatch' };
      }

      const role = currentMembershipRole(actor.membership_role);
      await setTransactionLocalActorContext(client, actor, role);
      await selectFixedApplicationRole(client, role);

      let sessionActive = true;
      function assertSessionActive(): void {
        if (!sessionActive) {
          throw new Error('Tenant read repositories are no longer active');
        }
      }

      const repositories = createTenantReadRepositories(
        client,
        OrganizationId(actor.organization_id),
        assertSessionActive,
      );
      let value: Value;
      try {
        value = await operation(repositories);
      } finally {
        sessionActive = false;
      }
      await client.query('COMMIT');
      transactionOpen = false;
      return { status: 'accepted', value };
    } catch (error) {
      if (transactionOpen) {
        await rollbackPreservingOriginalError(client);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function currentMembershipRole(value: string): MembershipRole {
  if (value === 'employee' || value === 'administrator') {
    return value;
  }
  throw new Error(`Unsupported resolved Membership role: ${value}`);
}

async function setTransactionLocalActorContext(
  client: PoolClient,
  actor: ResolvedActorRow,
  role: MembershipRole,
): Promise<void> {
  await client.query(
    `SELECT
       set_config('app.user_id', $1, true),
       set_config('app.organization_id', $2, true),
       set_config('app.membership_id', $3, true),
       set_config('app.membership_role', $4, true)`,
    [actor.user_id, actor.organization_id, actor.membership_id, role],
  );
}

async function selectFixedApplicationRole(
  client: PoolClient,
  role: MembershipRole,
): Promise<void> {
  if (role === 'employee') {
    await client.query('SET LOCAL ROLE taptime_employee');
    return;
  }
  await client.query('SET LOCAL ROLE taptime_administrator');
}

async function rollbackPreservingOriginalError(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The original verification, database, mapping or callback error remains authoritative.
  }
}
