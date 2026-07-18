import { createHash } from 'node:crypto';

const domain = Buffer.concat([Buffer.from('taptime:c3:v1', 'ascii'), Buffer.from([0])]);

export function bootstrapRequestDigestV1(
  canonicalOrganizationName: string,
  verifiedIssuer: string,
  verifiedSubject: string,
): string {
  return tupleDigest([
    'bootstrapOrganization',
    canonicalOrganizationName,
    verifiedIssuer,
    verifiedSubject,
  ]);
}

export function createCustomerCommandDigestV1(
  organizationId: string,
  actorUserId: string,
  expectedMembershipId: string,
  canonicalDisplayName: string,
): string {
  return tupleDigest([
    'createCustomer',
    organizationId,
    actorUserId,
    expectedMembershipId,
    canonicalDisplayName,
  ]);
}

export function provisionNfcTagCommandDigestV1(
  organizationId: string,
  actorUserId: string,
  expectedMembershipId: string,
  customerId: string,
  canonicalDisplayName: string,
  canonicalPayload: string,
): string {
  return tupleDigest([
    'provisionNfcTag',
    organizationId,
    actorUserId,
    expectedMembershipId,
    customerId,
    canonicalDisplayName,
    canonicalPayload,
  ]);
}

export function reassignNfcTagCommandDigestV1(
  organizationId: string,
  actorUserId: string,
  expectedMembershipId: string,
  nfcTagId: string,
  expectedActiveAssignmentId: string,
  targetCustomerId: string,
): string {
  return tupleDigest([
    'reassignNfcTag',
    organizationId,
    actorUserId,
    expectedMembershipId,
    nfcTagId,
    expectedActiveAssignmentId,
    targetCustomerId,
  ]);
}

function tupleDigest(fields: readonly string[]): string {
  const hash = createHash('sha256').update(domain);
  for (const field of fields) {
    hash.update(encodeField(field));
  }
  return hash.digest('hex');
}

function encodeField(value: string): Buffer {
  const encoded = Buffer.from(value, 'utf8');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(encoded.length);
  return Buffer.concat([length, encoded]);
}
