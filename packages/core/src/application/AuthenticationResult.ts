import type { OrganizationId, UserId } from '../domain/ids';

// DT-013. Explicit, typed authentication outcome - never a thrown exception for an expected
// result, consistent with SynchronizationResult/EnqueueResult/BusinessEngineDecision's
// established pattern. No password flow, no user/role management: a rejection is always
// 'invalid_credentials' - there is nothing else this fake/local gateway can determine.
export type AuthenticationResult =
  | { readonly status: 'authenticated'; readonly userId: UserId; readonly organizationId: OrganizationId }
  | { readonly status: 'rejected'; readonly reason: 'invalid_credentials' };
