import { createHash } from 'node:crypto';

const domain = Buffer.concat([Buffer.from('taptime:c3:v1', 'ascii'), Buffer.from([0])]);

export function bootstrapRequestDigestV1(
  canonicalOrganizationName: string,
  verifiedIssuer: string,
  verifiedSubject: string,
): string {
  return createHash('sha256')
    .update(domain)
    .update(encodeField('bootstrapOrganization'))
    .update(encodeField(canonicalOrganizationName))
    .update(encodeField(verifiedIssuer))
    .update(encodeField(verifiedSubject))
    .digest('hex');
}

function encodeField(value: string): Buffer {
  const encoded = Buffer.from(value, 'utf8');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(encoded.length);
  return Buffer.concat([length, encoded]);
}
