// TTAP-001 Value Object. 'synchronized' and 'failed' are named here per TTAP-001, but are
// only set by the future Synchronization Service (DT-008, out of scope for this sprint).
export type SyncState = 'pending' | 'synchronized' | 'failed';
