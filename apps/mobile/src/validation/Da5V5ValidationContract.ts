export const DA5_V5_VALIDATION_TECHNOLOGY =
  'NfcA+MifareUltralight' as const;
export type Da5V5ValidationTechnology =
  typeof DA5_V5_VALIDATION_TECHNOLOGY;

export type Da5V5ValidationCapability =
  | 'ready'
  | 'not_supported'
  | 'disabled';

export const DA5_V5_VALIDATION_CAPTURE_FAILURE_STAGES = [
  'technology_evidence',
  'uid_readability',
  'listener_registration',
  'digest',
  'concurrency',
  'cleanup',
] as const;
export type Da5V5ValidationCaptureFailureStage =
  typeof DA5_V5_VALIDATION_CAPTURE_FAILURE_STAGES[number];

export type Da5V5ValidationCaptureResult =
  | {
    readonly status: 'captured';
    readonly fingerprint: string;
    readonly technology: Da5V5ValidationTechnology;
  }
  | {
    readonly status: 'cancelled' | 'timed_out';
  }
  | {
    readonly status: 'failed';
    readonly failureStage: Da5V5ValidationCaptureFailureStage;
  };

export interface Da5V5ValidationCapturePort {
  checkCapability(): Promise<Da5V5ValidationCapability>;
  capture(): Promise<Da5V5ValidationCaptureResult>;
  cancelCapture(): Promise<void>;
  stop(): Promise<void>;
}
