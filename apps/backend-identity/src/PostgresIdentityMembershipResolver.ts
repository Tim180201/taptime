import {
  MembershipId,
  OrganizationId,
  UserId,
  type MembershipRole,
} from '@taptime/core';
import type { Pool, PoolClient } from 'pg';
import type {
  IdentityMembershipResolutionResult,
  IdentityMembershipResolver,
} from './identityResolution.js';
import type { VerifiedProviderIdentity } from './accessToken.js';

export const B4_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const B4_SCHEMA = 'taptime_server';

interface ResolvedActorRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: MembershipRole;
}

export class PostgresIdentityMembershipResolver implements IdentityMembershipResolver {
  constructor(private readonly pool: Pool) {}

  async resolve(identity: VerifiedProviderIdentity): Promise<IdentityMembershipResolutionResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
      await client.query(`SET LOCAL ROLE ${B4_IDENTITY_RESOLVER_ROLE}`);
      const result = await client.query<ResolvedActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM ${B4_SCHEMA}.resolve_request_actor($1, $2)`,
        [identity.issuer, identity.subject],
      );
      if (result.rowCount !== null && result.rowCount > 1) {
        throw new Error('Identity resolver returned more than one active Membership');
      }
      await client.query('COMMIT');

      const row = result.rows[0];
      if (row === undefined) {
        return { status: 'not_resolved' };
      }
      return {
        status: 'resolved',
        membership: {
          userId: UserId(row.user_id),
          organizationId: OrganizationId(row.organization_id),
          membershipId: MembershipId(row.membership_id),
          role: row.membership_role,
        },
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original infrastructure failure; releasing the client lets pg discard it if needed.
  }
}
