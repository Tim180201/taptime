import {
  MembershipId,
  OrganizationId,
  UserId,
  isMembershipRole,
} from '@taptime/core';
import type { Pool, PoolClient } from 'pg';
import type {
  AdministrationSection,
  AdministrationSessionProjectionResult,
  IdentityMembershipResolutionResult,
  IdentityMembershipResolver,
  ResolvedIdentityMembership,
} from './identityResolution.js';
import type { VerifiedProviderIdentity } from './accessToken.js';

export const B4_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const B4_SCHEMA = 'taptime_server';

interface ResolvedActorRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: string;
}

interface AdministrationSessionRow {
  readonly locations_enabled: boolean;
  readonly setup_available: boolean;
  readonly employees_available: boolean;
  readonly time_records_available: boolean;
  readonly time_export_available: boolean;
  readonly review_items_available: boolean;
  readonly management_scope_kind: string;
  readonly management_location_id: string | null;
  readonly management_location_name: string | null;
}

const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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
      const row = result.rows[0];
      if (row === undefined) {
        await client.query('COMMIT');
        return { status: 'not_resolved' };
      }
      if (!isMembershipRole(row.membership_role)) {
        throw new Error(`Unsupported resolved Membership role: ${row.membership_role}`);
      }
      await client.query('COMMIT');
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

  async resolveAdministrationSession(
    membership: ResolvedIdentityMembership,
  ): Promise<AdministrationSessionProjectionResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
      await client.query(`SET LOCAL ROLE ${B4_IDENTITY_RESOLVER_ROLE}`);
      const result = await client.query<AdministrationSessionRow>(
        `SELECT locations_enabled, setup_available, employees_available,
                time_records_available, time_export_available, review_items_available,
                management_scope_kind, management_location_id, management_location_name
         FROM ${B4_SCHEMA}.read_administration_session_v2($1, $2, $3)`,
        [membership.organizationId, membership.userId, membership.membershipId],
      );
      if (result.rows.length === 0) {
        await client.query('COMMIT');
        return { status: 'not_resolved' };
      }
      const first = result.rows[0]!;
      const sections = availableSections(first);
      const locations: { readonly id: string; readonly name: string }[] = [];
      const seenLocations = new Set<string>();
      for (const row of result.rows) {
        assertConsistentSessionRow(first, row);
        if (first.management_scope_kind === 'organization') {
          if (row.management_location_id !== null || row.management_location_name !== null) {
            throw new Error('Organization-wide administration session exposed a Location');
          }
          continue;
        }
        if ((row.management_location_id === null) !== (row.management_location_name === null)) {
          throw new Error('Administration session returned an incomplete Location');
        }
        if (row.management_location_id === null || row.management_location_name === null) continue;
        if (
          !canonicalUuidPattern.test(row.management_location_id)
          || row.management_location_name.length === 0
          || seenLocations.has(row.management_location_id)
        ) {
          throw new Error('Administration session returned an invalid Location');
        }
        seenLocations.add(row.management_location_id);
        locations.push(Object.freeze({
          id: row.management_location_id,
          name: row.management_location_name,
        }));
      }
      await client.query('COMMIT');
      return {
        status: 'resolved',
        projection: Object.freeze({
          locationsEnabled: first.locations_enabled,
          availableSections: Object.freeze(sections),
          managementScope: first.management_scope_kind === 'organization'
            ? Object.freeze({ kind: 'organization' as const })
            : Object.freeze({ kind: 'locations' as const, locations: Object.freeze(locations) }),
        }),
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

function availableSections(row: AdministrationSessionRow): AdministrationSection[] {
  assertBooleanSessionFields(row);
  const sections: AdministrationSection[] = [];
  if (row.setup_available) sections.push('setup');
  if (row.employees_available) sections.push('employees');
  if (row.time_records_available) sections.push('time_records');
  if (row.time_export_available) sections.push('time_export');
  if (row.review_items_available) sections.push('review_items');
  if (row.management_scope_kind !== 'organization' && row.management_scope_kind !== 'locations') {
    throw new Error('Administration session returned an invalid management scope');
  }
  return sections;
}

function assertBooleanSessionFields(row: AdministrationSessionRow): void {
  if (
    typeof row.locations_enabled !== 'boolean'
    || typeof row.setup_available !== 'boolean'
    || typeof row.employees_available !== 'boolean'
    || typeof row.time_records_available !== 'boolean'
    || typeof row.time_export_available !== 'boolean'
    || typeof row.review_items_available !== 'boolean'
  ) {
    throw new Error('Administration session returned invalid section authority');
  }
}

function assertConsistentSessionRow(
  first: AdministrationSessionRow,
  row: AdministrationSessionRow,
): void {
  assertBooleanSessionFields(row);
  if (
    row.locations_enabled !== first.locations_enabled
    || row.setup_available !== first.setup_available
    || row.employees_available !== first.employees_available
    || row.time_records_available !== first.time_records_available
    || row.time_export_available !== first.time_export_available
    || row.review_items_available !== first.review_items_available
    || row.management_scope_kind !== first.management_scope_kind
  ) {
    throw new Error('Administration session rows are not authority-consistent');
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original infrastructure failure; releasing the client lets pg discard it if needed.
  }
}
