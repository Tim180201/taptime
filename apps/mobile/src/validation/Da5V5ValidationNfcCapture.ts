import { Platform } from 'react-native';
import NfcManager, { NfcEvents, type TagEvent } from 'react-native-nfc-manager';
import {
  DA5_V5_VALIDATION_CAPTURE_FAILURE_STAGES,
  DA5_V5_VALIDATION_TECHNOLOGY,
  type Da5V5ValidationCapability,
  type Da5V5ValidationCaptureFailureStage,
  type Da5V5ValidationCapturePort,
  type Da5V5ValidationCaptureResult,
} from './Da5V5ValidationContract';

export {
  DA5_V5_VALIDATION_CAPTURE_FAILURE_STAGES,
  DA5_V5_VALIDATION_TECHNOLOGY,
  type Da5V5ValidationCapability,
  type Da5V5ValidationCaptureFailureStage,
  type Da5V5ValidationCapturePort,
  type Da5V5ValidationCaptureResult,
  type Da5V5ValidationTechnology,
} from './Da5V5ValidationContract';

interface NativeNfcManager {
  start(): Promise<void> | void;
  isSupported(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  registerTagEvent(): Promise<void> | void;
  unregisterTagEvent(): Promise<void> | void;
  setEventListener(
    event: typeof NfcEvents.DiscoverTag,
    listener: ((tag: TagEvent) => void) | null,
  ): void;
}

export interface Da5V5ValidationNfcCaptureOptions {
  readonly platform?: string;
  readonly manager?: NativeNfcManager;
  readonly digestCanonicalPayload: (canonicalPayload: string) => Promise<string>;
  readonly timeoutMilliseconds?: number;
  readonly scheduleTimeout?: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>;
  readonly clearScheduledTimeout?: (
    handle: ReturnType<typeof setTimeout>,
  ) => void;
  readonly cleanupTimeoutMilliseconds?: number;
  readonly scheduleCleanupTimeout?: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>;
  readonly clearScheduledCleanupTimeout?: (
    handle: ReturnType<typeof setTimeout>,
  ) => void;
}

interface ActiveCapture {
  readonly finish: (result: Da5V5ValidationCaptureResult) => Promise<void>;
}

const DEFAULT_CAPTURE_TIMEOUT_MILLISECONDS = 20_000;
const DEFAULT_CLEANUP_TIMEOUT_MILLISECONDS = 2_000;
const SAFE_FINGERPRINT_PATTERN = /^[0-9A-F]{12}$/u;
const SHA256_PATTERN = /^[0-9A-Fa-f]{64}$/u;
const UID_HEX_PATTERN = /^[0-9A-Fa-f]+$/u;
const CANONICAL_UID_PREFIX = 'nfc:uid:v1:';
const MINIMUM_UID_HEX_LENGTH = 2;
const MAXIMUM_UID_HEX_LENGTH = 64;
const ALLOWED_NATIVE_TECHNOLOGIES = Object.freeze([
  'android.nfc.tech.MifareUltralight',
  'android.nfc.tech.NfcA',
  'android.nfc.tech.Ndef',
  'android.nfc.tech.NdefFormatable',
]);
const REQUIRED_NATIVE_TECHNOLOGIES = Object.freeze([
  'android.nfc.tech.MifareUltralight',
  'android.nfc.tech.NfcA',
]);

/**
 * Validation-only native capture boundary.
 *
 * Raw UID, canonical payload and the native technology list remain local variables inside this
 * class. The only successful result crossing the boundary is the disclosure-safe fingerprint
 * plus the closed technology label.
 */
export class Da5V5ValidationNfcCapture
implements Da5V5ValidationCapturePort {
  private readonly platform: string;
  private readonly manager: NativeNfcManager;
  private readonly timeoutMilliseconds: number;
  private readonly scheduleTimeout: NonNullable<
    Da5V5ValidationNfcCaptureOptions['scheduleTimeout']
  >;
  private readonly clearScheduledTimeout: NonNullable<
    Da5V5ValidationNfcCaptureOptions['clearScheduledTimeout']
  >;
  private readonly cleanupTimeoutMilliseconds: number;
  private readonly scheduleCleanupTimeout: NonNullable<
    Da5V5ValidationNfcCaptureOptions['scheduleCleanupTimeout']
  >;
  private readonly clearScheduledCleanupTimeout: NonNullable<
    Da5V5ValidationNfcCaptureOptions['clearScheduledCleanupTimeout']
  >;
  private started = false;
  private startFlight: Promise<void> | null = null;
  private captureFlight: Promise<Da5V5ValidationCaptureResult> | null = null;
  private registrationDrain: Promise<void> | null = null;
  private activeCapture: ActiveCapture | null = null;
  private cleanupFailed = false;
  private lifecycleGeneration = 0;

  constructor(
    private readonly options: Da5V5ValidationNfcCaptureOptions,
  ) {
    this.platform = options.platform ?? Platform.OS;
    this.manager = options.manager ?? NfcManager;
    this.timeoutMilliseconds = options.timeoutMilliseconds
      ?? DEFAULT_CAPTURE_TIMEOUT_MILLISECONDS;
    this.scheduleTimeout = options.scheduleTimeout ?? setTimeout;
    this.clearScheduledTimeout = options.clearScheduledTimeout ?? clearTimeout;
    this.cleanupTimeoutMilliseconds = options.cleanupTimeoutMilliseconds
      ?? DEFAULT_CLEANUP_TIMEOUT_MILLISECONDS;
    this.scheduleCleanupTimeout = options.scheduleCleanupTimeout ?? setTimeout;
    this.clearScheduledCleanupTimeout = options.clearScheduledCleanupTimeout
      ?? clearTimeout;
  }

  async checkCapability(): Promise<Da5V5ValidationCapability> {
    if (this.platform !== 'android') {
      return 'not_supported';
    }
    if (!await this.manager.isSupported()) {
      return 'not_supported';
    }
    await this.ensureStarted();
    return await this.manager.isEnabled() ? 'ready' : 'disabled';
  }

  capture(): Promise<Da5V5ValidationCaptureResult> {
    if (this.cleanupFailed || this.registrationDrain !== null) {
      return Promise.resolve(captureFailure('cleanup'));
    }
    if (this.captureFlight !== null) {
      return Promise.resolve(captureFailure('concurrency'));
    }
    const generation = this.lifecycleGeneration;
    const operation = this.performCapture(generation);
    const flight = operation.finally(() => {
      if (this.captureFlight === flight) {
        this.captureFlight = null;
      }
    });
    this.captureFlight = flight;
    return flight;
  }

  async cancelCapture(): Promise<void> {
    await this.activeCapture?.finish({ status: 'cancelled' });
  }

  async stop(): Promise<void> {
    this.lifecycleGeneration += 1;
    await this.cancelCapture().catch((error: unknown) => {
      this.recordCleanupFailure(error);
    });
    try {
      this.manager.setEventListener(NfcEvents.DiscoverTag, null);
    } catch (error) {
      this.recordCleanupFailure(error);
    }
    if (this.cleanupFailed) {
      throw new Error('DA5 V5 Validation native cleanup failed closed');
    }
    const pending: Promise<unknown>[] = [];
    if (this.captureFlight !== null) {
      pending.push(this.captureFlight);
    }
    if (this.registrationDrain !== null) {
      pending.push(this.registrationDrain);
    }
    if (pending.length > 0) {
      await this.awaitBoundedCleanup(Promise.all(pending).then(() => undefined))
        .catch((error: unknown) => {
          this.recordCleanupFailure(error);
        });
    }
    if (this.cleanupFailed) {
      throw new Error('DA5 V5 Validation native cleanup failed closed');
    }
  }

  private async performCapture(
    generation: number,
  ): Promise<Da5V5ValidationCaptureResult> {
    if (this.platform !== 'android') {
      return captureFailure('listener_registration');
    }
    try {
      await this.ensureStarted();
    } catch {
      return captureFailure('listener_registration');
    }
    if (generation !== this.lifecycleGeneration) {
      return { status: 'cancelled' };
    }

    return new Promise<Da5V5ValidationCaptureResult>((resolve) => {
      let settled = false;
      let cleanupFlight: Promise<void> | null = null;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      let registrationFailed = false;
      let releaseRegistrationSettlement!: () => void;
      const registrationSettlement = new Promise<void>((release) => {
        releaseRegistrationSettlement = release;
      });

      const capture: ActiveCapture = {
        finish: (result) => {
          if (cleanupFlight !== null) {
            return cleanupFlight;
          }
          if (settled) {
            return Promise.resolve();
          }
          settled = true;
          if (timeoutHandle !== null) {
            this.clearScheduledTimeout(timeoutHandle);
            timeoutHandle = null;
          }
          try {
            this.manager.setEventListener(NfcEvents.DiscoverTag, null);
          } catch (error) {
            this.recordCleanupFailure(error);
          }
          const nativeCleanup = this.holdRegistrationDrain(
            registrationSettlement,
          );
          cleanupFlight = this.awaitBoundedCleanup(nativeCleanup)
            .then(
              () => {
                if (this.cleanupFailed) {
                  return captureFailure('cleanup');
                }
                if (registrationFailed) {
                  return captureFailure('listener_registration');
                }
                return result;
              },
              (error: unknown) => {
                this.recordCleanupFailure(error);
                return captureFailure('cleanup');
              },
            )
            .then((finalResult) => {
              if (this.activeCapture === capture) {
                this.activeCapture = null;
              }
              resolve(finalResult);
            });
          return cleanupFlight;
        },
      };
      this.activeCapture = capture;

      try {
        this.manager.setEventListener(NfcEvents.DiscoverTag, (tag) => {
          void this.reduceNativeTag(tag)
            .then((result) => capture.finish(result))
            .catch(() => capture.finish(
              captureFailure('listener_registration'),
            ));
        });
      } catch {
        releaseRegistrationSettlement();
        this.activeCapture = null;
        resolve(captureFailure('listener_registration'));
        return;
      }

      timeoutHandle = this.scheduleTimeout(() => {
        void capture.finish({ status: 'timed_out' });
      }, this.timeoutMilliseconds);

      let registration: Promise<void>;
      try {
        registration = Promise.resolve(this.manager.registerTagEvent());
      } catch {
        registrationFailed = true;
        releaseRegistrationSettlement();
        void capture.finish(captureFailure('listener_registration'));
        return;
      }
      void registration.then(
        () => {
          releaseRegistrationSettlement();
        },
        () => {
          registrationFailed = true;
          releaseRegistrationSettlement();
          void capture.finish(captureFailure('listener_registration'));
        },
      );
    });
  }

  private async reduceNativeTag(
    tag: TagEvent,
  ): Promise<Da5V5ValidationCaptureResult> {
    try {
      if (!hasAllowedTechnologyEvidence(tag.techTypes)) {
        return captureFailure('technology_evidence');
      }
    } catch {
      return captureFailure('technology_evidence');
    }
    let uid: unknown;
    try {
      uid = tag.id;
    } catch {
      return captureFailure('uid_readability');
    }
    if (typeof uid !== 'string') {
      return captureFailure('uid_readability');
    }
    let canonicalPayload: string;
    try {
      canonicalPayload = createValidationCanonicalUidPayload(uid);
    } catch {
      return captureFailure('uid_readability');
    }
    let digest: string;
    try {
      digest = await this.options.digestCanonicalPayload(canonicalPayload);
    } catch {
      return captureFailure('digest');
    }
    if (!SHA256_PATTERN.test(digest)) {
      return captureFailure('digest');
    }
    const fingerprint = digest.slice(0, 12).toUpperCase();
    if (!SAFE_FINGERPRINT_PATTERN.test(fingerprint)) {
      return captureFailure('digest');
    }
    return Object.freeze({
      status: 'captured',
      fingerprint,
      technology: DA5_V5_VALIDATION_TECHNOLOGY,
    });
  }

  private ensureStarted(): Promise<void> {
    if (this.started) {
      return Promise.resolve();
    }
    if (this.startFlight !== null) {
      return this.startFlight;
    }
    const operation = Promise.resolve(this.manager.start()).then(() => {
      this.started = true;
    });
    const flight = operation.finally(() => {
      if (this.startFlight === flight) {
        this.startFlight = null;
      }
    });
    this.startFlight = flight;
    return flight;
  }

  private unregisterNativeCapture(): Promise<void> {
    return Promise.resolve()
      .then(() => this.manager.unregisterTagEvent());
  }

  private holdRegistrationDrain(
    registrationSettlement: Promise<void>,
  ): Promise<void> {
    if (this.registrationDrain !== null) {
      return this.registrationDrain;
    }
    const drain = registrationSettlement
      .then(() => this.unregisterNativeCapture());
    this.registrationDrain = drain;
    void drain.then(
      () => {
        if (this.registrationDrain === drain) {
          this.registrationDrain = null;
        }
      },
      (error: unknown) => {
        this.recordCleanupFailure(error);
        if (this.registrationDrain === drain) {
          this.registrationDrain = null;
        }
      },
    );
    return drain;
  }

  private awaitBoundedCleanup(operation: Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeoutHandle = this.scheduleCleanupTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('DA5 V5 Validation native cleanup timed out'));
        }
      }, this.cleanupTimeoutMilliseconds);
      void operation.then(
        () => {
          if (!settled) {
            settled = true;
            this.clearScheduledCleanupTimeout(timeoutHandle);
            resolve();
          }
        },
        (error: unknown) => {
          if (!settled) {
            settled = true;
            this.clearScheduledCleanupTimeout(timeoutHandle);
            reject(error);
          }
        },
      );
    });
  }

  private recordCleanupFailure(_error: unknown): void {
    this.cleanupFailed = true;
  }
}

