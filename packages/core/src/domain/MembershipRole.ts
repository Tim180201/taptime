// DT-018 (TS-002 Domain Model). A value, not an entity - mirrors the existing
// string-literal-union idiom already used for AssignmentTarget.targetType and
// SyncState/ErrorCategory. Administrator and Employee are Membership Roles, not standalone
// domain objects (FB-002 Technical Lead Review Follow-up).
export type MembershipRole = 'administrator' | 'employee';
