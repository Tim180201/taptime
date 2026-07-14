import { describe, expect, it, vi } from 'vitest';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { bootstrapRequestDigestV1 } from '../src/digest.js';
import { normalizeOrganizationNameV1 } from '../src/nameContract.js';
import { OrganizationBootstrapCoordinator } from '../src/OrganizationBootstrapCoordinator.js';
import type { BootstrapCapability } from '../src/types.js';

const whiteSpaceCodePoints = [
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x0085, 0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008,
  0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
];

describe('taptime-name-v1 Unicode 15.1 contract', () => {
  it.each(whiteSpaceCodePoints)('trims Unicode White_Space U+%s only at the edges', (codePoint) => {
    const whiteSpace = String.fromCodePoint(codePoint);
    expect(normalizeOrganizationNameV1(`${whiteSpace}TapTim.e${whiteSpace}`)).toEqual({
      status: 'valid',
      canonicalName: 'TapTim.e',
    });
  });

  it.each([
    ['Cc', 0x0000],
    ['Cf', 0x200d],
    ['Cs', 0xd800],
    ['Co', 0xe000],
    ['Cn-15.1', 0x0378],
    ['Zl', 0x2028],
    ['Zp', 0x2029],
    ['Unicode-16-assignment', 0x0897],
    ['Unicode-17-assignment', 0x1fae9],
  ])('rejects remaining prohibited category %s', (_category, codePoint) => {
    expect(normalizeOrganizationNameV1(`A${String.fromCodePoint(codePoint as number)}B`)).toEqual({
      status: 'invalid',
    });
  });

  it('normalizes to NFC before applying bounds', () => {
    expect(normalizeOrganizationNameV1('  Cafe\u0301  ')).toEqual({
      status: 'valid',
      canonicalName: 'Café',
    });
  });

  it.each([
    ['', 'invalid'],
    [' '.repeat(20), 'invalid'],
    ['a'.repeat(120), 'valid'],
    ['a'.repeat(121), 'invalid'],
    ['😀'.repeat(120), 'valid'],
    ['😀'.repeat(121), 'invalid'],
  ] as const)('enforces scalar and byte bounds for a representative value', (value, status) => {
    expect(normalizeOrganizationNameV1(value).status).toBe(status);
  });

  it('pins the bootstrap digest field framing and domain separator', () => {
    expect(bootstrapRequestDigestV1(
      'TapTim.e GmbH',
      'https://project.supabase.co/auth/v1',
      '6d35eaa2-44af-4d69-a280-9a5a7adca691',
    )).toBe('937b69e1ea5a062724a277eb15042346bf74a335e520b712a594fe0df6000773');
  });

  it('frames fields without delimiter ambiguity', () => {
    expect(bootstrapRequestDigestV1('ab', 'c', 'd')).not.toBe(
      bootstrapRequestDigestV1('a', 'bc', 'd'),
    );
  });
});

describe('OrganizationBootstrapCoordinator', () => {
  const success = {
    status: 'succeeded' as const,
    idempotentRetry: false,
    userId: '10000000-0000-4000-8000-000000000001',
    identityBindingId: '11000000-0000-4000-8000-000000000001',
    organizationId: '20000000-0000-4000-8000-000000000001',
    membershipId: '21000000-0000-4000-8000-000000000001',
  };

  it('passes only normalized name and verified issuer/subject to the database capability', async () => {
    const verify = vi.fn().mockResolvedValue({
      status: 'verified',
      identity: { issuer: 'https://issuer.invalid', subject: 'subject-a' },
    });
    const execute = vi.fn().mockResolvedValue(success);
    const coordinator = new OrganizationBootstrapCoordinator(
      { verify } satisfies AccessTokenVerifier,
      { execute } satisfies BootstrapCapability,
    );

    await expect(coordinator.bootstrap({
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationDisplayName: '  Cafe\u0301  ',
      accessToken: 'secret-token',
    })).resolves.toEqual(success);
    expect(execute).toHaveBeenCalledWith({
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      canonicalOrganizationName: 'Café',
      identity: { issuer: 'https://issuer.invalid', subject: 'subject-a' },
    });
    expect(JSON.stringify(execute.mock.calls)).not.toContain('secret-token');
  });

  it.each([
    ['not-a-uuid', 'TapTim.e', 'token'],
    ['AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA', 'TapTim.e', 'token'],
    ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '', 'token'],
    ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'TapTim.e', ''],
  ])('rejects malformed input before token verification', async (requestId, organizationDisplayName, accessToken) => {
    const verify = vi.fn();
    const execute = vi.fn();
    const coordinator = new OrganizationBootstrapCoordinator(
      { verify } satisfies AccessTokenVerifier,
      { execute } satisfies BootstrapCapability,
    );
    await expect(coordinator.bootstrap({ requestId, organizationDisplayName, accessToken })).resolves.toEqual({
      status: 'rejected',
      reason: 'invalid_request',
    });
    expect(verify).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not invoke the database capability for a rejected token', async () => {
    const execute = vi.fn();
    const coordinator = new OrganizationBootstrapCoordinator(
      { verify: vi.fn().mockResolvedValue({ status: 'rejected', reason: 'invalid_signature' }) },
      { execute },
    );
    await expect(coordinator.bootstrap({
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationDisplayName: 'TapTim.e',
      accessToken: 'rejected-token',
    })).resolves.toEqual({
      status: 'rejected',
      reason: 'access_token_rejected',
      tokenReason: 'invalid_signature',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['verifier', 'capability'])('maps %s infrastructure failures to one fixed result', async (source) => {
    const verifier = {
      verify: source === 'verifier'
        ? vi.fn().mockRejectedValue(new Error('sensitive-provider-detail'))
        : vi.fn().mockResolvedValue({ status: 'verified', identity: { issuer: 'issuer', subject: 'subject' } }),
    };
    const capability = {
      execute: source === 'capability'
        ? vi.fn().mockRejectedValue(new Error('sensitive-database-detail'))
        : vi.fn(),
    };
    await expect(new OrganizationBootstrapCoordinator(verifier, capability).bootstrap({
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      organizationDisplayName: 'TapTim.e',
      accessToken: 'token',
    })).resolves.toEqual({ status: 'unavailable', reason: 'service_unavailable' });
  });
});
