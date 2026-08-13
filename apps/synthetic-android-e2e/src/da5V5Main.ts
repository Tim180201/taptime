import { createInterface } from 'node:readline';
import {
  clearDa5V5AndroidPackageForEmployeePreparation,
  cleanupDa5V5AndroidState,
  Da5V5AndroidInstallTransaction,
  Da5V5AndroidPreinstallPreflight,
  installDa5V5AndroidFromPackageZero,
  requireDa5V5TalkBackPackage,
  SystemDa5V5AndroidAdbRunner,
  type Da5V5AndroidPreflightBinding,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';
import {
  DA5_V5_ACCESSIBILITY_SURFACE_PLAN,
  DA5_V5_CHECKPOINT_PLAN,
  Da5V5AccessibilitySession,
  Da5V5OperationSession,
  type Da5V5AccessibilityReauthenticationRole,
  type Da5V5AccessibilitySurface,
  type Da5V5Checkpoint,
} from './Da5V5OperationSession.js';
import {
  Da5V5InputOwnership,
  Da5V5OperatorLifecycle,
  Da5V5SignalController,
  Da5V5StartupSettlement,
  rejectDa5V5OperationalInputs,
  settleDa5V5BackgroundOperation,
  type Da5V5OperatorCommandOutcome,
} from './Da5V5OperatorLifecycle.js';
import {
  Da5V5ApiOfflineController,
  Da5V5DeviceCheckpointController,
  Da5V5EmployeeInstallationTransition,
  Da5V5UsbDeviceLock,
  SystemDa5V5AdbCommandRunner,
  da5V5AndroidInstallFailureReceipt,
  type Da5V5AccessibilityBinding,
  type Da5V5OfflinePhase,
  type Da5V5StandardProfileBinding,
} from './Da5V5AdbController.js';
import {
  DA5_V5_TAG_B_REGISTRATION_ARM_STATUS,
  sameDa5V5Status,
  type Da5V5Status,
} from './Da5V5Database.js';
import {
  Da5V5CommandExecutionGuard,
  Da5V5SafeEventLatch,
  da5V5SessionBoundaryMatches,
  da5V5TagBRegistrationArmIsAuthorized,
} from './Da5V5CommandPolicy.js';
import {
  Da5V5MobileCredentialTransfer,
} from './Da5V5CredentialTransfer.js';
import { readDa5V5HiddenCredential } from './Da5V5SecretInput.js';
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
  da5V5TagBRegistrationPreconditionMatches,
  type SyntheticAndroidE2eEnvironment,
  type SyntheticEnvironmentSafeEvent,
} from './SyntheticAndroidE2eEnvironment.js';
import type { Da5V5TagRoleState } from './Da5V5ScanContextResolver.js';

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
const standardBinding: Da5V5StandardProfileBinding & Da5V5AndroidPreflightBinding =
  Object.freeze({
    androidApi: requiredEnvironmentValue('TAPTIME_DA5_V5_ANDROID_API'),
    androidBuild: requiredEnvironmentValue('TAPTIME_DA5_V5_ANDROID_BUILD'),
    androidRelease: requiredEnvironmentValue('TAPTIME_DA5_V5_ANDROID_RELEASE'),
    deviceModel: requiredEnvironmentValue('TAPTIME_DA5_V5_DEVICE_MODEL'),
    fontScale: '1.0',
  });
