import { createHash, randomUUID } from 'node:crypto';
import type {
  ScanContextResolution,
  ScanContextResolutionCommand,
  ScanContextResolver,
} from '@taptime/backend-api';
import type { NfcPayload } from '@taptime/core';
import type { Pool, PoolClient } from 'pg';
import { syntheticIds } from './constants.js';

export type SyntheticSafeEvent =
  | 'assignment_armed'
  | 'assignment_fingerprint_mismatch'
  | 'tag_a_assigned';

type ProvisioningState =
  | { readonly status: 'disarmed' }
  | { readonly status: 'armed'; readonly expectedFingerprint: string }
  | { readonly status: 'provisioning'; readonly expectedFingerprint: string };

export class FingerprintProvisioningScanContextResolver implements ScanContextResolver {
  private state: ProvisioningState = { status: 'disarmed' };

  constructor(
    private readonly delegate: ScanContextResolver,
    private readonly provisionerPool: Pool,
    private readonly onSafeEvent: (event: SyntheticSafeEvent) => void = () => undefined,
  ) {}

  armTagA(expectedFingerprint: string): void {
    if (!/^[0-9A-F]{12}$/.test(expectedFingerprint)) {
      throw new Error('Tag-A fingerprint must be exactly 12 uppercase hexadecimal characters');
    }
    if (this.state.status !== 'disarmed') {
      throw new Error('A synthetic Tag-A assignment is already armed or running');
    }
    this.state = { status: 'armed', expectedFingerprint };
    this.onSafeEvent('assignment_armed');
  }

  getState(): 'armed' | 'disarmed' | 'provisioning' {
    return this.state.status;
  }

  async resolve(command: ScanContextResolutionCommand): Promise<ScanContextResolution> {
    const resolution = await this.delegate.resolve(command);
    if (resolution.status !== 'not_resolved') {
      return resolution;
    }
    await this.captureForProvisioning(command.payload);
    // A provisioning capture is deliberately not a lifecycle capture. The real Mobile client sees
    // the ordinary disclosure-safe not-resolved result and therefore creates no WorkEvent.
    return resolution;
  }

  private async captureForProvisioning(payload: NfcPayload): Promise<void> {
    const state = this.state;
    if (state.status !== 'armed') {
      return;
    }
    if (fingerprint(payload) !== state.expectedFingerprint) {
      this.onSafeEvent('assignment_fingerprint_mismatch');
      return;
    }

    this.state = { status: 'provisioning', expectedFingerprint: state.expectedFingerprint };
    try {
      await provisionTagA(this.provisionerPool, payload);
      this.state = { status: 'disarmed' };
      this.onSafeEvent('tag_a_assigned');
    } catch (error) {
      this.state = state;
      throw error;
    }
  }
}

export function fingerprint(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 12).toUpperCase();
}

async function provisionTagA(pool: Pool, payload: NfcPayload): Promise<void> {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    transactionOpen = true;
    await setAdministratorContext(client);
    await client.query('SET LOCAL ROLE taptime_administrator');
    await client.query(
      `INSERT INTO taptime_server.nfc_tags
         (id, organization_id, display_name, payload_value)
       VALUES ($1, $2, 'Synthetic Android Tag A', $3)`,
      [syntheticIds.tagA, syntheticIds.organization, payload],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_assignments
         (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
       VALUES ($1, $2, $3, 'customer', $4, true)`,
      [
        syntheticIds.assignmentA,
        syntheticIds.organization,
        syntheticIds.tagA,
        syntheticIds.customer,
      ],
    );
    await client.query('COMMIT');
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      await rollbackPreservingOriginalError(client);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function setAdministratorContext(client: PoolClient): Promise<void> {
  await client.query(
    `SELECT
       set_config('app.user_id', $1, true),
       set_config('app.organization_id', $2, true),
       set_config('app.membership_id', $3, true),
       set_config('app.membership_role', 'administrator', true),
       set_config('app.correlation_id', $4, true)`,
    [
      syntheticIds.administratorUser,
      syntheticIds.organization,
      syntheticIds.administratorMembership,
      `synthetic-e2e-provision-${randomUUID()}`,
    ],
  );
}

async function rollbackPreservingOriginalError(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original RLS, constraint, audit, or infrastructure failure.
  }
}
