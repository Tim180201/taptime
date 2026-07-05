// DT-008. Explicit, typed synchronization outcome - never a thrown exception for an expected
// result, consistent with BusinessEngineDecision/EnqueueResult's established pattern. 'conflict'
// is a distinct outcome from 'retryable_failure', never collapsed into one case.
export type SynchronizationResult =
  | { readonly status: 'synchronized' }
  | { readonly status: 'retryable_failure'; readonly reason: string }
  | { readonly status: 'conflict'; readonly reason: string };