const accessibilityBinding: Da5V5AccessibilityBinding = Object.freeze({
  androidBuild: standardBinding.androidBuild,
  deviceModel: standardBinding.deviceModel,
  fontScale: '2.0',
  talkBackPackage: requireDa5V5TalkBackPackage(
    requiredEnvironmentValue('TAPTIME_DA5_V5_TALKBACK_PACKAGE'),
  ),
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
let accessibilityFailureEvent: Extract<
  Da5V5OperatorCommandOutcome,
  { state: 'fail' }
>['event'] | null = null;
let cleanupResourcesPromise: Promise<void> | null = null;
const completedCleanupStages = new Set<string>();
const startupAcquisitionSettlement = new Da5V5StartupSettlement();
const inputOwnership = new Da5V5InputOwnership();
let commandSubmissionTail: Promise<void> = Promise.resolve();
const adb = new SystemDa5V5AdbCommandRunner();
const mobileAdb = new SystemDa5V5AndroidAdbRunner();
const mobileInstallStreamAdb = mobileAdb.createInstallStreamRunner();
const deviceLock = new Da5V5UsbDeviceLock();
let androidInstallTransaction = new Da5V5AndroidInstallTransaction({
  deviceBinding: standardBinding,
  installStreamRunner: mobileInstallStreamAdb,
  runner: mobileAdb,
  serialBinding: deviceLock,
});
const preinstall = new Da5V5AndroidPreinstallPreflight(
  mobileAdb,
  deviceLock,
  standardBinding,
);
let physicalTagBindingConfirmed = false;
let androidInstalled = false;
const mutationAbortController = new AbortController();
const mobileCredential = new Da5V5MobileCredentialTransfer(
  mobileAdb,
  deviceLock,
  standardBinding,
);
const accessibilityCredential = new Da5V5MobileCredentialTransfer(
  mobileAdb,
  deviceLock,
  accessibilityBinding,
);
const accessibilitySession = new Da5V5AccessibilitySession();
let offline = new Da5V5ApiOfflineController(
  adb,
  standardBinding,
  deviceLock,
  mutationAbortController.signal,
);
const employeeInstallationTransition = new Da5V5EmployeeInstallationTransition();
let employeePreparedBoundary: Da5V5EmployeeInstallationBoundarySnapshot | null = null;
const device = new Da5V5DeviceCheckpointController(
  adb,
  standardBinding,
  accessibilityBinding,
  deviceLock,
);
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
  observeBackgroundOperation(
    signalController.handleSignal().finally(() => cleanupResources()),
  );
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
  startupAcquisitionSettlement.settle();
  if (!safeEventLatch.commandAllowed()) {
    await operatorLifecycle.fail('operator_command_failed');
    throw new Error('DA5 V5 safe failure latched during startup');
  }
  process.stdout.write([
    'da5_v5_ready',
    `da5_v5_public_manifest=${JSON.stringify(DA5_V5_PUBLIC_MANIFEST)}`,
    `da5_v5_accessibility_surface_plan=${DA5_V5_ACCESSIBILITY_SURFACE_PLAN.join(',')}`,
    'operator_commands=status | device-preflight | physical-tag-binding-confirm <PASS|FAIL|AMBIGUOUS> | android-install-confirm <PASS|FAIL|AMBIGUOUS> | employee-installation-transition-confirm <PASS|FAIL|AMBIGUOUS> | employee-ready-confirm <PASS|FAIL|AMBIGUOUS> | credential-field-ready <administrator|enrollment|employee> EMPTY_ACTIVE | credential-check <administrator|enrollment|employee> | credential-field-confirm <administrator|enrollment|employee> <VISIBLE|EMPTY|AMBIGUOUS> | checkpoint <name> <queue-items> | checkpoint-confirm <name> <PASS|FAIL|AMBIGUOUS> | dedupe-window-baseline <phase> | dedupe-window-check <phase> | tag-b-registration-arm | protected-review-arm <human-observed-queue-items> | protected-review-activate-tag-b | protected-review-cutover-tag-a | protected-review-terminal | offline-enter <ordinary|protected> | offline-restore <ordinary|protected> | gate-b-cold-prepare | ordinary-relaunch-prepare | accessibility-prepare | accessibility-check | accessibility-surface-confirm <surface> <PASS|FAIL|AMBIGUOUS> | accessibility-credential-field-ready <administrator|employee> EMPTY_ACTIVE | accessibility-credential-check <administrator|employee> | accessibility-credential-field-confirm <administrator|employee> <VISIBLE|EMPTY|AMBIGUOUS> | accessibility-cancel | standard-profile-check | cancellation-arm | cancellation-ui-confirm <PASS|FAIL|AMBIGUOUS> | cancellation-kill-background | cancellation-ready-confirm <PASS|FAIL|AMBIGUOUS> | protected-force-stop | protected-ready-confirm <PASS|FAIL|AMBIGUOUS> | abort | stop',
    'sensitive_values_are_never_printed',
    '',
  ].join('\n'));
  startCommandInput();
} catch {
  startupAcquisitionSettlement.settle();
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
  if (normalized === 'abort' && accessibilitySession.requiresRestoreProof()) {
    return fail(activeSession, 'da5_v5_aborted');
  }
  if (accessibilitySession.restoreOnly()) {
    if (normalized !== 'standard-profile-check') {
      process.stdout.write('da5_v5_accessibility_restore_only=mismatch\n');
      return { state: 'continue' };
    }
    const deviceResult = device.verifyStandardProfileRestored();
    const proofResult = accessibilitySession.confirmRestoreProof(deviceResult);
    process.stdout.write(`da5_v5_standard_profile_binding=${proofResult}\n`);
    if (proofResult !== 'match') {
      activeSession.fail();
      accessibilityFailureEvent ??= 'da5_v5_device_checkpoint=mismatch';
      process.stdout.write('da5_v5_accessibility_restore_required=match\n');
      return { state: 'continue' };
    }
    if (accessibilitySession.terminalFailureRestored()) {
      return {
        event: accessibilityFailureEvent ?? 'da5_v5_checkpoint=mismatch',
        state: 'fail',
      };
    }
    return { state: 'continue' };
  }
  if (
    accessibilitySession.profileChangePrepared()
    && normalized !== 'accessibility-check'
    && normalized !== 'accessibility-cancel'
  ) {
    return fail(activeSession, 'operator_command_rejected');
  }
  if (normalized === 'abort') {
    return { state: 'abort' };
  }
  if (normalized === 'status') {
    await reportStatus(activeEnvironment, activeSession);
    return { state: 'continue' };
  }
  if (
    employeeInstallationTransition.prepared()
    && !employeePreparedCommandAllowed(normalized)
  ) {
    return fail(activeSession, 'operator_command_rejected');
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
    try {
      await installDa5V5AndroidFromPackageZero({
        deviceBinding: standardBinding,
        installStreamRunner: mobileInstallStreamAdb,
        profile,
        runner: mobileAdb,
        serialBinding: deviceLock,
        signal: mutationAbortController.signal,
        transaction: androidInstallTransaction,
      });
    } catch (error: unknown) {
      process.stdout.write(da5V5AndroidInstallFailureReceipt(error));
      throw new Error('DA5 V5 Android install command failed');
    }
    if (offline.arm() !== 'match') {
      throw new Error('DA5 V5 offline controller arm mismatch');
    }
    androidInstalled = true;
    process.stdout.write('da5_v5_android_install=match\n');
    return { state: 'continue' };
  }
  const employeeInstallationConfirmation =
    /^employee-installation-transition-confirm (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (employeeInstallationConfirmation !== null) {
    const verdict = parseHumanVerdict(employeeInstallationConfirmation[1]) ?? 'ambiguous';
    const oldOffline = offline;
    const oldTransaction = androidInstallTransaction;
    let preBoundary: Da5V5EmployeeInstallationBoundarySnapshot | null = null;
    let replacementTransaction: Da5V5AndroidInstallTransaction | null = null;
    let replacementOffline: Da5V5ApiOfflineController | null = null;
    const result = await commandExecutionGuard.wait(
      employeeInstallationTransition.confirm(verdict, {
        precheck: async () => {
          preBoundary = await readEmployeeInstallationBoundary(
            activeEnvironment,
            activeSession,
          );
          return preBoundary === null ? 'mismatch' : 'match';
        },
        closeOldOffline: async () => oldOffline.close(),
        cleanupOldInstallation: async () => {
          const cleanup = await cleanupDa5V5AndroidState({
            deviceBinding: standardBinding,
            profile,
            runner: mobileAdb,
            serialBinding: deviceLock,
            transaction: oldTransaction,
            reverseState: oldOffline.cleanupProofState(),
          });
          if (cleanup.status !== 'match') {
            return 'mismatch';
          }
          androidInstalled = false;
          return 'match';
        },
        installReplacement: async () => {
          replacementTransaction = new Da5V5AndroidInstallTransaction({
            deviceBinding: standardBinding,
            installStreamRunner: mobileInstallStreamAdb,
            runner: mobileAdb,
            serialBinding: deviceLock,
          });
          replacementOffline = new Da5V5ApiOfflineController(
            adb,
            standardBinding,
            deviceLock,
            mutationAbortController.signal,
          );
          androidInstallTransaction = replacementTransaction;
          offline = replacementOffline;
          try {
            await installDa5V5AndroidFromPackageZero({
              deviceBinding: standardBinding,
              installStreamRunner: mobileInstallStreamAdb,
              profile,
              runner: mobileAdb,
              serialBinding: deviceLock,
              signal: mutationAbortController.signal,
              transaction: replacementTransaction,
            });
          } catch (error: unknown) {
            process.stdout.write(da5V5AndroidInstallFailureReceipt(error));
            throw new Error('DA5 V5 Android replacement install command failed');
          }
          return 'match';
        },
        clearReplacement: async () => {
          if (replacementTransaction === null || replacementOffline === null) {
            return 'mismatch';
          }
          try {
            await clearDa5V5AndroidPackageForEmployeePreparation({
              deviceBinding: standardBinding,
              profile,
              runner: mobileAdb,
              serialBinding: deviceLock,
              signal: mutationAbortController.signal,
              transaction: replacementTransaction,
            });
          } catch {
            process.stdout.write('da5_v5_employee_package_clear=mismatch\n');
            return 'mismatch';
          }
          if (replacementOffline.armPreparedEmployee() !== 'match') {
            return 'mismatch';
          }
          androidInstalled = true;
          process.stdout.write('da5_v5_employee_package_clear=match\n');
          return 'match';
        },
        postcheck: async () => {
          const postBoundary = await readEmployeeInstallationBoundary(
            activeEnvironment,
            activeSession,
          );
          const matched = preBoundary !== null
            && postBoundary !== null
            && employeeInstallationBoundarySnapshotsMatch(preBoundary, postBoundary);
          employeePreparedBoundary = matched ? postBoundary : null;
          return matched ? 'match' : 'mismatch';
        },
      }),
    );
    process.stdout.write(
      `da5_v5_employee_installation_transition=${result === 'match'
        ? 'employee-prepared'
        : 'mismatch'}\n`,
    );
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
  }
  const employeeReadyConfirmation =
    /^employee-ready-confirm (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (employeeReadyConfirmation !== null) {
    const verdict = parseHumanVerdict(employeeReadyConfirmation[1]) ?? 'ambiguous';
    const result = await commandExecutionGuard.wait(
      employeeInstallationTransition.confirmReady(verdict, async () => {
        const readyBoundary = await readEmployeeInstallationBoundary(
          activeEnvironment,
          activeSession,
          credentialPhases.length,
        );
        const boundary = employeePreparedBoundary !== null
          && readyBoundary !== null
          && employeeInstallationBoundarySnapshotsMatch(
            employeePreparedBoundary,
            readyBoundary,
          )
          ? 'match'
          : 'mismatch';
        return Object.freeze({
          boundary,
          hierarchy: device.verifyEmployeeReadyHierarchy(),
        });
      }),
    );
    if (result === 'match') {
      employeePreparedBoundary = null;
    }
    process.stdout.write(
      `da5_v5_employee_ready=${result === 'match' ? 'READY' : 'MISMATCH'}\n`,
    );
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
  }
  const fieldReady =
    /^credential-field-ready (administrator|enrollment|employee) EMPTY_ACTIVE$/u.exec(
      normalized,
    );
  if (fieldReady !== null) {
    const phase = fieldReady[1] as (typeof credentialPhases)[number];
    const result = (
      credentialPhases[nextCredentialPhase] === phase
      && androidInstalled
      && (phase !== 'employee' || employeeInstallationTransition.prepared())
    )
      ? mobileCredential.confirmEmptyActiveField(phase)
      : 'mismatch';
    process.stdout.write(`synthetic_credential_field_ready=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_credential_binding=mismatch');
  }
  const fieldConfirmation =
    /^credential-field-confirm (administrator|enrollment|employee) (VISIBLE|EMPTY|AMBIGUOUS)$/u
      .exec(normalized);
  if (fieldConfirmation !== null) {
    const phase = fieldConfirmation[1] as (typeof credentialPhases)[number];
    const observation = fieldConfirmation[2]?.toLowerCase() as (
      'ambiguous' | 'empty' | 'visible'
    );
    const result = credentialPhases[nextCredentialPhase] === phase
      && (phase !== 'employee' || employeeInstallationTransition.prepared())
      ? mobileCredential.confirmVisibleField(phase, observation)
      : 'mismatch';
    if (result === 'match') nextCredentialPhase += 1;
    process.stdout.write(`synthetic_credential_field_confirmation=${result}\n`);
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
      || (phase === 'employee' && !employeeInstallationTransition.prepared())
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
        result = await mobileCredential.inject(
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
    process.stdout.write('synthetic_password_binding=match\n');
    process.stdout.write('synthetic_credential_injection=pending_human_confirmation\n');
    return { state: 'continue' };
  }
  const accessibilityFieldReady =
    /^accessibility-credential-field-ready (administrator|employee) EMPTY_ACTIVE$/u.exec(
      normalized,
    );
  if (accessibilityFieldReady !== null) {
    const role = accessibilityFieldReady[1] as Da5V5AccessibilityReauthenticationRole;
    const result = accessibilityGateSurfaceBoundaryMatches(
      activeSession,
      activeEnvironment,
    )
      && accessibilitySession.beginReauthentication(role) === 'match'
      ? accessibilityCredential.confirmEmptyActiveField(role)
      : 'mismatch';
    process.stdout.write(`da5_v5_accessibility_credential_field_ready=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_credential_binding=mismatch');
  }
  const accessibilityCredentialCheck =
    /^accessibility-credential-check (administrator|employee)$/u.exec(normalized);
  if (accessibilityCredentialCheck !== null) {
    const role = accessibilityCredentialCheck[1] as Da5V5AccessibilityReauthenticationRole;
    if (
      !accessibilityGateSurfaceBoundaryMatches(activeSession, activeEnvironment)
      || !accessibilitySession.reauthenticationIsInProgress(role)
    ) {
      return fail(activeSession, 'da5_v5_credential_binding=mismatch');
    }
    const candidate = await commandExecutionGuard.wait(readHiddenCredential());
    let result: 'match' | 'mismatch' = 'mismatch';
    try {
      if (passwordBinding.compare(candidate) === 'match') {
        result = await accessibilityCredential.inject(
          role,
          candidate,
          mutationAbortController.signal,
        );
      }
    } finally {
      candidate.fill(0);
    }
    if (result !== 'match') {
      process.stdout.write('da5_v5_accessibility_password_binding=mismatch\n');
      return fail(activeSession, 'da5_v5_credential_binding=mismatch');
    }
    process.stdout.write('da5_v5_accessibility_password_binding=match\n');
    process.stdout.write(
      'da5_v5_accessibility_credential_injection=pending_human_confirmation\n',
    );
    return { state: 'continue' };
  }
  const accessibilityFieldConfirmation =
    /^accessibility-credential-field-confirm (administrator|employee) (VISIBLE|EMPTY|AMBIGUOUS)$/u
      .exec(normalized);
  if (accessibilityFieldConfirmation !== null) {
    const role = accessibilityFieldConfirmation[1] as (
      Da5V5AccessibilityReauthenticationRole
    );
    const observation = accessibilityFieldConfirmation[2]?.toLowerCase() as (
      'ambiguous' | 'empty' | 'visible'
    );
    const fieldResult = accessibilityGateSurfaceBoundaryMatches(
      activeSession,
      activeEnvironment,
    )
      ? accessibilityCredential.confirmVisibleField(role, observation)
      : 'mismatch';
    const result = fieldResult === 'match'
      ? accessibilitySession.completeReauthentication(role)
      : 'mismatch';
    process.stdout.write(`da5_v5_accessibility_credential_field_confirmation=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_credential_binding=mismatch');
  }
  const accessibilitySurface =
    /^accessibility-surface-confirm ([a-z-]+) (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (accessibilitySurface !== null) {
    const surface = accessibilitySurface[1] as Da5V5AccessibilitySurface;
    const verdict = parseHumanVerdict(accessibilitySurface[2]) ?? 'ambiguous';
    const result = accessibilityGateSurfaceBoundaryMatches(
      activeSession,
      activeEnvironment,
    )
      ? accessibilitySession.confirmSurface(surface, verdict)
      : 'mismatch';
    process.stdout.write(`da5_v5_accessibility_surface=${JSON.stringify({
      result,
      surface,
    })}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_checkpoint=mismatch');
  }
  if (normalized === 'accessibility-cancel') {
    if (!accessibilitySession.requiresRestoreProof()) {
      return fail(activeSession, 'operator_command_rejected');
    }
    accessibilitySession.fail();
    activeSession.fail();
    accessibilityFailureEvent ??= 'da5_v5_checkpoint=mismatch';
    process.stdout.write('da5_v5_accessibility_cancelled=restore_required\n');
    return { state: 'continue' };
  }
  if (normalized === 'accessibility-prepare') {
    let result: 'match' | 'mismatch' = 'mismatch';
    if (accessibilityGatePreparationBoundaryMatches(activeSession, activeEnvironment)) {
      const sessionResult = accessibilitySession.prepareProfileChange();
      result = sessionResult === 'match'
        ? device.prepareAccessibilityProfileChange()
        : 'mismatch';
    }
    process.stdout.write(
      result === 'match'
        ? 'da5_v5_accessibility_prepare=match restore_required=armed\n'
        : 'da5_v5_accessibility_prepare=mismatch\n',
    );
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
  }
  if (normalized === 'accessibility-check') {
    if (!accessibilityGateCheckBoundaryMatches(activeSession, activeEnvironment)) {
      return fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
    }
    const deviceResult = device.verifyAccessibilityBinding();
    const result = deviceResult === 'match'
      ? accessibilitySession.confirmAccessibilityProfile()
      : 'mismatch';
    process.stdout.write(`da5_v5_accessibility_binding=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_device_checkpoint=mismatch');
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
      : fail(activeSession, 'da5_v5_checkpoint=mismatch');
  }
  const confirmation =
    /^checkpoint-confirm ([a-z0-9-]+) (PASS|FAIL|AMBIGUOUS)$/u.exec(normalized);
  if (confirmation !== null) {
    const verdict = parseHumanVerdict(confirmation[2]);
    const checkpointName = confirmation[1] as Da5V5Checkpoint;
    const humanResult = verdict ?? 'ambiguous';
    const accessibilityResult = checkpointName === 'gate-e-accessibility'
      ? accessibilitySession.recordGateOutcome(humanResult)
      : 'match';
    const result = accessibilityResult === 'match'
      ? activeSession.confirmCheckpoint(checkpointName, humanResult)
      : activeSession.fail();
    process.stdout.write(`da5_v5_checkpoint_confirmation=${result}\n`);
    return result === 'match'
      ? { state: 'continue' }
      : fail(activeSession, 'da5_v5_checkpoint=mismatch');
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
      || !employeeInstallationTransition.matched()
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
        'gate-e-accessibility',
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
      && accessibilitySession.canProceedToGateF()
      && offline.complete() === 'match'
      && device.getState() === 'standard-restored'
      && activeEnvironment.da5V5FixtureState() === 'terminal'
      && nextCredentialPhase === credentialPhases.length
      && androidInstalled
      && employeeInstallationTransition.matched()
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

function accessibilityGatePreparationBoundaryMatches(
  session: Da5V5OperationSession,
  activeEnvironment: SyntheticAndroidE2eEnvironment,
): boolean {
  return da5V5SessionBoundaryMatches(
    session,
    'gate-d-protected-relaunch',
    'gate-e-accessibility',
  )
    && offline.getState().state === 'complete'
    && activeEnvironment.da5V5FixtureState() === 'terminal'
    && device.getState() === 'protected-relaunch-complete';
}

function accessibilityGateCheckBoundaryMatches(
  session: Da5V5OperationSession,
  activeEnvironment: SyntheticAndroidE2eEnvironment,
): boolean {
  return da5V5SessionBoundaryMatches(
    session,
    'gate-d-protected-relaunch',
    'gate-e-accessibility',
  )
    && offline.getState().state === 'complete'
    && activeEnvironment.da5V5FixtureState() === 'terminal'
    && accessibilitySession.profileChangePrepared()
    && device.getState() === 'accessibility-restore-required';
}

function accessibilityGateSurfaceBoundaryMatches(
  session: Da5V5OperationSession,
  activeEnvironment: SyntheticAndroidE2eEnvironment,
): boolean {
  return da5V5SessionBoundaryMatches(
    session,
    'gate-d-protected-relaunch',
    'gate-e-accessibility',
  )
    && offline.getState().state === 'complete'
    && activeEnvironment.da5V5FixtureState() === 'terminal'
    && device.getState() === 'accessibility-confirmed';
}

async function checkpointOperatorStateMatches(
  checkpoint: Da5V5Checkpoint,
  activeEnvironment: SyntheticAndroidE2eEnvironment,
  activeSession: Da5V5OperationSession,
): Promise<boolean> {
  switch (checkpoint) {
    case 'gate-a-setup-rejections': {
      const tagRoles = await activeEnvironment.da5V5TagRoleState();
      return employeeInstallationTransition.matched()
        && nextCredentialPhase === credentialPhases.length
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
      return device.getState() === 'accessibility-confirmed'
        && accessibilitySession.surfacesComplete()
        && offline.getState().state === 'complete'
        && activeEnvironment.da5V5FixtureState() === 'terminal';
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
        && accessibilitySession.canProceedToGateF()
        && device.getState() === 'standard-restored'
        && activeEnvironment.da5V5FixtureState() === 'terminal'
        && activeSession.state().confirmedCheckpoint === 'gate-e-accessibility';
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
      'gate-c-general-complete',
      'gate-d-customer-first-pending',
    )
      && device.getState() === 'cold-dispatch-prepared';
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

interface Da5V5EmployeeInstallationBoundarySnapshot {
  readonly status: Da5V5Status;
  readonly tagRoles: Da5V5TagRoleState;
}

async function readEmployeeInstallationBoundary(
  activeEnvironment: SyntheticAndroidE2eEnvironment,
  activeSession: Da5V5OperationSession,
  credentialsCompleted = 2,
): Promise<Da5V5EmployeeInstallationBoundarySnapshot | null> {
  const credentialState = mobileCredential.state();
  if (
    nextCredentialPhase !== credentialsCompleted
    || credentialState.phase !== null
    || credentialState.state !== 'idle'
    || !androidInstalled
    || !physicalTagBindingConfirmed
    || preinstall.state() !== 'matched'
    || !da5V5SessionBoundaryMatches(
      activeSession,
      null,
      'gate-a-setup-rejections',
    )
    || activeEnvironment.da5V5TagRegistrationState() !== 'disarmed'
    || offline.getState().state !== 'direct-ordinary'
  ) {
    return null;
  }
  const [status, tagRoles] = await Promise.all([
    activeEnvironment.da5V5Status(),
    activeEnvironment.da5V5TagRoleState(),
  ]);
  commandExecutionGuard.ensure();
  if (
    !sameDa5V5Status(status, DA5_V5_TAG_B_REGISTRATION_ARM_STATUS)
    || !da5V5TagBRegistrationPreconditionMatches(status, tagRoles)
  ) {
    return null;
  }
  return Object.freeze({ status, tagRoles });
}

function employeeInstallationBoundarySnapshotsMatch(
  before: Da5V5EmployeeInstallationBoundarySnapshot,
  after: Da5V5EmployeeInstallationBoundarySnapshot,
): boolean {
  return sameDa5V5Status(before.status, after.status)
    && before.tagRoles.activeTagAAssignments === after.tagRoles.activeTagAAssignments
    && before.tagRoles.activeTagACustomerAAssignments
      === after.tagRoles.activeTagACustomerAAssignments
    && before.tagRoles.activeTagBAssignments === after.tagRoles.activeTagBAssignments
    && before.tagRoles.tagAExactRecords === after.tagRoles.tagAExactRecords
    && before.tagRoles.tagARecords === after.tagRoles.tagARecords
    && before.tagRoles.tagBExactRecords === after.tagRoles.tagBExactRecords
    && before.tagRoles.tagBRecords === after.tagRoles.tagBRecords
    && before.tagRoles.tagBTotalAssignments === after.tagRoles.tagBTotalAssignments
    && before.tagRoles.tagXRecords === after.tagRoles.tagXRecords;
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
      accessibility: accessibilitySession.state(),
      accessibilityCredentialTransfer: accessibilityCredential.state(),
      credentialsCompleted: nextCredentialPhase,
      credentialTransfer: mobileCredential.state(),
      dedupe: activeEnvironment.da5V5DedupeState(),
      device: device.getState(),
      employeeInstallationTransition: employeeInstallationTransition.getState(),
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
    || checkpoint === 'gate-e-accessibility'
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
): Da5V5OperatorCommandOutcome {
  session.fail();
  if (accessibilitySession.requiresRestoreProof()) {
    accessibilitySession.fail();
    accessibilityFailureEvent ??= event;
    process.stdout.write('da5_v5_accessibility_restore_required=match\n');
    return { state: 'continue' };
  }
  return { state: 'fail', event };
}

async function readHiddenCredential(): Promise<Buffer> {
  return readDa5V5HiddenCredential(
    inputOwnership,
    process.stdin,
    () => process.stdout.write('synthetic_password_input_ready\n'),
  );
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
    const submitCommand = async () => {
      await operatorLifecycle?.submit(() => handleCommand(line));
    };
    const restorationRequired = accessibilitySession.requiresRestoreProof();
    const submission = restorationRequired
      ? commandSubmissionTail.then(submitCommand)
      : submitCommand();
    if (restorationRequired) {
      commandSubmissionTail = submission.then(
        () => undefined,
        () => undefined,
      );
    }
    observeBackgroundOperation(submission.finally(() => {
      startCommandInput();
    }));
  });
  commandInput.once('close', () => {
    if (inputOwnership.command() !== commandInput) return;
    observeBackgroundOperation(
      operatorLifecycle?.abortAndFail('operator_command_failed'),
    );
  });
}

function cleanupResources(): Promise<void> {
  if (cleanupResourcesPromise !== null) {
    return cleanupResourcesPromise;
  }
  cleanupResourcesPromise = startupAcquisitionSettlement.wait().then(
    () => performCleanupResources(),
  );
  return cleanupResourcesPromise;
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

  await stage('accessibility-restore-proof', () => {
    if (!accessibilitySession.cleanupAllowed()) {
      throw new Error('DA5 V5 accessibility restore proof is unavailable');
    }
  });
  await stage('input', () => inputOwnership.closeAll());
  await stage('password', () => passwordBinding.destroy());
  await stage('offline', async () => {
    if (await offline.settleForTerminalCleanup() !== 'match') {
      throw new Error('DA5 V5 offline cleanup mismatch');
    }
  });
  await stage('android', async () => {
    const cleanup = await cleanupDa5V5AndroidState({
      deviceBinding: standardBinding,
      profile,
      runner: mobileAdb,
      serialBinding: deviceLock,
      transaction: androidInstallTransaction,
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
  await stage('runtime-guard-artifact-revalidate', async () => {
    await runtimeGuardArtifact?.revalidate();
  });
  await stage('runtime-guard-artifact-close', async () => {
    await runtimeGuardArtifact?.close();
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

function observeBackgroundOperation(operation: Promise<unknown> | undefined): void {
  void settleDa5V5BackgroundOperation(operation, () => {
    process.exitCode = 1;
  });
}

function reportSafeEvent(event: SyntheticEnvironmentSafeEvent): void {
  process.stdout.write(`synthetic_e2e_event=${event}\n`);
  if (safeEventLatch.observe(event) === 'failed') {
    process.exitCode = 1;
    mutationAbortController.abort();
    inputOwnership.closeAll();
    observeBackgroundOperation(
      operatorLifecycle?.abortAndFail('operator_command_failed'),
    );
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

function employeePreparedCommandAllowed(normalized: string): boolean {
  return normalized === 'credential-field-ready employee EMPTY_ACTIVE'
    || normalized === 'credential-check employee'
    || /^credential-field-confirm employee (VISIBLE|EMPTY|AMBIGUOUS)$/u.test(normalized)
    || /^employee-ready-confirm (PASS|FAIL|AMBIGUOUS)$/u.test(normalized);
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error('Missing required DA5 V5 environment value');
  }
  return value;
}
