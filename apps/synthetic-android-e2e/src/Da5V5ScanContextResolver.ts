import { randomUUID } from 'node:crypto';
import type {
  ScanContextResolution,
  ScanContextResolutionCommand,
  ScanContextResolver,
} from '@taptime/backend-api';
import { B3_SCHEMA } from '@taptime/backend-schema';
import type { NfcPayload } from '@taptime/core';
import type { Pool, PoolClient } from 'pg';
import { fingerprint } from './FingerprintProvisioningScanContextResolver.js';
import {
  DA5_V5_PUBLIC_MANIFEST,
  type Da5V5TagBinding,
} from './Da5V5Profile.js';
import { da5V5Ids, syntheticIds } from './constants.js';

export type Da5V5ScanSafeEvent =
  | 'da5_v5_tag_b_registration_armed'
  | 'da5_v5_tag_b_registration_fingerprint_mismatch'
  | 'da5_v5_tag_b_registered_unassigned';

type RegistrationState =
  | 'disarmed'
  | 'armed'
  | 'registering'
  | 'registered'
  | 'failed';

export interface Da5V5TagRoleState {
  readonly activeTagAAssignments: number;
  readonly activeTagACustomerAAssignments: number;
  readonly activeTagBAssignments: number;
  readonly tagAExactRecords: number;
  readonly tagARecords: number;
  readonly tagBExactRecords: number;
  readonly tagBRecords: number;
  readonly tagBTotalAssignments: number;
  readonly tagXRecords: number;
}

export class Da5V5ScanContextResolver implements ScanContextResolver {
  private registrationState: RegistrationState = 'disarmed';

  constructor(
    private readonly delegate: ScanContextResolver,
    private readonly fixturePool: Pool,
    private readonly binding: Da5V5TagBinding,
    private readonly onSafeEvent: (event: Da5V5ScanSafeEvent) => void = () => undefined,
  ) {}

  armTagBRegistration(): void {
    if (this.registrationState !== 'disarmed') {
      throw new Error('DA5 V5 Tag-B registration cannot be armed');
    }
    this.registrationState = 'armed';
    this.onSafeEvent('da5_v5_tag_b_registration_armed');
  }

  state(): RegistrationState {
    return this.registrationState;
  }

  async roleState(): Promise<Da5V5TagRoleState> {
    const result = await this.fixturePool.query<{
      active_tag_a_assignments: string;
      active_tag_a_customer_a_assignments: string;
      active_tag_b_assignments: string;
      tag_a_records: string;
      tag_a_exact_records: string;
      tag_b_exact_records: string;
      tag_b_records: string;
      tag_b_total_assignments: string;
      tag_x_records: string;
    }>(
      `SELECT
         count(DISTINCT tag.id) FILTER (
           WHERE tag.validation_fingerprint = $1
         )::text AS tag_a_records,
         count(DISTINCT tag.id) FILTER (
           WHERE tag.validation_fingerprint = $1
             AND tag.display_name = $8
         )::text AS tag_a_exact_records,
         count(DISTINCT tag.id) FILTER (
           WHERE tag.validation_fingerprint = $2
         )::text AS tag_b_records,
         count(DISTINCT tag.id) FILTER (
           WHERE tag.validation_fingerprint = $3
         )::text AS tag_x_records,
         count(*) FILTER (
           WHERE tag.validation_fingerprint = $1 AND assignment.active
         )::text AS active_tag_a_assignments,
         count(*) FILTER (
           WHERE tag.validation_fingerprint = $1
             AND assignment.active
             AND assignment.target_type = 'customer'
             AND assignment.target_customer_id = $5
         )::text AS active_tag_a_customer_a_assignments,
         count(*) FILTER (
           WHERE tag.validation_fingerprint = $2 AND assignment.active
         )::text AS active_tag_b_assignments,
         count(DISTINCT tag.id) FILTER (
           WHERE tag.validation_fingerprint = $2
             AND tag.id = $6
             AND tag.display_name = $7
         )::text AS tag_b_exact_records,
         count(assignment.id) FILTER (
           WHERE tag.validation_fingerprint = $2
         )::text AS tag_b_total_assignments
       FROM ${B3_SCHEMA}.nfc_tags AS tag
       LEFT JOIN ${B3_SCHEMA}.nfc_assignments AS assignment
         ON assignment.organization_id = tag.organization_id
        AND assignment.nfc_tag_id = tag.id
       WHERE tag.organization_id = $4`,
      [
        this.binding.tagA,
        this.binding.tagB,
        this.binding.tagX,
        syntheticIds.organization,
        syntheticIds.customer,
        da5V5Ids.tagB,
        DA5_V5_PUBLIC_MANIFEST.tagBLabel,
        DA5_V5_PUBLIC_MANIFEST.tagALabel,
      ],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error('DA5 V5 Tag role query returned no result');
    }
    return Object.freeze({
      activeTagAAssignments: Number(row.active_tag_a_assignments),
      activeTagACustomerAAssignments: Number(row.active_tag_a_customer_a_assignments),
      activeTagBAssignments: Number(row.active_tag_b_assignments),
      tagAExactRecords: Number(row.tag_a_exact_records),
      tagARecords: Number(row.tag_a_records),
      tagBExactRecords: Number(row.tag_b_exact_records),
      tagBRecords: Number(row.tag_b_records),
      tagBTotalAssignments: Number(row.tag_b_total_assignments),
      tagXRecords: Number(row.tag_x_records),
    });
  }

