import { createBackendApiRuntime } from './runtime.js';

const sessionDatabaseUrl = requiredEnvironmentValue('TAPTIME_SESSION_DATABASE_URL');
const readModelDatabaseUrl = requiredEnvironmentValue('TAPTIME_READ_MODEL_DATABASE_URL');
const lifecycleDatabaseUrl = requiredEnvironmentValue('TAPTIME_LIFECYCLE_DATABASE_URL');
const administrationDatabaseUrl = requiredEnvironmentValue('TAPTIME_ADMINISTRATION_DATABASE_URL');
const employeeInvitationDatabaseUrl = requiredEnvironmentValue('TAPTIME_EMPLOYEE_INVITATION_DATABASE_URL');
const employeeEnrollmentDatabaseUrl = requiredEnvironmentValue('TAPTIME_EMPLOYEE_ENROLLMENT_DATABASE_URL');
const supabaseIssuer = requiredEnvironmentValue('SUPABASE_ISSUER');
const port = parsePort(process.env.PORT ?? '3000');
const runtime = createBackendApiRuntime({
  sessionDatabaseUrl,
  readModelDatabaseUrl,
  lifecycleDatabaseUrl,
  administrationDatabaseUrl,
  employeeInvitationDatabaseUrl,
  employeeEnrollmentDatabaseUrl,
  supabaseIssuer,
});

runtime.server.listen(port, '0.0.0.0');

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  try {
    await runtime.close();
  } finally {
    process.exitCode = 0;
  }
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
runtime.server.once('error', () => {
  process.stderr.write('TapTim.e backend API failed to start\n');
  void shutdown().finally(() => {
    process.exitCode = 1;
  });
});

type RequiredRuntimeEnvironmentName =
  | 'SUPABASE_ISSUER'
  | 'TAPTIME_ADMINISTRATION_DATABASE_URL'
  | 'TAPTIME_EMPLOYEE_ENROLLMENT_DATABASE_URL'
  | 'TAPTIME_EMPLOYEE_INVITATION_DATABASE_URL'
  | 'TAPTIME_LIFECYCLE_DATABASE_URL'
  | 'TAPTIME_READ_MODEL_DATABASE_URL'
  | 'TAPTIME_SESSION_DATABASE_URL';

function requiredEnvironmentValue(name: RequiredRuntimeEnvironmentName): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Required backend API runtime environment variable is missing: ${name}`);
  }
  return value;
}

function parsePort(value: string): number {
  if (!/^\d{1,5}$/.test(value)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const port = Number(value);
  if (port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}
