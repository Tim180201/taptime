import { Writable } from 'node:stream';
import { createInterface } from 'node:readline';
import {
  createDa4V5AdminWebServer,
  type Da4V5AdminWebServer,
} from './Da4V5AdminWebServer.js';
import {
  assertDa4V5InitialStatus,
  type Da4V5Status,
} from './Da4V5Database.js';
import {
  Da4V5OperationSession,
  type Da4V5WriteBrowser,
  type Da4V5WriteOperation,
} from './Da4V5OperationSession.js';
import {
  Da4V5InputOwnership,
  Da4V5OperatorLifecycle,
  type Da4V5OperatorCommandOutcome,
} from './Da4V5OperatorLifecycle.js';
import {
  DA4_V5_PROFILE,
  MemoryOnlySyntheticPasswordBinding,
  requireDa4V5Profile,
  validateDa4V5Timezone,
  type Da4V5FixtureManifest,
  type Da4V5ReadSection,
} from './Da4V5Profile.js';
import {
  createSyntheticAndroidE2eEnvironment,
  Da4V5CleanupError,
  type SyntheticAndroidE2eEnvironment,
  type SyntheticEnvironmentSafeEvent,
} from './SyntheticAndroidE2eEnvironment.js';

requireDa4V5Profile(process.env.TAPTIME_SYNTHETIC_E2E_PROFILE);

const installerDatabaseUrl = requiredEnvironmentValue('TAPTIME_SYNTHETIC_E2E_DATABASE_URL');
let password = requiredEnvironmentValue('TAPTIME_SYNTHETIC_E2E_PASSWORD');
const artifactRoot = requiredEnvironmentValue('TAPTIME_DA4_V5_ADMIN_WEB_ROOT');
const artifactManifest = requiredEnvironmentValue('TAPTIME_DA4_V5_ADMIN_WEB_MANIFEST');
delete process.env.TAPTIME_SYNTHETIC_E2E_PASSWORD;
const passwordBinding = new MemoryOnlySyntheticPasswordBinding(password);

let environment: SyntheticAndroidE2eEnvironment | null = null;
let adminWeb: Da4V5AdminWebServer | null = null;
let fixtureManifest: Da4V5FixtureManifest | null = null;
let initialStatus: Da4V5Status | null = null;
let operationSession: Da4V5OperationSession | null = null;
const inputOwnership = new Da4V5InputOwnership();
let operatorLifecycle: Da4V5OperatorLifecycle | null = null;
const timezones = new Map<'safari' | 'chromium', string>();

try {
  environment = await createSyntheticAndroidE2eEnvironment({
    installerDatabaseUrl,
    password,
    authPort: 54_321,
    apiPort: 3_000,
    profile: DA4_V5_PROFILE,
    onSafeEvent: reportSafeEvent,
  });
  password = '';
  [fixtureManifest, initialStatus] = await Promise.all([
    environment.da4V5FixtureManifest(),
    environment.da4V5Status(),
  ]);
  assertDa4V5InitialStatus(initialStatus);
  operationSession = new Da4V5OperationSession(initialStatus);
  adminWeb = await createDa4V5AdminWebServer({
    rootDirectory: artifactRoot,
    manifestPath: artifactManifest,
    onSafeEvent: (event) => process.stdout.write(`da4_v5_event=${event}\n`),
  });
  process.stdout.write([
    'da4_v5_ready',
    `administrator_login_email=${environment.administratorEmail}`,
    `admin_web_origin=${adminWeb.origin}`,
    `da4_v5_artifact_inventory=${JSON.stringify(adminWeb.inventory)}`,
    `da4_v5_fixture_manifest=${JSON.stringify(fixtureManifest)}`,
    `da4_v5_initial_status=${JSON.stringify(initialStatus)}`,
    'operator_commands=status | credential-check | timezone-check <safari|chromium> <iana-zone> | checkpoint <safari|chromium> <operation> | arm-read-fault <setup|employees|time-records|review-items> | fault-status | stop',
    'sensitive_values_are_never_printed',
    '',
  ].join('\n'));

  operatorLifecycle = new Da4V5OperatorLifecycle(
    cleanupResources,
    reportOperatorEvent,
    () => {
      process.exitCode = 1;
    },
  );
  startCommandInput();
  process.once('SIGINT', () => void operatorLifecycle?.stop(false));
  process.once('SIGTERM', () => void operatorLifecycle?.stop(false));
} catch (error) {
  password = '';
  process.stderr.write('da4_v5_start_failed\n');
  process.exitCode = 1;
  let cleanupFailureReported = false;
  try {
    await cleanupResources();
  } catch {
    reportOperatorEvent('da4_v5_cleanup_failed');
    cleanupFailureReported = true;
  }
  if (error instanceof Da4V5CleanupError && !cleanupFailureReported) {
    reportOperatorEvent('da4_v5_cleanup_failed');
  }
}