  async resolve(command: ScanContextResolutionCommand): Promise<ScanContextResolution> {
    const resolution = await this.delegate.resolve(command);
    if (resolution.status !== 'not_resolved' || this.registrationState !== 'armed') {
      return resolution;
    }
    const observedFingerprint = fingerprint(command.payload);
    if (observedFingerprint !== this.binding.tagB) {
      this.registrationState = 'failed';
      this.onSafeEvent('da5_v5_tag_b_registration_fingerprint_mismatch');
      return resolution;
    }
    this.registrationState = 'registering';
    try {
      await registerUnassignedTagB(this.fixturePool, command.payload);
      this.registrationState = 'registered';
      this.onSafeEvent('da5_v5_tag_b_registered_unassigned');
      return resolution;
    } catch (error) {
      this.registrationState = 'failed';
      throw error;
    }
  }
}

async function registerUnassignedTagB(pool: Pool, payload: NfcPayload): Promise<void> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    transactionOpen = true;
    const existing = await client.query<{ validation_fingerprint: string }>(
      `SELECT validation_fingerprint
       FROM ${B3_SCHEMA}.nfc_tags
       WHERE organization_id = $1
         AND (id = $2 OR validation_fingerprint = $3)`,
      [
        syntheticIds.organization,
        da5V5Ids.tagB,
        fingerprint(payload),
      ],
    );
    if (existing.rowCount !== 0) {
      throw new Error('DA5 V5 Tag-B registration requires a fresh unassigned role');
    }
    await client.query(
      `INSERT INTO ${B3_SCHEMA}.nfc_tags
         (id, organization_id, display_name, payload_value)
       VALUES ($1, $2, $3, $4)`,
      [
        da5V5Ids.tagB,
        syntheticIds.organization,
        DA5_V5_PUBLIC_MANIFEST.tagBLabel,
        payload,
      ],
    );
    await appendFixtureAudit(
      client,
      'Da5V5FixtureTagBRegistered',
      'NfcTag',
      da5V5Ids.tagB,
    );
    await client.query('COMMIT');
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      await rollback(client);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function appendFixtureAudit(
  client: PoolClient,
  eventType: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO ${B3_SCHEMA}.audit_events (
       id, organization_id, actor_user_id, event_type, entity_type, entity_id,
       occurred_at, correlation_id, payload
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       pg_catalog.transaction_timestamp(), $7,
       '{"fixture":"da5-v5-protected-review"}'::jsonb
     )`,
    [
      randomUUID(),
      syntheticIds.organization,
      syntheticIds.administratorUser,
      eventType,
      entityType,
      entityId,
      `da5-v5-fixture-${randomUUID()}`,
    ],
  );
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original fixture failure.
  }
}
