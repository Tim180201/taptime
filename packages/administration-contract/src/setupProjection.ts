const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const setupCursor = /^v1:[ct]:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validationFingerprint = /^[A-F0-9]{12}$/;

export interface AdministrationSetupOrganization {
  readonly id: string;
  readonly name: string;
}

export interface AdministrationSetupCustomer {
  readonly id: string;
  readonly displayName: string;
  readonly active: boolean;
}

export type AdministrationSetupNfcTag =
  | {
      readonly id: string;
      readonly displayName: string;
      readonly validationFingerprint: string;
      readonly assignmentState: 'assigned';
      readonly assignmentType: 'work';
      readonly targetCustomerId: string;
      readonly activeAssignmentId: string;
    }
  | {
      readonly id: string;
      readonly displayName: string;
      readonly validationFingerprint: string;
      readonly assignmentState: 'assigned';
      readonly assignmentType: 'break';
      readonly targetCustomerId: null;
      readonly activeAssignmentId: string;
    }
  | {
      readonly id: string;
      readonly displayName: string;
      readonly validationFingerprint: string;
      readonly assignmentState: 'unassigned';
      readonly assignmentType: null;
      readonly targetCustomerId: null;
      readonly activeAssignmentId: null;
    };

export interface AdministrationSetupProjectionSource {
  readonly organization: AdministrationSetupOrganization;
  readonly customers: readonly AdministrationSetupCustomer[];
  readonly nfcTags: readonly AdministrationSetupNfcTag[];
  readonly nextCursor: string | null;
}

export interface AdministrationSetupProjectionV1Response {
  readonly status: 'succeeded';
  readonly organization: AdministrationSetupOrganization;
  readonly customers: readonly AdministrationSetupCustomer[];
  readonly nfcTags: readonly AdministrationSetupNfcTag[];
  readonly nextCursor: string | null;
}

export interface AdministrationSetupProjectionV2Response {
  readonly status: 'succeeded';
  readonly organization: AdministrationSetupOrganization;
  readonly customers: readonly AdministrationSetupCustomer[];
  readonly nfcTags: readonly AdministrationSetupNfcTag[];
  readonly nextCursor: string | null;
}

export interface ParsedAdministrationSetupProjectionV2
  extends AdministrationSetupProjectionSource {
  readonly customersComplete: boolean;
  readonly nfcTagsComplete: boolean;
}

export function serializeAdministrationSetupProjectionV1(
  source: AdministrationSetupProjectionSource,
): AdministrationSetupProjectionV1Response {
  return {
    status: 'succeeded',
    organization: { id: source.organization.id, name: source.organization.name },
    customers: source.customers.map((customer) => ({
      id: customer.id,
      displayName: customer.displayName,
      active: customer.active,
    })),
    nfcTags: source.nfcTags.map((nfcTag) => ({
      id: nfcTag.id,
      displayName: nfcTag.displayName,
      validationFingerprint: nfcTag.validationFingerprint,
      assignmentState: nfcTag.assignmentState,
      assignmentType: nfcTag.assignmentType,
      targetCustomerId: nfcTag.targetCustomerId,
      activeAssignmentId: nfcTag.activeAssignmentId,
    })) as readonly AdministrationSetupNfcTag[],
    nextCursor: source.nextCursor,
  };
}

export function serializeAdministrationSetupProjectionV2(
  source: AdministrationSetupProjectionSource,
): AdministrationSetupProjectionV2Response {
  const response: AdministrationSetupProjectionV2Response = {
    status: 'succeeded',
    organization: { id: source.organization.id, name: source.organization.name },
    customers: source.customers.map((customer) => ({
      id: customer.id,
      displayName: customer.displayName,
      active: customer.active,
    })),
    nfcTags: source.nfcTags.map((nfcTag) => ({
      id: nfcTag.id,
      displayName: nfcTag.displayName,
      validationFingerprint: nfcTag.validationFingerprint,
      assignmentState: nfcTag.assignmentState,
      assignmentType: nfcTag.assignmentType,
      targetCustomerId: nfcTag.targetCustomerId,
      activeAssignmentId: nfcTag.activeAssignmentId,
    })) as readonly AdministrationSetupNfcTag[],
    nextCursor: source.nextCursor,
  };
  const parsed = parseAdministrationSetupProjectionV2(response);
  if (
    parsed === null
    || !parsed.customersComplete
    || !parsed.nfcTagsComplete
    || parsed.customers.length !== source.customers.length
    || parsed.nfcTags.length !== source.nfcTags.length
  ) {
    throw new TypeError('Administration setup projection violates its v2 response contract');
  }
  return response;
}

