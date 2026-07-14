import type { NfcPayload } from '@taptime/core';
import type { ScanContextResolutionResult } from '../transport/contracts';
import type { ProductScanSessionSnapshot } from './contracts';

export interface ProductScanContextResolutionCommand {
  readonly session: ProductScanSessionSnapshot;
  readonly payload: NfcPayload;
}

type ResolvedScanContext = Extract<ScanContextResolutionResult, { status: 'resolved' }>;

export type ProductScanContextResolutionResult =
  | (ResolvedScanContext & { readonly source: 'live' | 'session_cache' })
  | Exclude<ScanContextResolutionResult, ResolvedScanContext>;

/** Private product capability. It never reaches React or the HTTP request body. */
export interface ProductScanContextResolver {
  resolve(
    command: ProductScanContextResolutionCommand,
  ): Promise<ProductScanContextResolutionResult>;
  clear(): void;
}
