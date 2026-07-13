import { describe, expect, it } from 'vitest';
import {
  validateProductRuntimeConfiguration,
  type ProductRuntimeEnvironment,
} from '../../src/runtime/runtimeConfiguration';

const validEnvironment: ProductRuntimeEnvironment = {
  supabaseUrl: 'https://synthetic.supabase.co',
  supabasePublishableKey: 'sb_publishable_synthetic_test_only',
  tapTimeApiBaseUrl: 'https://api.taptime.example/base/',
};

describe('C1 product runtime configuration', () => {
  it.each(['android', 'ios'])('accepts complete HTTPS configuration on %s', (platform) => {
    expect(validateProductRuntimeConfiguration(validEnvironment, platform)).toEqual({
      status: 'valid',
      configuration: {
        supabaseUrl: 'https://synthetic.supabase.co/',
        supabasePublishableKey: 'sb_publishable_synthetic_test_only',
        tapTimeApiBaseUrl: 'https://api.taptime.example/base/',
      },
    });
  });

  it.each(['127.0.0.1', '127.42.1.9', '[::1]'])(
    'allows HTTP only for numeric loopback test infrastructure at %s',
    (host) => {
      const result = validateProductRuntimeConfiguration({
        ...validEnvironment,
        supabaseUrl: `http://${host}:54321/auth/v1`,
        tapTimeApiBaseUrl: `http://${host}:3000/`,
      }, 'android');
      expect(result.status).toBe('valid');
    },
  );

  it.each([
    ['Supabase URL', { ...validEnvironment, supabaseUrl: undefined }],
    ['publishable key', { ...validEnvironment, supabasePublishableKey: undefined }],
    ['TapTim.e API URL', { ...validEnvironment, tapTimeApiBaseUrl: undefined }],
  ])('fails closed when %s is missing', (_name, environment) => {
    expect(validateProductRuntimeConfiguration(environment, 'ios')).toEqual({ status: 'invalid' });
  });

  it.each([
    'sb_secret_synthetic',
    'legacy-anon-key',
    ' sb_publishable_synthetic',
    'sb_publishable_synthetic ',
    '',
  ])('rejects an unsuitable Mobile key value', (supabasePublishableKey) => {
    expect(validateProductRuntimeConfiguration({
      ...validEnvironment,
      supabasePublishableKey,
    }, 'android')).toEqual({ status: 'invalid' });
  });

  it.each([
    'http://auth.example.com/auth/v1',
    'http://localhost:54321/auth/v1',
    'http://127.0.0.1.evil.example/auth/v1',
    'ftp://auth.example.com/auth/v1',
    'file:///tmp/auth',
    'https://user:password@auth.example.com/auth/v1',
    'https://auth.example.com/auth/v1?tenant=forged',
    'https://auth.example.com/auth/v1#fragment',
  ])('rejects an unsafe Supabase base URL %s', (supabaseUrl) => {
    expect(validateProductRuntimeConfiguration({ ...validEnvironment, supabaseUrl }, 'android'))
      .toEqual({ status: 'invalid' });
  });

  it.each([
    'http://api.example.com',
    'http://localhost:3000',
    'https://user:password@api.example.com',
    'https://api.example.com?organization=forged',
    'https://api.example.com#fragment',
  ])('rejects an unsafe TapTim.e API base URL %s', (tapTimeApiBaseUrl) => {
    expect(validateProductRuntimeConfiguration({ ...validEnvironment, tapTimeApiBaseUrl }, 'ios'))
      .toEqual({ status: 'invalid' });
  });

  it.each(['web', 'windows', 'macos'])('fails closed on unsupported platform %s', (platform) => {
    expect(validateProductRuntimeConfiguration(validEnvironment, platform))
      .toEqual({ status: 'invalid' });
  });
});