async function handleCommand(line: string): Promise<Da4V5OperatorCommandOutcome> {
  const activeEnvironment = environment;
  const activeAdminWeb = adminWeb;
  const activeFixtureManifest = fixtureManifest;
  if (
    activeEnvironment === null
    || activeAdminWeb === null
    || activeFixtureManifest === null
  ) {
    throw new Error('DA4 V5 environment is unavailable');
  }
  const normalized = line.trim();
  if (normalized === 'status') {
    const currentStatus = await activeEnvironment.da4V5Status();
    process.stdout.write(`da4_v5_status=${JSON.stringify({
      initial: initialStatus,
      current: currentStatus,
      writePlan: operationSession?.state(),
    })}\n`);
    return { state: 'continue' };
  }
  if (normalized === 'credential-check') {
    const candidate = await readHiddenPassword();
    const result = passwordBinding.compare(candidate);
    if (result === 'mismatch') {
      return { state: 'fail', event: 'synthetic_password_binding=mismatch' };
    }
    process.stdout.write('synthetic_password_binding=match\n');
    return { state: 'continue' };
  }
  const checkpointMatch =
    /^checkpoint (safari|chromium) (create-customer|create-invitation|reassign-tag|correct-time-record|export-time-entries|adjudicate-review)$/
      .exec(normalized);
  if (checkpointMatch !== null) {
    const currentStatus = await activeEnvironment.da4V5Status();
    const result = operationSession?.checkpoint(
      checkpointMatch[1] as Da4V5WriteBrowser,
      checkpointMatch[2] as Da4V5WriteOperation,
      currentStatus,
    ) ?? 'mismatch';
    if (result === 'mismatch') {
      return { state: 'fail', event: 'da4_v5_write_checkpoint=mismatch' };
    }
    process.stdout.write('da4_v5_write_checkpoint=match\n');
    return { state: 'continue' };
  }
  const timezoneMatch = /^timezone-check (safari|chromium) ([A-Za-z0-9_+\-/]+)$/.exec(normalized);
  if (timezoneMatch !== null) {
    const browser = timezoneMatch[1] as 'safari' | 'chromium';
    const timeZone = timezoneMatch[2] as string;
    const result = validateDa4V5Timezone(timeZone, activeFixtureManifest);
    if (result === 'match') {
      timezones.set(browser, timeZone);
    }
    const crossBrowserMatch = timezones.size < 2
      || timezones.get('safari') === timezones.get('chromium');
    if (result !== 'match' || !crossBrowserMatch) {
      return { state: 'fail', event: 'da4_v5_timezone_binding=mismatch' };
    }
    process.stdout.write('da4_v5_timezone_binding=match\n');
    return { state: 'continue' };
  }
  const armMatch = /^arm-read-fault (setup|employees|time-records|review-items)$/.exec(normalized);
  if (armMatch !== null) {
    activeAdminWeb.readFault.arm(armMatch[1] as Da4V5ReadSection);
    process.stdout.write('da4_v5_read_fault=armed\n');
    return { state: 'continue' };
  }
  if (normalized === 'fault-status') {
    process.stdout.write(
      `da4_v5_read_fault=${JSON.stringify(activeAdminWeb.readFault.getState())}\n`,
    );
    return { state: 'continue' };
  }
  if (normalized === 'stop') {
    return { state: 'stop' };
  }
  return { state: 'fail', event: 'operator_command_rejected' };
}

async function readHiddenPassword(): Promise<string> {
  const activeInput = inputOwnership.command();
  if (activeInput === null || !process.stdin.isTTY) {
    throw new Error('DA4 V5 credential input requires an interactive terminal');
  }
  inputOwnership.detachCommandForSecret();
  process.stdout.write('synthetic_password_input_ready\n');
  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const activeSecretInput = createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: true,
    historySize: 0,
  });
  inputOwnership.attachSecret(activeSecretInput);
  try {
    return await new Promise<string>((resolvePromise, rejectPromise) => {
      let answered = false;
      activeSecretInput.once('close', () => {
        if (!answered) {
          rejectPromise(new Error('DA4 V5 credential input closed'));
        }
      });
      activeSecretInput.question('', (answer) => {
        answered = true;
        resolvePromise(answer);
      });
    });
  } finally {
    inputOwnership.releaseSecret(activeSecretInput);
  }
}

function startCommandInput(): void {
  if (
    inputOwnership.mode() !== 'none'
    || operatorLifecycle?.isActive() !== true
  ) {
    return;
  }
  const activeInput = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 0,
  });
  inputOwnership.attachCommand(activeInput);
  activeInput.on('line', (line) => {
    void operatorLifecycle?.submit(() => handleCommand(line)).finally(() => {
      startCommandInput();
    });
  });
  activeInput.once('close', () => {
    void operatorLifecycle?.fail('operator_command_failed');
  });
}

async function cleanupResources(): Promise<void> {
  inputOwnership.closeAll();
  passwordBinding.destroy();
  timezones.clear();
  const results = await Promise.allSettled([
    adminWeb?.close() ?? Promise.resolve(),
    environment?.close() ?? Promise.resolve(),
  ]);
  adminWeb = null;
  environment = null;
  fixtureManifest = null;
  initialStatus = null;
  operationSession = null;
  if (results.some((result) => result.status === 'rejected')) {
    throw new Da4V5CleanupError();
  }
}

function reportOperatorEvent(event: string): void {
  process.stdout.write(`${event}\n`);
}

function reportSafeEvent(event: SyntheticEnvironmentSafeEvent): void {
  process.stdout.write(`synthetic_e2e_event=${event}\n`);
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required DA4 V5 environment value: ${name}`);
  }
  return value;
}
