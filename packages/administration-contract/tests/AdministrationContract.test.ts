import { describe, expect, it } from 'vitest';
import {
  bootstrapRequestDigestV1,
  createCustomerCommandDigestV1,
  normalizeCustomerNameV1,
  normalizeNfcTagNameV1,
  normalizeOrganizationNameV1,
  provisionNfcTagCommandDigestV1,
  reassignNfcTagCommandDigestV1,
} from '../src/index.js';

describe('neutral C3 administration contract', () => {
  it('shares the established C3B digest golden vector', () => {
    expect(bootstrapRequestDigestV1(
      'TapTim.e GmbH',
      'https://project.supabase.co/auth/v1',
      '6d35eaa2-44af-4d69-a280-9a5a7adca691',
    )).toBe('937b69e1ea5a062724a277eb15042346bf74a335e520b712a594fe0df6000773');
  });

  it('normalizes customer and tag labels with their separate bounds', () => {
    expect(normalizeOrganizationNameV1('  TapTim.e GmbH  ')).toEqual({
      status: 'valid',
      canonicalName: 'TapTim.e GmbH',
    });
    expect(normalizeCustomerNameV1('  Cafe\u0301  ')).toEqual({
      status: 'valid',
      canonicalName: 'Café',
    });
    expect(normalizeCustomerNameV1('C'.repeat(120)).status).toBe('valid');
    expect(normalizeCustomerNameV1('C'.repeat(121)).status).toBe('invalid');
    expect(normalizeNfcTagNameV1('T'.repeat(80)).status).toBe('valid');
    expect(normalizeNfcTagNameV1('T'.repeat(81)).status).toBe('invalid');
  });

  it('pins both normal-administration digest vectors', () => {
    expect(createCustomerCommandDigestV1(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '12000000-0000-4000-8000-000000000001',
      'Café',
    )).toBe('58b2633bb5e5cb317ef8117e5ccd6fc1330256768af621adc89a8b36d71c1b2d');
    expect(provisionNfcTagCommandDigestV1(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '12000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'Eingang',
      'nfc:uid:v1:B55E8B6AEB30',
    )).toBe('170d1bf4e7bcf05ffd7ac96cc44d033289679ad05160ff2b86464bfa2a88eacc');
  });

  it('pins the C3E2 reassignment digest vector', () => {
    expect(reassignNfcTagCommandDigestV1(
      '00000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '12000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
    )).toBe('1a5d7bd2d735bcdafbd16968a44c2d2ee7ba61169b05b268498631ac4b75d80d');
  });
});
