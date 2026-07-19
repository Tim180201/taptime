import type {
  OfflineLocalStoreResult,
} from '@taptime/offline-sync-contract';
import type {
  LifecycleEvidenceOutbox,
  StoredLifecycleEvidence,
} from '../scan/LifecycleEvidenceOutbox';
import { OfflineCaptureDatabase } from './OfflineCaptureDatabase';

export class LegacyLifecycleEvidenceImporter {
  constructor(
    private readonly outbox: LifecycleEvidenceOutbox,
    private readonly database: OfflineCaptureDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async importOnce(): Promise<OfflineLocalStoreResult> {
    let evidence: StoredLifecycleEvidence | null;
    try {
      evidence = await this.outbox.read();
    } catch {
      return { status: 'protected', reason: 'legacy_clear_ambiguous' };
    }
    if (evidence === null) {
      return await this.database.hasProtectedLegacy()
        ? { status: 'protected', reason: 'review_predecessor' }
        : { status: 'ready' };
    }

    const imported = evidence.kind === 'replayable'
      ? await this.database.importLegacyReplayable(evidence.submission)
      : await this.database.importProtectedLegacy(
          evidence.command.workEvent.id,
          serializeProtectedEvidence(evidence),
          this.now().toISOString(),
        );
    if (imported.status !== 'ready') return imported;

    const exact = evidence.kind === 'replayable'
      ? await this.database.verifyLegacyReplayable(evidence.submission)
      : await this.database.verifyProtectedLegacy(
          evidence.command.workEvent.id,
          serializeProtectedEvidence(evidence),
        );
    if (!exact) {
      return { status: 'protected', reason: 'legacy_clear_ambiguous' };
    }
    try {
      await this.outbox.clear(evidence);
    } catch {
      return { status: 'protected', reason: 'legacy_clear_ambiguous' };
    }
    return evidence.kind === 'protected_v1'
      ? { status: 'protected', reason: 'review_predecessor' }
      : { status: 'ready' };
  }
}

function serializeProtectedEvidence(
  evidence: Extract<StoredLifecycleEvidence, { kind: 'protected_v1' }>,
): string {
  return JSON.stringify({
    version: 1,
    binding: evidence.binding,
    command: evidence.command,
  });
}
