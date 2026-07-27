export const DA5_V5_VALIDATION_TECHNOLOGY =
  'NfcA+MifareUltralight' as const;
export type Da5V5ValidationTechnology =
  typeof DA5_V5_VALIDATION_TECHNOLOGY;

export type Da5V5ValidationCapability =
  | 'ready'
  | 'not_supported'
  | 'disabled';

export type Da5V5ValidationCaptureResult =
  | {
    readonly status: 'captured';
    readonly fingerprint: string;
    readonly technology: Da5V5ValidationTechnology;
  }
  | {
    readonly status:
      | 'cancelled'
      | 'concurrent_rejected'
      | 'technology_rejected'
      | 'timed_out'
      | 'unavailable'
      | 'unreadable';
  };

export interface Da5V5ValidationCapturePort {
  checkCapability(): Promise<Da5V5ValidationCapability>;
  capture(): Promise<Da5V5ValidationCaptureResult>;
  cancelCapture(): Promise<void>;
  stop(): Promise<void>;
}
