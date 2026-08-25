import type { AssignmentTarget, NfcPayload } from '@taptime/core';
import type { ScanContextResolutionResult } from '../transport/contracts';
import type { ProductScanSessionSnapshot } from './contracts';

export interface ProductScanContextResolutionCommand {
  readonly session: ProductScanSessionSnapshot;
  readonly payload: NfcPayload;
}

type ResolvedScanContext = Extract<ScanContextResolutionResult, { status: 'resolved' }>;
export type ResolvedProductScanContext = {
  readonly status: 'resolved';
  readonly assignmentId: ResolvedScanContext['assignmentId'];
  readonly nfcTagId: ResolvedScanContext['nfcTagId'];
} & (
  | {
      readonly subject: { readonly type: 'work'; readonly target: AssignmentTarget };
      readonly target: AssignmentTarget;
    }
  | { readonly subject: { readonly type: 'break' }; readonly target?: never }
);

export type ProductScanContextResolutionResult =
  | (ResolvedProductScanContext & { readonly source: 'live' | 'session_cache' })
  | Exclude<ScanContextResolutionResult, ResolvedScanContext>;

/** Private product capability. It never reaches React or the HTTP request body. */
export interface ProductScanContextResolver {
  resolve(
    command: ProductScanContextResolutionCommand,
  ): Promise<ProductScanContextResolutionResult>;
  clear(): void;
}
