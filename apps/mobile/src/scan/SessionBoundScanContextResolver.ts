import { OrganizationId, type NfcPayload } from '@taptime/core';
import type {
  ScanContextApiPort,
  ScanContextResolutionResult,
} from '../transport/contracts';
import type {
  ProductScanContextResolutionCommand,
  ProductScanContextResolutionResult,
  ProductScanContextResolver,
} from './ProductScanContextResolver';
import type { ProductScanSessionSnapshot } from './contracts';
import {
  copyFrozenProductScanSessionSnapshot,
  sameProductScanSessionSnapshot,
} from './sessionSnapshot';

type ResolvedScanContext = Extract<ScanContextResolutionResult, { status: 'resolved' }>;

interface CachedScanContext {
  readonly session: ProductScanSessionSnapshot;
  readonly payload: NfcPayload;
  readonly resolution: Readonly<ResolvedScanContext>;
}

/**
 * Holds one positive server resolution for the exact running authenticated session.
 *
 * The slot is volatile lookup evidence only. Every resolution still attempts the live server first,
 * and only an explicitly transient transport result can use the exact cached payload/session pair.
 */
export class SessionBoundScanContextResolver implements ProductScanContextResolver {
  private slot: Readonly<CachedScanContext> | null = null;
  private clearGeneration = 0;

  constructor(private readonly live: ScanContextApiPort) {}

  async resolve(
    command: ProductScanContextResolutionCommand,
  ): Promise<ProductScanContextResolutionResult> {
    const clearGeneration = this.clearGeneration;
    let liveResult: ScanContextResolutionResult;
    try {
      liveResult = await this.live.resolve({
        organizationId: OrganizationId(command.session.session.organizationId),
        payload: command.payload,
      });
    } catch {
      this.clear();
      return unavailableResult();
    }

    switch (liveResult.status) {
      case 'resolved': {
        const resolution = copyFrozenResolution(liveResult);
        // A session transition/runtime stop may clear the resolver while a live request is in
        // flight. The stale completion may finish its caller, but it must never repopulate the slot.
        if (clearGeneration === this.clearGeneration) {
          this.slot = Object.freeze({
            session: copyFrozenProductScanSessionSnapshot(command.session),
            payload: command.payload,
            resolution,
          });
        }
        return withSource(resolution, 'live');
      }
      case 'transient_failure': {
        const cached = this.slot;
        return cached !== null
          && cached.payload === command.payload
          && sameProductScanSessionSnapshot(cached.session, command.session)
          ? withSource(cached.resolution, 'session_cache')
          : transientFailureResult();
      }
      case 'not_resolved':
        if (this.slotMatches(command)) {
          this.clear();
        }
        return notResolvedResult();
      case 'authority_rejected':
        this.clear();
        return authorityRejectedResult();
      case 'unavailable':
        this.clear();
        return unavailableResult();
      default:
        return liveResult satisfies never;
    }
  }

  clear(): void {
    this.slot = null;
    this.clearGeneration += 1;
  }

  private slotMatches(command: ProductScanContextResolutionCommand): boolean {
    return this.slot !== null
      && this.slot.payload === command.payload
      && sameProductScanSessionSnapshot(this.slot.session, command.session);
  }
}

function copyFrozenResolution(resolution: ResolvedScanContext): Readonly<ResolvedScanContext> {
  return Object.freeze({
    status: 'resolved',
    assignmentId: resolution.assignmentId,
    nfcTagId: resolution.nfcTagId,
    target: Object.freeze({ ...resolution.target }),
  });
}

function withSource(
  resolution: Readonly<ResolvedScanContext>,
  source: 'live' | 'session_cache',
): Extract<ProductScanContextResolutionResult, { status: 'resolved' }> {
  return Object.freeze({ ...resolution, source });
}

function transientFailureResult(): Extract<
  ProductScanContextResolutionResult,
  { status: 'transient_failure' }
> {
  return Object.freeze({ status: 'transient_failure' });
}

function notResolvedResult(): Extract<
  ProductScanContextResolutionResult,
  { status: 'not_resolved' }
> {
  return Object.freeze({ status: 'not_resolved' });
}

function authorityRejectedResult(): Extract<
  ProductScanContextResolutionResult,
  { status: 'authority_rejected' }
> {
  return Object.freeze({ status: 'authority_rejected' });
}

function unavailableResult(): Extract<
  ProductScanContextResolutionResult,
  { status: 'unavailable' }
> {
  return Object.freeze({ status: 'unavailable' });
}