function captureFailure(
  failureStage: Da5V5ValidationCaptureFailureStage,
): Da5V5ValidationCaptureResult {
  return Object.freeze({
    status: 'failed',
    failureStage,
  });
}

export function createValidationCanonicalUidPayload(uidHex: string): string {
  if (
    uidHex.length < MINIMUM_UID_HEX_LENGTH
    || uidHex.length > MAXIMUM_UID_HEX_LENGTH
    || uidHex.length % 2 !== 0
    || !UID_HEX_PATTERN.test(uidHex)
  ) {
    throw new Error(
      'Validation NFC UID must be an even-length 1-32 byte hexadecimal value',
    );
  }
  return `${CANONICAL_UID_PREFIX}${uidHex.toUpperCase()}`;
}

export function hasAllowedTechnologyEvidence(
  technologyList: readonly string[] | undefined,
): boolean {
  if (
    !Array.isArray(technologyList)
    || technologyList.length < REQUIRED_NATIVE_TECHNOLOGIES.length
    || technologyList.length > ALLOWED_NATIVE_TECHNOLOGIES.length
    || new Set(technologyList).size !== technologyList.length
  ) {
    return false;
  }
  const technologies = new Set(technologyList);
  return technologyList.every(
    (technology) => ALLOWED_NATIVE_TECHNOLOGIES.includes(technology),
  ) && REQUIRED_NATIVE_TECHNOLOGIES.every(
    (technology) => technologies.has(technology),
  );
}
