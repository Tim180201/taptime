import { createInterface, type Interface } from 'node:readline';
import {
  createSyntheticAndroidE2eEnvironment,
  type SyntheticAndroidE2eEnvironment,
  type SyntheticEnvironmentSafeEvent,
} from './SyntheticAndroidE2eEnvironment.js';

const installerDatabaseUrl = requiredEnvironmentValue('TAPTIME_SYNTHETIC_E2E_DATABASE_URL');
const password = requiredEnvironmentValue('TAPTIME_SYNTHETIC_E2E_PASSWORD');

let environment: SyntheticAndroidE2eEnvironment | null = null;
let input: Interface | null = null;
let shuttingDown = false;

try {
  environment = await createSyntheticAndroidE2eEnvironment({
    installerDatabaseUrl,
    password,
    authPort: parsePort(process.env.TAPTIME_SYNTHETIC_E2E_AUTH_PORT ?? '54321'),
    apiPort: parsePort(process.env.TAPTIME_SYNTHETIC_E2E_API_PORT ?? '3000'),
    onSafeEvent: reportSafeEvent,
  });
  process.stdout.write([
    'synthetic_e2e_ready',
    `administrator_login_email=${environment.administratorEmail}`,
    `employee_login_email=${environment.employeeEmail}`,
    `employee_enrollment_login_email=${environment.enrollmentEmail}`,
    `second_employee_enrollment_login_email=${environment.secondEnrollmentEmail}`,
    'operator_commands=arm-tag-a <12-hex-fingerprint> | arm-redemption-interruption | abort-redemption | status | stop',
    'sensitive_values_are_never_printed',
    '',
  ].join('\n'));

  input = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  input.on('line', (line) => {
    void handleCommand(line, environment as SyntheticAndroidE2eEnvironment).catch(() => {
      process.stdout.write('operator_command_failed\n');
    });
  });
  input.once('close', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
} catch {
  process.stderr.write('synthetic_e2e_start_failed\n');
  process.exitCode = 1;
}

async function handleCommand(
  line: string,
  activeEnvironment: SyntheticAndroidE2eEnvironment,
): Promise<void> {
  const normalized = line.trim();
  if (normalized === 'status') {
    const [counts, employeeEnrollment] = await Promise.all([
      activeEnvironment.evidenceCounts(),
      activeEnvironment.employeeEnrollmentEvidenceCounts(),
    ]);
    process.stdout.write(`synthetic_e2e_status=${JSON.stringify({
      provisioning: activeEnvironment.provisioningState(),
      redemptionInterruption: activeEnvironment.redemptionInterruptionState(),
      ...counts,
      employeeEnrollment,
    })}\n`);
    return;
  }
  if (normalized === 'arm-redemption-interruption') {
    activeEnvironment.armNextRedemptionInterruption();
    return;
  }
  if (normalized === 'abort-redemption') {
    activeEnvironment.abortPausedRedemption();
    return;
  }
  if (normalized === 'stop') {
    await shutdown();
    return;
  }
  const match = /^arm-tag-a ([0-9A-F]{12})$/.exec(normalized);
  if (match !== null) {
    activeEnvironment.armTagA(match[1] as string);
    return;
  }
  process.stdout.write('operator_command_rejected\n');
}

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  input?.close();
  input = null;
  try {
    await environment?.close();
    process.stdout.write('synthetic_e2e_stopped\n');
  } finally {
    process.exitCode = process.exitCode ?? 0;
  }
}

function reportSafeEvent(event: SyntheticEnvironmentSafeEvent): void {
  process.stdout.write(`synthetic_e2e_event=${event}\n`);
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required synthetic E2E environment value: ${name}`);
  }
  return value;
}

function parsePort(value: string): number {
  if (!/^\d{1,5}$/.test(value)) {
    throw new Error('Synthetic E2E port must be between 1 and 65535');
  }
  const port = Number(value);
  if (port < 1 || port > 65_535) {
    throw new Error('Synthetic E2E port must be between 1 and 65535');
  }
  return port;
}
