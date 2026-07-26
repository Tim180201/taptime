import { Writable } from 'node:stream';
import { createInterface } from 'node:readline';
import {
  cleanupDa5V5AndroidState,
  Da5V5AndroidPreinstallPreflight,
  installDa5V5AndroidFromPackageZero,
  SystemDa5V5AndroidAdbRunner,
  type Da5V5AndroidPreflightBinding,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';
import {
  DA5_V5_CHECKPOINT_PLAN,
  Da5V5OperationSession,
  type Da5V5Checkpoint,
} from './Da5V5OperationSession.js';
import {
  Da5V5InputOwnership,
  Da5V5OperatorLifecycle,
  Da5V5SignalController,
  rejectDa5V5OperationalInputs,
  type Da5V5OperatorCommandOutcome,
} from './Da5V5OperatorLifecycle.js';
import {
  Da5V5ApiOfflineController,
  Da5V5DeviceCheckpointController,
  Da5V5UsbDeviceLock,
  SystemDa5V5AdbCommandRunner,
  type Da5V5AccessibilityBinding,
  type Da5V5OfflinePhase,
} from './Da5V5AdbController.js';
import {
  Da5V5CommandExecutionGuard,
  Da5V5SafeEventLatch,
  da5V5SessionBoundaryMatches,
  da5V5TagBRegistrationArmIsAuthorized,
} from './Da5V5CommandPolicy.js';
import {
  Da5V5MobileCredentialTransfer,
  Da5V5WebCredentialTransfer,
  SystemDa5V5SecretProcessRunner,
} from './Da5V5CredentialTransfer.js';
import {
  da5V5DedupeBinding,
  isDa5V5DedupePhase,
  type Da5V5DedupePhase,
} from './Da5V5DedupeWindow.js';
import {
  DA5_V5_PROFILE,
  DA5_V5_PUBLIC_MANIFEST,
  Da5V5MemoryOnlyPasswordBinding,
  da5V5SyntheticCredentialBuffer,
  requireDa5V5Profile,
  validateDa5V5TagBinding,
} from './Da5V5Profile.js';
import {
  closeDa5V5PostgresCapability,
  createDa5V5LocalPostgresCapability,
  da5V5PostgresCapabilityState,
  type Da5V5PostgresCapability,
} from './Da5V5PostgresCapability.js';
import {
  verifyDa5V5RuntimeGuardArtifact,
  type Da5V5RuntimeGuardArtifactBinding,
} from './Da5V5RuntimeGuardArtifact.js';
import {
  createSyntheticAndroidE2eEnvironment,
  type SyntheticAndroidE2eEnvironment,
  type SyntheticEnvironmentSafeEvent,
} from './SyntheticAndroidE2eEnvironment.js';

rejectDa5V5OperationalInputs(process.env, process.argv);
const profile = requireDa5V5Profile(process.env.TAPTIME_SYNTHETIC_E2E_PROFILE);
const guardBinaryPath = requiredEnvironmentValue('TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY');
const guardManifestPath = requiredEnvironmentValue('TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST');
const expectedGuardBinarySha256 = requiredEnvironmentValue(
  'TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY_SHA256',
);
const expectedGuardManifestSha256 = requiredEnvironmentValue(
  'TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST_SHA256',
);
const implementationCommit = requiredEnvironmentValue(
  'TAPTIME_DA5_V5_IMPLEMENTATION_COMMIT',
);
const implementationTree = requiredEnvironmentValue(
  'TAPTIME_DA5_V5_IMPLEMENTATION_TREE',
);
const pgConfigPath = requiredEnvironmentValue('TAPTIME_DA5_V5_PG_CONFIG');
let password = requiredEnvironmentValue('TAPTIME_SYNTHETIC_E2E_PASSWORD');
const startupPasswordBuffer = da5V5SyntheticCredentialBuffer(password);
const tagBinding = validateDa5V5TagBinding({
  tagA: requiredEnvironmentValue('TAPTIME_DA5_V5_TAG_A_FINGERPRINT'),
  tagB: requiredEnvironmentValue('TAPTIME_DA5_V5_TAG_B_FINGERPRINT'),
  tagX: requiredEnvironmentValue('TAPTIME_DA5_V5_TAG_X_FINGERPRINT'),
  technology: requiredEnvironmentValue('TAPTIME_DA5_V5_TAG_TECHNOLOGY'),
});
const accessibilityBinding: Da5V5AccessibilityBinding & Da5V5AndroidPreflightBinding =
  Object.freeze({
    androidApi: requiredEnvironmentValue('TAPTIME_DA5_V5_ANDROID_API'),
    androidBuild: requiredEnvironmentValue('TAPTIME_DA5_V5_ANDROID_BUILD'),
    androidRelease: requiredEnvironmentValue('TAPTIME_DA5_V5_ANDROID_RELEASE'),
    deviceModel: requiredEnvironmentValue('TAPTIME_DA5_V5_DEVICE_MODEL'),
    fontScale: '2.0',
    talkBackVersion: requiredEnvironmentValue('TAPTIME_DA5_V5_TALKBACK_VERSION'),
  });
delete process.env.TAPTIME_SYNTHETIC_E2E_PASSWORD;

const passwordBinding = new Da5V5MemoryOnlyPasswordBinding(startupPasswordBuffer);
const credentialPhases = Object.freeze([
  'administrator',
  'enrollment',
  'employee',
] as const);
let nextCredentialPhase = 0;
let environment: SyntheticAndroidE2eEnvironment | null = null;
let postgresCapability: Da5V5PostgresCapability | null = null;
let runtimeGuardArtifact: Da5V5RuntimeGuardArtifactBinding | null = null;
let operationSession: Da5V5OperationSession | null = null;
let operatorLifecycle: Da5V5OperatorLifecycle | null = null;
let cleanupResourcesPromise: Promise<void> | null = null;
const completedCleanupStages = new Set<string>();
const inputOwnership = new Da5V5InputOwnership();
const adb = new SystemDa5V5AdbCommandRunner();
const mobileAdb = new SystemDa5V5AndroidAdbRunner();
const deviceLock = new Da5V5UsbDeviceLock();
const preinstall = new Da5V5AndroidPreinstallPreflight(
  mobileAdb,
  deviceLock,
  accessibilityBinding,
);
let physicalTagBindingConfirmed = false;
let androidInstalled = false;
const mutationAbortController = new AbortController();
const secretProcesses = new SystemDa5V5SecretProcessRunner();
const webCredential = new Da5V5WebCredentialTransfer(
  secretProcesses,
  () => {
    process.exitCode = 1;
    mutationAbortController.abort();
    inputOwnership.closeAll();
    void operatorLifecycle?.abortAndFail('da5_v5_credential_binding=mismatch');
  },
);
const mobileCredential = new Da5V5MobileCredentialTransfer(
  secretProcesses,
  mobileAdb,
  deviceLock,
  accessibilityBinding,
);
const offline = new Da5V5ApiOfflineController(
  adb,
  accessibilityBinding,
  deviceLock,
  mutationAbortController.signal,
);
const device = new Da5V5DeviceCheckpointController(adb, accessibilityBinding, deviceLock);
const safeEventLatch = new Da5V5SafeEventLatch();
const commandExecutionGuard = new Da5V5CommandExecutionGuard(
  safeEventLatch,
  mutationAbortController.signal,
);

const signalController = new Da5V5SignalController(
  reportOperatorEvent,
  () => {
    process.exitCode = 1;
  },
);
const handleTerminationSignal = (): void => {
  process.exitCode = 1;
  mutationAbortController.abort();
  inputOwnership.closeAll();
  void signalController.handleSignal().finally(() => cleanupResources());
};
process.on('SIGINT', handleTerminationSignal);
process.on('SIGTERM', handleTerminationSignal);
process.on('SIGHUP', handleTerminationSignal);
process.on('uncaughtException', handleTerminationSignal);
process.on('unhandledRejection', handleTerminationSignal);

try {
  signalController.checkpoint();
  runtimeGuardArtifact = await verifyDa5V5RuntimeGuardArtifact({
    binaryPath: guardBinaryPath,
    expectedBinarySha256: expectedGuardBinarySha256,
    expectedManifestSha256: expectedGuardManifestSha256,
    implementationCommit,
    implementationTree,
    manifestPath: guardManifestPath,
  });
  signalController.checkpoint();
  postgresCapability = await createDa5V5LocalPostgresCapability({
    guardArtifactBinding: runtimeGuardArtifact,
    pgConfigPath,
    signal: mutationAbortController.signal,
    temporaryBase: '/private/tmp',
  });
  signalController.checkpoint();
  environment = await createSyntheticAndroidE2eEnvironment({
    da5V5PostgresCapability: postgresCapability,
    da5V5PostgresSource: 'isolated-runtime-guard',
    password,
    authPort: 54_321,
    apiPort: 3_000,
    profile,
    da5V5TagBinding: tagBinding,
    onSafeEvent: reportSafeEvent,
  });
  postgresCapability = null;
  signalController.checkpoint();
  if (!safeEventLatch.commandAllowed()) {
    throw new Error('DA5 V5 safe failure latched during startup');
  }
  password = '';
  startupPasswordBuffer.fill(0);
  const initialStatus = await environment.da5V5Status();
  if (!safeEventLatch.commandAllowed()) {
    throw new Error('DA5 V5 safe failure latched during startup');
  }
  operationSession = new Da5V5OperationSession(initialStatus);
  if (operationSession.state().failed) {
    throw new Error('DA5 V5 initial status mismatch');
  }
  operatorLifecycle = new Da5V5OperatorLifecycle(
    cleanupResources,
    reportOperatorEvent,
    () => {
      process.exitCode = 1;
    },
    () => {
      mutationAbortController.abort();
    },
    () => {
      inputOwnership.closeAll();
    },
  );
  signalController.bind(operatorLifecycle);
  if (!safeEventLatch.commandAllowed()) {
    await operatorLifecycle.fail('operator_command_failed');
    throw new Error('DA5 V5 safe failure latched during startup');
  }
  process.stdout.write([
    'da5_v5_ready',
    `da5_v5_public_manifest=${JSON.stringify(DA5_V5_PUBLIC_MANIFEST)}`,
    'operator_commands=status | device-preflight | physical-tag-binding-confirm <PASS|FAIL|AMBIGUOUS> | android-install-confirm <PASS|FAIL|AMBIGUOUS> | credential-field-ready <enrollment|employee> EMPTY_ACTIVE | credential-check <administrator|enrollment|employee> | credential-paste-confirm administrator | checkpoint <name> <queue-items> | checkpoint-confirm <name> <PASS|FAIL|AMBIGUOUS> | dedupe-window-baseline <phase> | dedupe-window-check <phase> | tag-b-registration-arm | protected-review-arm <human-observed-queue-items> | protected-review-activate-tag-b | protected-review-cutover-tag-a | protected-review-terminal | offline-enter <ordinary|protected> | offline-restore <ordinary|protected> | gate-b-cold-prepare | ordinary-relaunch-prepare | accessibility-check | cancellation-arm | cancellation-ui-confirm <PASS|FAIL|AMBIGUOUS> | cancellation-kill-background | cancellation-ready-confirm <PASS|FAIL|AMBIGUOUS> | protected-force-stop | protected-ready-confirm <PASS|FAIL|AMBIGUOUS> | stop',
    'sensitive_values_are_never_printed',
    '',
  ].join('\n'));
  startCommandInput();
} catch {
  password = '';
  startupPasswordBuffer.fill(0);
  if (!signalController.isInterrupted()) {
    process.stderr.write('da5_v5_start_failed\n');
  }
  process.exitCode = 1;
  await cleanupResources().catch(() => {
    reportOperatorEvent('da5_v5_cleanup_failed');
  });
}

async function handleCommand(line: string): Promise<Da5V5OperatorCommandOutcome> {
  const activeEnvironment = environment;
  const activeSession = operationSession;
  if (activeEnvironment === null || activeSession === null) {
    throw new Error('DA5 V5 environment is unavailable');
  }
  if (!safeEventLatch.commandAllowed()) {
    return fail(activeSession, 'operator_command_failed');
  }
  const normalized = line.trim();
  if (normalized === 'status') {
    await reportStatus(activeEnvironment, activeSession);
    return { state: 'continue' };
  }
  if (normalized === 'device-preflight') {
    if (
      nextCredentialPhase !== 0
      || androidInstalled
      || physicalTagBindingConfirmed
      || !da5V5SessionBoundaryMatches(
        activeSession,
        null,
        'gate-a-setup-rejections',
      )
    ) {
      return fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
    }
    const result = await preinstall.run({ signal: mutationAbortController.signal });
    process.stdout.write(`da5_v5_device_preflight=${result.status}\n`);
    return result.status === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
  }
  const physicalTagConfirmation =
    /^physical-tag-binding-confirm (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (physicalTagConfirmation !== null) {
    const verdict = parseHumanVerdict(physicalTagConfirmation[1]);
    if (
      verdict !== 'pass'
      || preinstall.state() !== 'matched'
      || physicalTagBindingConfirmed
      || androidInstalled
    ) {
      return fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
    }
    physicalTagBindingConfirmed = true;
    process.stdout.write('da5_v5_physical_tag_binding=human_confirmed\n');
    return { state: 'continue' };
  }
  const installConfirmation =
    /^android-install-confirm (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (installConfirmation !== null) {
    const verdict = parseHumanVerdict(installConfirmation[1]);
    if (
      verdict !== 'pass'
      || preinstall.state() !== 'matched'
      || !physicalTagBindingConfirmed
      || androidInstalled
    ) {
      return fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
    }
    await installDa5V5AndroidFromPackageZero({
      deviceBinding: accessibilityBinding,
      profile,
      runner: mobileAdb,
      serialBinding: deviceLock,
      signal: mutationAbortController.signal,
    });
    if (offline.arm() !== 'match') {
      throw new Error('DA5 V5 offline controller arm mismatch');
    }
    androidInstalled = true;
    process.stdout.write('da5_v5_android_install=match\n');
    return { state: 'continue' };
  }
  const fieldReady =
    /^credential-field-ready (enrollment|employee) EMPTY_ACTIVE$/u.exec(normalized);
  if (fieldReady !== null) {
    const phase = fieldReady[1] as 'employee' | 'enrollment';
    const result = (
      credentialPhases[nextCredentialPhase] === phase
      && androidInstalled
    )
      ? mobileCredential.confirmEmptyActiveField(phase)
      : 'mismatch';
    process.stdout.write(`synthetic_credential_field_ready=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_credential_binding=mismatch');
  }
  if (normalized === 'credential-paste-confirm administrator') {
    const result = (
      credentialPhases[nextCredentialPhase] === 'administrator'
      && webCredential.state() === 'paste-pending'
    )
      ? await webCredential.confirmPaste(mutationAbortController.signal)
      : 'mismatch';
    if (result === 'match') {
      nextCredentialPhase += 1;
    }
    process.stdout.write(`synthetic_clipboard_zero=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_credential_binding=mismatch');
  }
  const credential = /^credential-check (administrator|enrollment|employee)$/u.exec(normalized);
  if (credential !== null) {
    const phase = credential[1] as (typeof credentialPhases)[number];
    if (
      credentialPhases[nextCredentialPhase] !== phase
      || !androidInstalled
      || !da5V5SessionBoundaryMatches(
        activeSession,
        null,
        'gate-a-setup-rejections',
      )
    ) {
      return fail(activeSession, 'da5_v5_credential_binding=mismatch');
    }
    const candidate = await commandExecutionGuard.wait(readHiddenCredential());
    let result: 'match' | 'mismatch' = 'mismatch';
    try {
      if (passwordBinding.compare(candidate) === 'match') {
        result = phase === 'administrator'
          ? await webCredential.inject(candidate, mutationAbortController.signal)
          : await mobileCredential.inject(
              phase,
              candidate,
              mutationAbortController.signal,
            );
      }
    } finally {
      candidate.fill(0);
    }
    if (result !== 'match') {
      process.stdout.write('synthetic_password_binding=mismatch\n');
      return fail(activeSession, 'da5_v5_credential_binding=mismatch');
    }
    if (phase !== 'administrator') {
      nextCredentialPhase += 1;
    }
    process.stdout.write('synthetic_password_binding=match\n');
    return { state: 'continue' };
  }
  const checkpoint = /^checkpoint ([a-z0-9-]+) ([0-9]+)$/u.exec(normalized);
  if (checkpoint !== null) {
    const name = checkpoint[1] as Da5V5Checkpoint;
    const queueItems = Number(checkpoint[2]);
    const current = await commandExecutionGuard.wait(activeEnvironment.da5V5Status());
    const invariants = await commandExecutionGuard.wait(
      activeEnvironment.da5V5InvariantStatus(),
    );
    const expected = DA5_V5_CHECKPOINT_PLAN[activeSession.state().step];
    const invariantMatch = checkpointInvariantsMatch(name, invariants);
    const operatorStateMatch = await commandExecutionGuard.wait(
      checkpointOperatorStateMatches(
        name,
        activeEnvironment,
        activeSession,
      ),
    );
    const result = invariantMatch && operatorStateMatch
      ? activeSession.observeCheckpoint(name, current, queueItems)
      : activeSession.fail();
    process.stdout.write(`da5_v5_checkpoint_observation=${JSON.stringify({
      expected: expected === undefined ? null : {
        aggregates: expected.status,
        checkpoint: expected.checkpoint,
        queueItems: expected.expectedQueueItems,
      },
      observed: {
        aggregates: current,
        checkpoint: name,
        invariants,
        queueItems,
      },
      result,
    })}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : { state: 'fail', event: 'da5_v5_checkpoint=mismatch' };
  }
  const confirmation =
    /^checkpoint-confirm ([a-z0-9-]+) (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (confirmation !== null) {
    const verdict = parseHumanVerdict(confirmation[2]);
    const result = activeSession.confirmCheckpoint(
      confirmation[1] as Da5V5Checkpoint,
      verdict ?? 'ambiguous',
    );
    process.stdout.write(`da5_v5_checkpoint_confirmation=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : { state: 'fail', event: 'da5_v5_checkpoint=mismatch' };
  }
  const baseline = /^dedupe-window-baseline ([a-z0-9-]+)$/u.exec(normalized);
  if (baseline !== null) {
    const phase = baseline[1];
    if (phase === undefined || !isDa5V5DedupePhase(phase)) {
      return fail(activeSession, 'da5_v5_dedupe_window=mismatch');
    }
    const authorized = activeSession.authorizeDedupeBaseline(phase);
    const result = authorized === 'match'
      ? await commandExecutionGuard.wait(
          activeEnvironment.da5V5CaptureDedupeWindow(phase, da5V5DedupeBinding(phase)),
        )
      : 'mismatch';
    process.stdout.write(`dedupe_window_baseline=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_dedupe_window=mismatch');
  }
  const check = /^dedupe-window-check ([a-z0-9-]+)$/u.exec(normalized);
  if (check !== null) {
    const phase = check[1];
    if (phase === undefined || !isDa5V5DedupePhase(phase)) {
      return fail(activeSession, 'da5_v5_dedupe_window=mismatch');
    }
    const authorized = activeSession.authorizeDedupeCheck(phase);
    const result = authorized === 'match'
      ? await commandExecutionGuard.wait(
          activeEnvironment.da5V5CheckDedupeWindow(phase, da5V5DedupeBinding(phase)),
        )
      : 'mismatch';
    process.stdout.write(`dedupe_window_elapsed=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_dedupe_window=mismatch');
  }
  if (normalized === 'tag-b-registration-arm') {
    if (
      !da5V5TagBRegistrationArmIsAuthorized({
        commandAllowed: safeEventLatch.commandAllowed(),
        credentialsCompleted: nextCredentialPhase,
        credentialsRequired: credentialPhases.length,
        session: activeSession,
        tagRegistrationState: activeEnvironment.da5V5TagRegistrationState(),
      })
    ) {
      return fail(activeSession, 'da5_v5_fixture=mismatch');
    }
    await commandExecutionGuard.wait(activeEnvironment.armDa5V5TagBRegistration());
    process.stdout.write('da5_v5_tag_b_registration=armed\n');
    return { state: 'continue' };
  }
  const protectedReviewArm = /^protected-review-arm ([0-9]+)$/u.exec(normalized);
  if (protectedReviewArm !== null) {
    const humanObservedQueueItems = Number(protectedReviewArm[1]);
    if (
      !Number.isSafeInteger(humanObservedQueueItems)
      || !da5V5SessionBoundaryMatches(
        activeSession,
        'gate-d-cancellation',
        'gate-d-fixture-tag-b-activated',
      )
      || offline.getState().state !== 'direct-protected'
      || device.getState() !== 'cancellation-complete'
    ) {
      return fail(activeSession, 'da5_v5_fixture=mismatch');
    }
    const result = await commandExecutionGuard.wait(
      activeEnvironment.da5V5FixtureArm(humanObservedQueueItems),
    );
    process.stdout.write(`da5_v5_human_queue_observation=${JSON.stringify({
      expected: 0,
      observed: humanObservedQueueItems,
      result,
      source: 'human-visible-product-observation',
    })}\n`);
    return fixtureOutcome(activeSession, result, 'protected_review_fixture=armed');
  }
  if (normalized === 'protected-review-activate-tag-b') {
    if (
      !da5V5SessionBoundaryMatches(
        activeSession,
        'gate-d-cancellation',
        'gate-d-fixture-tag-b-activated',
      )
      || activeEnvironment.da5V5FixtureState() !== 'armed'
    ) {
      return fail(activeSession, 'da5_v5_fixture=mismatch');
    }
    const result = await commandExecutionGuard.wait(
      activeEnvironment.da5V5FixtureActivateTagB(),
    );
    return fixtureOutcome(activeSession, result, 'protected_review_tag_b=active');
  }
  if (normalized === 'protected-review-cutover-tag-a') {
    const sessionState = activeSession.state();
    if (
      !da5V5SessionBoundaryMatches(
        activeSession,
        'gate-d-fixture-pre-cutover-pending',
        'gate-d-fixture-cutover',
      )
      || offline.getState().state !== 'offline-protected'
      || activeEnvironment.da5V5FixtureState() !== 'tag-b-active'
      || !sessionState.issuedDedupeBaselines.includes('gate-d-tag-a')
      || !sessionState.issuedDedupeBaselines.includes('gate-d-tag-b')
    ) {
      return fail(activeSession, 'da5_v5_fixture=mismatch');
    }
    const result = await commandExecutionGuard.wait(
      activeEnvironment.da5V5FixtureCutoverTagA(),
    );
    return fixtureOutcome(activeSession, result, 'protected_review_tag_a_cutover=match');
  }
  if (normalized === 'protected-review-terminal') {
    if (
      !da5V5SessionBoundaryMatches(
        activeSession,
        'gate-d-protected-relaunch',
        'gate-f-final',
      )
      || offline.getState().state !== 'complete'
      || device.getState() !== 'protected-relaunch-complete'
      || activeEnvironment.da5V5FixtureState() !== 'cutover-complete'
    ) {
      return fail(activeSession, 'da5_v5_fixture=mismatch');
    }
    const result = await commandExecutionGuard.wait(
      activeEnvironment.da5V5FixtureMarkTerminal(),
    );
    return fixtureOutcome(
      activeSession,
      result,
      'protected_review_fixture_checkpoint=match',
    );
  }
  const offlineCommand = /^offline-(enter|restore) (ordinary|protected)$/u.exec(normalized);
  if (offlineCommand !== null) {
    const phase = offlineCommand[2] as Da5V5OfflinePhase;
    const operation = offlineCommand[1] as 'enter' | 'restore';
    if (!offlineCommandIsAuthorized(operation, phase, activeSession, activeEnvironment)) {
      return fail(activeSession, 'da5_v5_offline_control=mismatch');
    }
    const result = operation === 'enter'
      ? await offline.enterOffline(phase)
      : await offline.restoreDirect(phase);
    process.stdout.write(`da5_v5_offline_${offlineCommand[1]}=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_offline_control=mismatch');
  }
  const deviceOutcome = handleDeviceCommand(normalized, activeSession, activeEnvironment);
  if (deviceOutcome !== null) {
    process.stdout.write(`${deviceOutcome.event}=${deviceOutcome.result}\n`);
    return deviceOutcome.result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
  }
  if (normalized === 'stop') {
    const ready = (
      activeSession.state().terminal
      && offline.complete() === 'match'
      && device.getState() === 'protected-relaunch-complete'
      && activeEnvironment.da5V5FixtureState() === 'terminal'
      && nextCredentialPhase === credentialPhases.length
      && androidInstalled
    );
    return ready
      ? { state: 'stop' }
      : fail(activeSession, 'operator_command_rejected');
  }
  return fail(activeSession, 'operator_command_rejected');
}

function handleDeviceCommand(
  normalized: string,
  session: Da5V5OperationSession,
  activeEnvironment: SyntheticAndroidE2eEnvironment,
): { readonly event: string; readonly result: 'match' | 'mismatch' } | null {
  if (normalized === 'gate-b-cold-prepare') {
    if (
      !da5V5SessionBoundaryMatches(session, 'gate-a-setup-rejections', 'gate-b-cold')
      || offline.getState().state !== 'direct-ordinary'
    ) {
      return { event: 'da5_v5_cold_dispatch_preparation', result: 'mismatch' };
    }
    return { event: 'da5_v5_cold_dispatch_preparation', result: device.prepareColdDispatch() };
  }
  if (normalized === 'ordinary-relaunch-prepare') {
    if (
      !da5V5SessionBoundaryMatches(
        session,
        'gate-d-general-complete-pending',
        'gate-d-ordinary-relaunch',
      )
      || offline.getState().state !== 'offline-ordinary'
    ) {
      return { event: 'da5_v5_ordinary_relaunch_preparation', result: 'mismatch' };
    }
    return {
      event: 'da5_v5_ordinary_relaunch_preparation',
      result: device.prepareOrdinaryPendingRelaunch(),
    };
  }
  if (normalized === 'accessibility-check') {
    if (
      !da5V5SessionBoundaryMatches(
        session,
        'gate-c-general-complete',
        'gate-e-accessibility',
      )
    ) {
      return { event: 'da5_v5_accessibility_binding', result: 'mismatch' };
    }
    return {
      event: 'da5_v5_accessibility_binding',
      result: device.verifyAccessibilityBinding(),
    };
  }
  if (normalized === 'cancellation-arm') {
    if (
      !da5V5SessionBoundaryMatches(
        session,
        'gate-d-ordinary-synchronized',
        'gate-d-cancellation',
      )
      || offline.getState().state !== 'direct-protected'
    ) {
      return { event: 'da5_v5_cancellation', result: 'mismatch' };
    }
    return { event: 'da5_v5_cancellation', result: device.armCancellation() };
  }
  const cancellationUi =
    /^cancellation-ui-confirm (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (cancellationUi !== null) {
    const verdict = parseHumanVerdict(cancellationUi[1]);
    if (!da5V5SessionBoundaryMatches(
      session,
      'gate-d-ordinary-synchronized',
      'gate-d-cancellation',
    )) {
      return { event: 'da5_v5_cancellation_ui', result: 'mismatch' };
    }
    return {
      event: 'da5_v5_cancellation_ui',
      result: verdict === undefined ? 'mismatch' : device.confirmCancelledUi(verdict),
    };
  }
  if (normalized === 'cancellation-kill-background') {
    if (!da5V5SessionBoundaryMatches(
      session,
      'gate-d-ordinary-synchronized',
      'gate-d-cancellation',
    )) {
      return { event: 'da5_v5_cancellation_process_absent', result: 'mismatch' };
    }
    return {
      event: 'da5_v5_cancellation_process_absent',
      result: device.killBackgroundProcess(),
    };
  }
  const cancellationReady =
    /^cancellation-ready-confirm (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (cancellationReady !== null) {
    const verdict = parseHumanVerdict(cancellationReady[1]);
    if (!da5V5SessionBoundaryMatches(
      session,
      'gate-d-ordinary-synchronized',
      'gate-d-cancellation',
    )) {
      return { event: 'da5_v5_cancellation_ready', result: 'mismatch' };
    }
    return {
      event: 'da5_v5_cancellation_ready',
      result: verdict === undefined ? 'mismatch' : device.confirmColdReady(verdict),
    };
  }
  if (normalized === 'protected-force-stop') {
    if (
      !da5V5SessionBoundaryMatches(
        session,
        'gate-d-protected-terminal',
        'gate-d-protected-relaunch',
      )
      || offline.getState().state !== 'complete'
      || activeEnvironment.da5V5FixtureState() !== 'cutover-complete'
    ) {
      return { event: 'da5_v5_protected_relaunch_preparation', result: 'mismatch' };
    }
    return {
      event: 'da5_v5_protected_relaunch_preparation',
      result: device.prepareProtectedColdRelaunch(),
    };
  }
  const protectedReady = /^protected-ready-confirm (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (protectedReady !== null) {
    const verdict = parseHumanVerdict(protectedReady[1]);
    if (
      !da5V5SessionBoundaryMatches(
        session,
        'gate-d-protected-terminal',
        'gate-d-protected-relaunch',
      )
      || activeEnvironment.da5V5FixtureState() !== 'cutover-complete'
    ) {
      return { event: 'da5_v5_protected_state_retained', result: 'mismatch' };
    }
    return {
      event: 'da5_v5_protected_state_retained',
      result: verdict === undefined
        ? 'mismatch'
        : device.confirmProtectedStateRetained(verdict),
    };
  }
  return null;
}

async function checkpointOperatorStateMatches(
  checkpoint: Da5V5Checkpoint,
  activeEnvironment: SyntheticAndroidE2eEnvironment,
  activeSession: Da5V5OperationSession,
): Promise<boolean> {
  switch (checkpoint) {
    case 'gate-a-setup-rejections': {
      const tagRoles = await activeEnvironment.da5V5TagRoleState();
      return nextCredentialPhase === credentialPhases.length
        && activeEnvironment.da5V5TagRegistrationState() === 'registered'
        && tagRoles.activeTagAAssignments === 1
        && tagRoles.activeTagACustomerAAssignments === 1
        && tagRoles.activeTagBAssignments === 0
        && tagRoles.tagAExactRecords === 1
        && tagRoles.tagARecords === 1
        && tagRoles.tagBExactRecords === 1
        && tagRoles.tagBRecords === 1
        && tagRoles.tagBTotalAssignments === 0
        && tagRoles.tagXRecords === 0;
    }
    case 'gate-b-cold':
      return device.getState() === 'cold-dispatch-prepared';
    case 'gate-e-accessibility':
      return device.getState() === 'accessibility-confirmed';
    case 'gate-d-customer-first-pending':
      return offline.getState().state === 'offline-ordinary';
    case 'gate-d-ordinary-relaunch':
      return offline.getState().state === 'offline-ordinary'
        && device.getState() === 'ordinary-relaunch-prepared';
    case 'gate-d-ordinary-synchronized':
      return offline.getState().state === 'direct-protected'
        && device.getState() === 'ordinary-relaunch-prepared';
    case 'gate-d-cancellation':
      return offline.getState().state === 'direct-protected'
        && device.getState() === 'cancellation-complete';
    case 'gate-d-fixture-tag-b-activated':
    case 'gate-d-fixture-tag-b-started':
      return offline.getState().state === 'direct-protected'
        && activeEnvironment.da5V5FixtureState() === 'tag-b-active';
    case 'gate-d-fixture-pre-cutover-pending':
      return offline.getState().state === 'offline-protected'
        && activeEnvironment.da5V5FixtureState() === 'tag-b-active';
    case 'gate-d-fixture-cutover':
    case 'gate-d-fixture-all-pending':
      return offline.getState().state === 'offline-protected'
        && activeEnvironment.da5V5FixtureState() === 'cutover-complete';
    case 'gate-d-protected-terminal':
      return offline.getState().state === 'complete'
        && activeEnvironment.da5V5FixtureState() === 'cutover-complete';
    case 'gate-d-protected-relaunch':
      return offline.getState().state === 'complete'
        && device.getState() === 'protected-relaunch-complete'
        && activeEnvironment.da5V5FixtureState() === 'cutover-complete';
    case 'gate-f-final':
      return offline.getState().state === 'complete'
        && device.getState() === 'protected-relaunch-complete'
        && activeEnvironment.da5V5FixtureState() === 'terminal'
        && activeSession.state().confirmedCheckpoint === 'gate-d-protected-relaunch';
    default:
      return true;
  }
}

function offlineCommandIsAuthorized(
  operation: 'enter' | 'restore',
  phase: Da5V5OfflinePhase,
  session: Da5V5OperationSession,
  activeEnvironment: SyntheticAndroidE2eEnvironment,
): boolean {
  const state = session.state();
  if (operation === 'enter' && phase === 'ordinary') {
    return da5V5SessionBoundaryMatches(
      session,
      'gate-e-accessibility',
      'gate-d-customer-first-pending',
    )
      && device.getState() === 'accessibility-confirmed';
  }
  if (operation === 'restore' && phase === 'ordinary') {
    return da5V5SessionBoundaryMatches(
      session,
      'gate-d-ordinary-relaunch',
      'gate-d-ordinary-synchronized',
    )
      && device.getState() === 'ordinary-relaunch-prepared';
  }
  if (operation === 'enter' && phase === 'protected') {
    return da5V5SessionBoundaryMatches(
      session,
      'gate-d-fixture-tag-b-started',
      'gate-d-fixture-pre-cutover-pending',
    )
      && activeEnvironment.da5V5FixtureState() === 'tag-b-active'
      && state.issuedDedupeBaselines.includes('gate-d-tag-b');
  }
  return operation === 'restore'
    && phase === 'protected'
    && da5V5SessionBoundaryMatches(
      session,
      'gate-d-fixture-all-pending',
      'gate-d-protected-terminal',
    )
    && activeEnvironment.da5V5FixtureState() === 'cutover-complete'
    && state.checkedDedupePhases.includes('gate-d-tag-a')
    && state.checkedDedupePhases.includes('gate-d-tag-b');
}

async function reportStatus(
  activeEnvironment: SyntheticAndroidE2eEnvironment,
  activeSession: Da5V5OperationSession,
): Promise<void> {
  const [aggregates, invariants, tagRoles] = await Promise.all([
    activeEnvironment.da5V5Status(),
    activeEnvironment.da5V5InvariantStatus(),
    activeEnvironment.da5V5TagRoleState(),
  ]);
  commandExecutionGuard.ensure();
  process.stdout.write(`da5_v5_status=${JSON.stringify({
    profile: DA5_V5_PROFILE,
    operator: {
      credentialsCompleted: nextCredentialPhase,
      dedupe: activeEnvironment.da5V5DedupeState(),
      device: device.getState(),
      fixture: activeEnvironment.da5V5FixtureState(),
      offline: offline.getState(),
      session: activeSession.state(),
      tagRegistration: activeEnvironment.da5V5TagRegistrationState(),
      tagRoles,
    },
    aggregates,
    invariants,
  })}\n`);
}

function checkpointInvariantsMatch(
  checkpoint: Da5V5Checkpoint,
  invariants: Awaited<ReturnType<SyntheticAndroidE2eEnvironment['da5V5InvariantStatus']>>,
): boolean {
  if (checkpoint === 'gate-d-ordinary-synchronized') {
    return invariants.ordinaryOfflineOrder === 'match';
  }
  if (
    checkpoint === 'gate-d-protected-terminal'
    || checkpoint === 'gate-d-protected-relaunch'
    || checkpoint === 'gate-f-final'
  ) {
    return Object.values(invariants).every((value) => value === 'match');
  }
  return true;
}

function fixtureOutcome(
  session: Da5V5OperationSession,
  result: 'match' | 'mismatch',
  successEvent: string,
): Da5V5OperatorCommandOutcome {
  process.stdout.write(`${result === 'match' ? successEvent : 'protected_review_fixture=mismatch'}\n`);
  return result === 'match'
    ? { state: 'continue' }
    : fail(session, 'da5_v5_fixture=mismatch');
}

function fail(
  session: Da5V5OperationSession,
  event: Extract<Da5V5OperatorCommandOutcome, { state: 'fail' }>['event'],
): Extract<Da5V5OperatorCommandOutcome, { state: 'fail' }> {
  session.fail();
  return { state: 'fail', event };
}

async function readHiddenCredential(): Promise<Buffer> {
  const activeInput = inputOwnership.command();
  if (activeInput === null || !process.stdin.isTTY) {
    throw new Error('DA5 V5 credential input requires an interactive terminal');
  }
  inputOwnership.detachCommandForSecret();
  process.stdout.write('synthetic_password_input_ready\n');
  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const secretInput = createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: true,
    historySize: 0,
  });
  inputOwnership.attachSecret(secretInput);
  try {
    return await new Promise<Buffer>((resolvePromise, rejectPromise) => {
      let answered = false;
      secretInput.once('close', () => {
        if (!answered) {
          rejectPromise(new Error('DA5 V5 credential input closed'));
        }
      });
      secretInput.question('', (answer) => {
        answered = true;
        const candidate = Buffer.from(answer, 'utf8');
        if (candidate.length !== 64) {
          candidate.fill(0);
          resolvePromise(Buffer.alloc(0));
          return;
        }
        resolvePromise(candidate);
      });
    });
  } finally {
    inputOwnership.releaseSecret(secretInput);
  }
}

function startCommandInput(): void {
  if (inputOwnership.mode() !== 'none' || operatorLifecycle?.isActive() !== true) {
    return;
  }
  const commandInput = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 0,
  });
  inputOwnership.attachCommand(commandInput);
  commandInput.on('line', (line) => {
    void operatorLifecycle?.submit(() => handleCommand(line)).finally(() => {
      startCommandInput();
    });
  });
  commandInput.once('close', () => {
    void operatorLifecycle?.abortAndFail('operator_command_failed');
  });
}

function cleanupResources(): Promise<void> {
  if (cleanupResourcesPromise !== null) {
    return cleanupResourcesPromise;
  }
  const activeCleanup = performCleanupResources();
  cleanupResourcesPromise = activeCleanup;
  void activeCleanup.then(
    () => {
      if (cleanupResourcesPromise === activeCleanup) {
        cleanupResourcesPromise = null;
      }
    },
    () => {
      if (cleanupResourcesPromise === activeCleanup) {
        cleanupResourcesPromise = null;
      }
    },
  );
  return activeCleanup;
}

async function performCleanupResources(): Promise<void> {
  let firstFailure: unknown;
  const stage = async (
    name: string,
    action: () => Promise<void> | void,
  ): Promise<void> => {
    if (completedCleanupStages.has(name)) {
      return;
    }
    try {
      await action();
      completedCleanupStages.add(name);
    } catch (error: unknown) {
      firstFailure ??= error;
    }
  };

  await stage('input', () => inputOwnership.closeAll());
  await stage('password', () => passwordBinding.destroy());
  await stage('web-credential', async () => webCredential.close());
  await stage('offline', async () => {
    if (await offline.close() !== 'match') {
      throw new Error('DA5 V5 offline cleanup mismatch');
    }
  });
  await stage('android', async () => {
    const cleanup = await cleanupDa5V5AndroidState({
      deviceBinding: accessibilityBinding,
      profile,
      runner: mobileAdb,
      serialBinding: deviceLock,
      reverseState: offline.cleanupProofState(),
    });
    if (cleanup.status !== 'match') {
      throw new Error('DA5 V5 Android cleanup mismatch');
    }
  });
  await stage('environment', async () => {
    await environment?.close();
    environment = null;
  });
  await stage('postgres-capability', async () => {
    const capability = postgresCapability;
    if (
      capability !== null
      && da5V5PostgresCapabilityState(capability).closed === false
    ) {
      await closeDa5V5PostgresCapability(capability);
    }
    postgresCapability = null;
  });
  await stage('runtime-guard-artifact', async () => {
    const artifact = runtimeGuardArtifact;
    await artifact?.revalidate();
    await artifact?.close();
    runtimeGuardArtifact = null;
  });
  await stage('operation-session', () => {
    operationSession = null;
  });
  if (firstFailure !== undefined) {
    throw new Error('DA5 V5 cleanup failed');
  }
}

function reportOperatorEvent(event: string): void {
  process.stdout.write(`${event}\n`);
}

function reportSafeEvent(event: SyntheticEnvironmentSafeEvent): void {
  process.stdout.write(`synthetic_e2e_event=${event}\n`);
  if (safeEventLatch.observe(event) === 'failed') {
    process.exitCode = 1;
    mutationAbortController.abort();
    inputOwnership.closeAll();
    void operatorLifecycle?.abortAndFail('operator_command_failed');
  }
}

function parseHumanVerdict(
  value: string | undefined,
): 'pass' | 'fail' | 'ambiguous' | undefined {
  if (value === 'PASS' || value === 'FAIL' || value === 'AMBIGUOUS') {
    return value.toLowerCase() as 'pass' | 'fail' | 'ambiguous';
  }
  return undefined;
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error('Missing required DA5 V5 environment value');
  }
  return value;
}
