export type B1ConnectionMode = 'direct' | 'supavisor-session' | 'supavisor-transaction';

export interface B1ConnectionTarget {
  readonly mode: B1ConnectionMode;
  readonly connectionString: string;
}

export interface B1ConnectionEnvironment {
  readonly B1_DATABASE_URL?: string;
  readonly B1_RUNTIME_DATABASE_URL?: string;
  readonly B1_RUNTIME_PASSWORD?: string;
  readonly B1_SUPAVISOR_SESSION_URL?: string;
  readonly B1_SUPAVISOR_TRANSACTION_URL?: string;
}

export function installerConnectionTarget(environment: B1ConnectionEnvironment = process.env): B1ConnectionTarget {
  const connectionString = environment.B1_DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('B1_DATABASE_URL is required for the privileged B1 installer path');
  }

  return { mode: 'direct', connectionString };
}

export function directRuntimeConnectionTarget(
  environment: B1ConnectionEnvironment = process.env,
): B1ConnectionTarget {
  const connectionString = environment.B1_RUNTIME_DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('B1_RUNTIME_DATABASE_URL is required for the least-privilege direct runtime path');
  }

  return { mode: 'direct', connectionString };
}

export function runtimePassword(environment: B1ConnectionEnvironment = process.env): string {
  const password = environment.B1_RUNTIME_PASSWORD;
  if (password === undefined || password.length === 0) {
    throw new Error('B1_RUNTIME_PASSWORD is required to provision the synthetic B1 runtime login');
  }

  return password;
}

export function optionalConnectionTarget(
  mode: Exclude<B1ConnectionMode, 'direct'>,
  environment: B1ConnectionEnvironment = process.env,
): B1ConnectionTarget | null {
  const connectionString =
    mode === 'supavisor-session'
      ? environment.B1_SUPAVISOR_SESSION_URL
      : environment.B1_SUPAVISOR_TRANSACTION_URL;

  return connectionString === undefined || connectionString.length === 0
    ? null
    : { mode, connectionString };
}
