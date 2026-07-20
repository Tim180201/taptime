export const SYNTHETIC_E2E_RUNTIME_ENVIRONMENT = Object.freeze({
  APP_VARIANT: 'synthetic-e2e',
  EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT: 'synthetic-e2e',
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    'sb_publishable_taptime_synthetic_android_e2e',
  EXPO_PUBLIC_TAPTIME_API_BASE_URL: 'http://127.0.0.1:3000',
  EXPO_PUBLIC_TAPTIME_DEMO_MODE: 'false',
});

export const REQUIRED_SYNTHETIC_E2E_RUNTIME_LITERALS = Object.freeze([
  Object.freeze({
    name: 'synthetic Auth URL',
    value: SYNTHETIC_E2E_RUNTIME_ENVIRONMENT.EXPO_PUBLIC_SUPABASE_URL,
  }),
  Object.freeze({
    name: 'synthetic API URL',
    value: SYNTHETIC_E2E_RUNTIME_ENVIRONMENT.EXPO_PUBLIC_TAPTIME_API_BASE_URL,
  }),
  Object.freeze({
    name: 'synthetic publishable key',
    value: SYNTHETIC_E2E_RUNTIME_ENVIRONMENT.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }),
]);
