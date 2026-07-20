import { describe, expect, it } from 'vitest';

import {
  REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS,
  SYNTHETIC_E2E_RUNTIME_ENVIRONMENT,
} from '../../scripts/syntheticE2eRuntimeContract.mjs';
import {
  assertSyntheticE2eRuntimeCompleteness,
} from '../../scripts/verifySyntheticE2eAndroidRuntime.mjs';

describe('synthetic Android E2E runtime-completeness verifier', () => {
  it('accepts a Hermes dump containing every exact synthetic runtime value', () => {
    const dump = REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS
      .map(({ value }) => `String ${JSON.stringify(value)}`)
      .join('\n');

    expect(() => assertSyntheticE2eRuntimeCompleteness(dump)).not.toThrow();
    expect(SYNTHETIC_E2E_RUNTIME_ENVIRONMENT).toMatchObject({
      APP_VARIANT: 'synthetic-e2e',
      EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT: 'synthetic-e2e',
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        'sb_publishable_taptime_synthetic_android_e2e',
      EXPO_PUBLIC_TAPTIME_API_BASE_URL: 'http://127.0.0.1:3000',
      EXPO_PUBLIC_TAPTIME_DEMO_MODE: 'false',
    });
  });

  it.each(REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS)(
    'rejects a Hermes dump missing $name',
    ({ name, value: omitted }) => {
      const incompleteDump = REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS
        .filter(({ value }) => value !== omitted)
        .map(({ value }) => `String ${JSON.stringify(value)}`)
        .join('\n');

      expect(() => assertSyntheticE2eRuntimeCompleteness(incompleteDump))
        .toThrow(name);
    },
  );
});
