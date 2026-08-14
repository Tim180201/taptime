import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  DA5_V5_FAST_FLIGHT_PLAN_SHA256,
  Da5V5FlightController,
  da5V5FlightTerminalResult,
  type Da5V5FlightRunResult,
} from './Da5V5FlightController.js';
import { rejectDa5V5OperationalInputs } from './Da5V5OperatorLifecycle.js';
import { readDa5V5FlightCredential } from './Da5V5SecretInput.js';

const childEnvironmentNames = Object.freeze([
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'HOME',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TAPTIME_DA5_V5_ANDROID_API',
  'TAPTIME_DA5_V5_ANDROID_BUILD',
  'TAPTIME_DA5_V5_ANDROID_RELEASE',
  'TAPTIME_DA5_V5_DEVICE_MODEL',
  'TAPTIME_DA5_V5_IMPLEMENTATION_COMMIT',
  'TAPTIME_DA5_V5_IMPLEMENTATION_TREE',
  'TAPTIME_DA5_V5_PG_CONFIG',
  'TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY',
  'TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY_SHA256',
  'TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST',
  'TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST_SHA256',
  'TAPTIME_DA5_V5_TAG_A_FINGERPRINT',
  'TAPTIME_DA5_V5_TAG_B_FINGERPRINT',
  'TAPTIME_DA5_V5_TAG_TECHNOLOGY',
  'TAPTIME_DA5_V5_TAG_X_FINGERPRINT',
  'TAPTIME_DA5_V5_TALKBACK_PACKAGE',
  'TAPTIME_DA5_V5_TALKBACK_VERSION',
  'TAPTIME_SYNTHETIC_E2E_PROFILE',
  'TMPDIR',
  'USER',
] as const);

const requiredFlightEnvironmentNames = Object.freeze([
  'TAPTIME_DA5_V5_BINDING_SET_ID',
  'TAPTIME_DA5_V5_FLIGHT_EVIDENCE_PARENT',
] as const);

const bindingEvidenceEnvironmentNames = Object.freeze([
  'TAPTIME_DA5_V5_CLOSURE_SHA256',
  'TAPTIME_DA5_V5_EXACT_HEAD_CI_SHA256',
  'TAPTIME_DA5_V5_FINAL_V3_SHA256',
  'TAPTIME_DA5_V5_PROCEDURE_SHA256',
  'TAPTIME_DA5_V5_RUNTIME_MANIFEST_SHA256',
  'TAPTIME_DA5_V5_TOOLCHAIN_SHA256',
] as const);

const requiredChildEnvironmentNames = Object.freeze([
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'HOME',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TAPTIME_DA5_V5_ANDROID_API',
  'TAPTIME_DA5_V5_ANDROID_BUILD',
  'TAPTIME_DA5_V5_ANDROID_RELEASE',
  'TAPTIME_DA5_V5_DEVICE_MODEL',
  'TAPTIME_DA5_V5_IMPLEMENTATION_COMMIT',
  'TAPTIME_DA5_V5_IMPLEMENTATION_TREE',
  'TAPTIME_DA5_V5_PG_CONFIG',
  'TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY',
  'TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY_SHA256',
  'TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST',
  'TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST_SHA256',
  'TAPTIME_DA5_V5_TAG_A_FINGERPRINT',
  'TAPTIME_DA5_V5_TAG_B_FINGERPRINT',
  'TAPTIME_DA5_V5_TAG_TECHNOLOGY',
  'TAPTIME_DA5_V5_TAG_X_FINGERPRINT',
  'TAPTIME_DA5_V5_TALKBACK_PACKAGE',
  'TAPTIME_DA5_V5_TALKBACK_VERSION',
  'TAPTIME_SYNTHETIC_E2E_PROFILE',
  'TMPDIR',
  'USER',
] as const);

rejectDa5V5OperationalInputs(process.env, process.argv);
const abortController = new AbortController();
const handleSignal = (): void => abortController.abort();
process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);
process.once('SIGHUP', handleSignal);

let credential: Buffer | null = null;
try {
  const bindingSetId = requiredEnvironmentValue(requiredFlightEnvironmentNames[0]);
  const evidenceParentPath = requiredEnvironmentValue(requiredFlightEnvironmentNames[1]);
  const childEnvironment = createExactChildEnvironment();
  requireFlightBindings(bindingSetId, evidenceParentPath, childEnvironment);
  const childEntrypointPath = fileURLToPath(new URL('./da5V5Main.js', import.meta.url));
  const supervisorEntrypointPath = fileURLToPath(import.meta.url);
  const repositoryRootPath = fileURLToPath(new URL('../../..', import.meta.url));
  const runtimeGuardBinaryPath = childEnvironment.TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY;
  const bindingInputsVerified = await verifyBindingSet(
    bindingSetId,
    childEntrypointPath,
    supervisorEntrypointPath,
    childEnvironment,
  );

  credential = await readDa5V5FlightCredential(
    process.stdin,
    publishCredentialPrompt,
    abortController.signal,
  );
  const controller = new Da5V5FlightController({
    bindingSetId,
    bindingInputsVerified,
    childEntrypointPath,
    childEnvironment,
    credential,
    evidenceParentPath,
    repositoryRootPath,
    runtimeGuardBinaryPath,
    signal: abortController.signal,
    standardProfile: Object.freeze({
      androidApi: childEnvironment.TAPTIME_DA5_V5_ANDROID_API,
      androidBuild: childEnvironment.TAPTIME_DA5_V5_ANDROID_BUILD,
      androidRelease: childEnvironment.TAPTIME_DA5_V5_ANDROID_RELEASE,
      deviceModel: childEnvironment.TAPTIME_DA5_V5_DEVICE_MODEL,
      fontScale: '1.0',
    }),
  });
  const result = await controller.run();
  publishTerminalResult(result);
  process.exitCode = result.failure_reason === null
    && result.cleanup === 'MATCH'
    && result.attempted_outcome === 'PASS'
    ? 0
    : 1;
} catch {
  credential?.fill(0);
  process.stderr.write('da5_v5_flight_start_failed\n');
  process.exitCode = 1;
} finally {
  credential?.fill(0);
  credential = null;
  process.removeListener('SIGINT', handleSignal);
  process.removeListener('SIGTERM', handleSignal);
  process.removeListener('SIGHUP', handleSignal);
}

