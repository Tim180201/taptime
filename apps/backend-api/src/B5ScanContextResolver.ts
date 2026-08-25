import type { TenantReadSessionCoordinator } from '@taptime/backend-read-model';
import type {
  ResolvedScanContext,
  ScanContextResolution,
  ScanContextResolutionCommand,
  ScanContextResolver,
} from './types.js';
import { isBreakNfcAssignment } from '@taptime/core';

/**
 * Resolves the narrow C2 scan projection entirely inside B5's expiring, read-only tenant session.
 * Missing, inactive, or tenant-inaccessible rows deliberately collapse to one not-resolved result.
 */
export class B5ScanContextResolver implements ScanContextResolver {
  constructor(private readonly coordinator: TenantReadSessionCoordinator) {}

  async resolve(command: ScanContextResolutionCommand): Promise<ScanContextResolution> {
    const result = await this.coordinator.run(
      {
        accessToken: command.accessToken,
        requestedOrganizationId: command.requestedOrganizationId,
      },
      async (repositories): Promise<ResolvedScanContext | null> => {
        const tag = await repositories.nfcTag.findByPayload(command.payload);
        if (tag === null || tag.payload !== command.payload) {
          return null;
        }

        const assignment = await repositories.nfcAssignment.findActiveByTagId(tag.id);
        if (
          assignment === null
          || !assignment.active
          || assignment.nfcTagId !== tag.id
        ) {
          return null;
        }

        if (isBreakNfcAssignment(assignment)) {
          return Object.freeze({
            assignmentId: assignment.id,
            nfcTagId: tag.id,
            subject: Object.freeze({ type: 'break' as const }),
          });
        }

        const customer = await repositories.customer.findById(assignment.target.targetId);
        if (customer === null || !customer.active) {
          return null;
        }

        return Object.freeze({
          assignmentId: assignment.id,
          nfcTagId: tag.id,
          subject: Object.freeze({
            type: 'work' as const,
            target: Object.freeze({ ...assignment.target }),
          }),
        });
      },
    );

    if (result.status === 'rejected') {
      return { status: 'rejected' };
    }
    if (result.value === null) {
      return { status: 'not_resolved' };
    }
    return { status: 'resolved', context: result.value };
  }
}
