export const SYNTHETIC_AUTH_EMAIL = 'android-e2e@example.invalid';
export const SYNTHETIC_PUBLISHABLE_KEY = 'sb_publishable_taptime_synthetic_android_e2e';
export const SYNTHETIC_DATABASE_NAME = 'taptime_synthetic_android_e2e';

export const syntheticIds = Object.freeze({
  organization: '00000000-0000-4000-8000-000000000701',
  user: '10000000-0000-4000-8000-000000000701',
  administratorUser: '10000000-0000-4000-8000-000000000702',
  membership: '12000000-0000-4000-8000-000000000701',
  administratorMembership: '12000000-0000-4000-8000-000000000702',
  identityBinding: '11000000-0000-4000-8000-000000000701',
  customer: '20000000-0000-4000-8000-000000000701',
  tagA: '30000000-0000-4000-8000-000000000701',
  assignmentA: '40000000-0000-4000-8000-000000000701',
  providerSubject: '80000000-0000-4000-8000-000000000701',
  providerSession: '90000000-0000-4000-8000-000000000701',
} as const);

export const runtimeLogins = Object.freeze({
  session: 'taptime_synthetic_e2e_session',
  readModel: 'taptime_synthetic_e2e_read_model',
  lifecycle: 'taptime_synthetic_e2e_lifecycle',
  provisioner: 'taptime_synthetic_e2e_provisioner',
} as const);