export function parseAdministrationSetupProjectionV2(
  value: unknown,
): ParsedAdministrationSetupProjectionV2 | null {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['status', 'organization', 'customers', 'nfcTags', 'nextCursor'])
    || value.status !== 'succeeded'
    || !isRecord(value.organization)
    || !hasExactKeys(value.organization, ['id', 'name'])
    || !canonicalUuid.test(String(value.organization.id))
    || typeof value.organization.name !== 'string'
    || !Array.isArray(value.customers)
    || !Array.isArray(value.nfcTags)
    || !(value.nextCursor === null
      || (typeof value.nextCursor === 'string' && setupCursor.test(value.nextCursor)))
  ) return null;

  const customerRows = value.customers.map(parseCustomer);
  const nfcTagRows = value.nfcTags.map(parseNfcTag);
  const customers = customerRows.filter(isPresent);
  const nfcTags = nfcTagRows.filter(isPresent);
  return Object.freeze({
    organization: Object.freeze({
      id: String(value.organization.id),
      name: value.organization.name,
    }),
    customers: Object.freeze(customers),
    nfcTags: Object.freeze(nfcTags),
    nextCursor: value.nextCursor,
    customersComplete: customers.length === customerRows.length,
    nfcTagsComplete: nfcTags.length === nfcTagRows.length,
  });
}

function parseCustomer(value: unknown): AdministrationSetupCustomer | null {
  return isRecord(value)
    && hasExactKeys(value, ['id', 'displayName', 'active'])
    && canonicalUuid.test(String(value.id))
    && typeof value.displayName === 'string'
    && typeof value.active === 'boolean'
    ? Object.freeze({ id: String(value.id), displayName: value.displayName, active: value.active })
    : null;
}

function parseNfcTag(value: unknown): AdministrationSetupNfcTag | null {
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      'id', 'displayName', 'validationFingerprint', 'assignmentState', 'assignmentType',
      'targetCustomerId', 'activeAssignmentId',
    ])
    || !canonicalUuid.test(String(value.id))
    || typeof value.displayName !== 'string'
    || !validationFingerprint.test(String(value.validationFingerprint))
  ) return null;
  const common = {
    id: String(value.id),
    displayName: value.displayName,
    validationFingerprint: String(value.validationFingerprint),
  };
  if (
    value.assignmentState === 'assigned'
    && value.assignmentType === 'work'
    && canonicalUuid.test(String(value.targetCustomerId))
    && canonicalUuid.test(String(value.activeAssignmentId))
  ) {
    return Object.freeze({
      ...common,
      assignmentState: 'assigned',
      assignmentType: 'work',
      targetCustomerId: String(value.targetCustomerId),
      activeAssignmentId: String(value.activeAssignmentId),
    });
  }
  if (
    value.assignmentState === 'assigned'
    && value.assignmentType === 'break'
    && value.targetCustomerId === null
    && canonicalUuid.test(String(value.activeAssignmentId))
  ) {
    return Object.freeze({
      ...common,
      assignmentState: 'assigned',
      assignmentType: 'break',
      targetCustomerId: null,
      activeAssignmentId: String(value.activeAssignmentId),
    });
  }
  if (
    value.assignmentState === 'unassigned'
    && value.assignmentType === null
    && value.targetCustomerId === null
    && value.activeAssignmentId === null
  ) {
    return Object.freeze({
      ...common,
      assignmentState: 'unassigned',
      assignmentType: null,
      targetCustomerId: null,
      activeAssignmentId: null,
    });
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
}

function isPresent<Value>(value: Value | null): value is Value {
  return value !== null;
}
