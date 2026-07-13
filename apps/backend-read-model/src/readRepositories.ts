import {
  CustomerId,
  MembershipId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  UserId,
  createNfcPayload,
  customerAssignmentTarget,
  type Customer,
  type Membership,
  type MembershipRole,
  type NfcAssignment,
  type NfcPayload,
  type NfcTag,
  type Organization,
} from '@taptime/core';
import type { PoolClient, QueryResult } from 'pg';
import type { TenantReadRepositories } from './types.js';

interface OrganizationRow {
  readonly id: string;
  readonly name: string;
}

interface MembershipRow {
  readonly id: string;
  readonly organization_id: string;
  readonly user_id: string;
  readonly role: string;
}

interface CustomerRow {
  readonly id: string;
  readonly organization_id: string;
  readonly active: boolean;
}

interface NfcTagRow {
  readonly id: string;
  readonly organization_id: string;
  readonly payload_value: string;
}

interface NfcAssignmentRow {
  readonly id: string;
  readonly organization_id: string;
  readonly nfc_tag_id: string;
  readonly target_type: string;
  readonly target_customer_id: string;
  readonly active: boolean;
}

export function createTenantReadRepositories(
  client: PoolClient,
  organizationId: OrganizationId,
  assertSessionActive: () => void,
): TenantReadRepositories {
  const organization = Object.freeze({
    async findById(id: OrganizationId): Promise<Organization | null> {
      assertSessionActive();
      // Organization is the tenant root and has no organization_id column; both IDs must match.
      const row = oneOrNull(await client.query<OrganizationRow>(
        `SELECT id, name
         FROM taptime_server.organizations
         WHERE id = $1::uuid
           AND id = $2::uuid`,
        [organizationId, id],
      ));
      return row === null ? null : { id: OrganizationId(row.id), name: row.name };
    },
  });

  const membership = Object.freeze({
    async findByUserId(userId: UserId): Promise<Membership | null> {
      assertSessionActive();
      const row = oneOrNull(await client.query<MembershipRow>(
        `SELECT id, organization_id, user_id, role
         FROM taptime_server.memberships
         WHERE organization_id = $1::uuid
           AND user_id = $2::uuid
           AND revoked_at IS NULL`,
        [organizationId, userId],
      ));
      if (row === null) {
        return null;
      }
      return {
        id: MembershipId(row.id),
        organizationId: OrganizationId(row.organization_id),
        userId: UserId(row.user_id),
        role: membershipRole(row.role),
      };
    },
  });

  const customer = Object.freeze({
    async findById(customerId: CustomerId): Promise<Customer | null> {
      assertSessionActive();
      const row = oneOrNull(await client.query<CustomerRow>(
        `SELECT id, organization_id, active
         FROM taptime_server.customers
         WHERE organization_id = $1::uuid
           AND id = $2::uuid`,
        [organizationId, customerId],
      ));
      return row === null
        ? null
        : {
            id: CustomerId(row.id),
            organizationId: OrganizationId(row.organization_id),
            active: row.active,
          };
    },
  });

  const nfcTag = Object.freeze({
    async findByPayload(payload: NfcPayload): Promise<NfcTag | null> {
      assertSessionActive();
      const row = oneOrNull(await client.query<NfcTagRow>(
        `SELECT id, organization_id, payload_value
         FROM taptime_server.nfc_tags
         WHERE organization_id = $1::uuid
           AND payload_value = $2`,
        [organizationId, payload],
      ));
      return row === null
        ? null
        : {
            id: NfcTagId(row.id),
            organizationId: OrganizationId(row.organization_id),
            payload: createNfcPayload(row.payload_value),
          };
    },
  });

  const nfcAssignment = Object.freeze({
    async findActiveByTagId(nfcTagId: NfcTagId): Promise<NfcAssignment | null> {
      assertSessionActive();
      const row = oneOrNull(await client.query<NfcAssignmentRow>(
        `SELECT id, organization_id, nfc_tag_id, target_type, target_customer_id, active
         FROM taptime_server.nfc_assignments
         WHERE organization_id = $1::uuid
           AND nfc_tag_id = $2::uuid
           AND active`,
        [organizationId, nfcTagId],
      ));
      if (row === null) {
        return null;
      }
      if (row.target_type !== 'customer') {
        throw new Error(`Unsupported persisted AssignmentTarget type: ${row.target_type}`);
      }
      return {
        id: NfcAssignmentId(row.id),
        organizationId: OrganizationId(row.organization_id),
        nfcTagId: NfcTagId(row.nfc_tag_id),
        target: customerAssignmentTarget(CustomerId(row.target_customer_id)),
        active: row.active,
      };
    },
  });

  return Object.freeze({ organization, membership, customer, nfcTag, nfcAssignment });
}

function oneOrNull<Row extends object>(result: QueryResult<Row>): Row | null {
  if (result.rows.length > 1) {
    throw new Error('Tenant-scoped repository query returned more than one row');
  }
  return result.rows[0] ?? null;
}

function membershipRole(value: string): MembershipRole {
  if (value === 'administrator' || value === 'employee') {
    return value;
  }
  throw new Error(`Unsupported persisted Membership role: ${value}`);
}