async function verifyBindingSet(
  expected: string,
  childEntrypointPath: string,
  supervisorEntrypointPath: string,
  childEnvironment: Readonly<Record<string, string>>,
): Promise<true> {
  const evidence: Record<string, string> = {};
  for (const name of bindingEvidenceEnvironmentNames) {
    const value = requiredEnvironmentValue(name);
    if (!/^[0-9a-f]{64}$/u.test(value)) {
      throw new Error('DA5 V5 evidence binding mismatch');
    }
    evidence[name] = value;
  }
  const [childBytes, supervisorBytes] = await Promise.all([
    readFile(childEntrypointPath),
    readFile(supervisorEntrypointPath),
  ]);
  const material = Object.freeze({
    child_environment: Object.freeze({ ...childEnvironment }),
    child_sha256: sha256(childBytes),
    evidence: Object.freeze(evidence),
    node_version: process.version,
    plan_sha256: DA5_V5_FAST_FLIGHT_PLAN_SHA256,
    schema_version: 1,
    supervisor_sha256: sha256(supervisorBytes),
  });
  childBytes.fill(0);
  supervisorBytes.fill(0);
  if (sha256(canonicalJson(material)) !== expected) {
    throw new Error('DA5 V5 binding set mismatch');
  }
  return true;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('DA5 V5 binding set encoding mismatch');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function createExactChildEnvironment(): Record<string, string> & Readonly<{
  TAPTIME_DA5_V5_ANDROID_API: string;
  TAPTIME_DA5_V5_ANDROID_BUILD: string;
  TAPTIME_DA5_V5_ANDROID_RELEASE: string;
  TAPTIME_DA5_V5_DEVICE_MODEL: string;
  TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY: string;
}> {
  const result: Record<string, string> = {};
  for (const name of childEnvironmentNames) {
    const value = process.env[name];
    if (value !== undefined && value.length > 0 && !value.includes('\0')) result[name] = value;
  }
  for (const name of requiredChildEnvironmentNames) {
    if (result[name] === undefined) throw new Error('Missing required DA5 V5 child binding');
  }
  return result as ReturnType<typeof createExactChildEnvironment>;
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0 || value.includes('\0')) {
    throw new Error('Missing required DA5 V5 flight binding');
  }
  return value;
}

function requireFlightBindings(
  bindingSetId: string,
  evidenceParentPath: string,
  childEnvironment: Readonly<Record<string, string>>,
): void {
  if (
    !/^[0-9a-f]{64}$/u.test(bindingSetId)
    || !evidenceParentPath.startsWith('/')
    || evidenceParentPath.includes('\0')
    || childEnvironment.TAPTIME_SYNTHETIC_E2E_PROFILE !== 'da5-v5'
    || !/^[0-9a-f]{40}$/u.test(childEnvironment.TAPTIME_DA5_V5_IMPLEMENTATION_COMMIT ?? '')
    || !/^[0-9a-f]{40}$/u.test(childEnvironment.TAPTIME_DA5_V5_IMPLEMENTATION_TREE ?? '')
    || !/^[0-9a-f]{64}$/u.test(
      childEnvironment.TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY_SHA256 ?? '',
    )
    || !/^[0-9a-f]{64}$/u.test(
      childEnvironment.TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST_SHA256 ?? '',
    )
    || childEnvironment.TAPTIME_DA5_V5_TAG_TECHNOLOGY !== 'NfcA'
    || !['TAPTIME_DA5_V5_TAG_A_FINGERPRINT', 'TAPTIME_DA5_V5_TAG_B_FINGERPRINT',
      'TAPTIME_DA5_V5_TAG_X_FINGERPRINT'].every((name) => (
      /^[0-9A-F]{12}$/u.test(childEnvironment[name] ?? '')
    ))
  ) {
    throw new Error('DA5 V5 flight binding mismatch');
  }
}

function publishCredentialPrompt(): void {
  process.stdout.write(`${JSON.stringify({
    action: 'Enter the bound credential exactly once through hidden terminal input.',
    allowed_response: ['EXACT_64_LOWERCASE_HEX_SECRET'],
    button: 'none',
    do_not: 'Do not paste to a visible field, log, file, environment or clipboard.',
    field: 'hidden credential input',
    screen: 'DA5 V5 Flight Supervisor',
  })}\n`);
}

function publishTerminalResult(result: Da5V5FlightRunResult): void {
  process.stdout.write(
    `da5_v5_flight_terminal=${JSON.stringify(da5V5FlightTerminalResult(result))}\n`,
  );
}
