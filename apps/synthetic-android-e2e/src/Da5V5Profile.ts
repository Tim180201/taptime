import { createHash, timingSafeEqual } from 'node:crypto';

export const DA5_V5_PROFILE = 'da5-v5';

export const DA5_V5_PUBLIC_MANIFEST = Object.freeze({
  customerALabel: 'DA5 V5 Customer A',
  customerBLabel: 'DA5 V5 Customer B',
  projectLabel: 'DA5 V5 Project',
  generalWorkLabel: 'Allgemeine Arbeitszeit',
  tagALabel: 'DA5 V5 Tag A',
  tagBLabel: 'DA5 V5 Tag B',
  tagXLabel: 'DA5 V5 Tag X',
  setupPreviewLabel: 'DA5 V5 Preview 2',
  operations: Object.freeze([
    'Admin Setup Preview 2',
    'Cold Tag Dispatch',
    'Background Tag Dispatch',
    'Manual Customer Trigger',
    'Manual Project Trigger',
    'Manual General Work Trigger',
    'Lifecycle Cancellation',
    'Protected Review Fixture',
  ]),
} as const);

export type Da5V5TagRole = 'tag-a' | 'tag-b' | 'tag-x';

export interface Da5V5TagBinding {
  readonly tagA: string;
  readonly tagB: string;
  readonly tagX: string;
  readonly technology: 'NfcA+MifareUltralight';
}

export function requireDa5V5Profile(value: string | undefined): typeof DA5_V5_PROFILE {
  if (value !== DA5_V5_PROFILE) {
    throw new Error('DA5 V5 requires the exact explicit synthetic profile');
  }
  return value;
}

export function validateDa5V5TagBinding(input: {
  readonly tagA: string;
  readonly tagB: string;
  readonly tagX: string;
  readonly technology: string;
}): Da5V5TagBinding {
  const fingerprints = [input.tagA, input.tagB, input.tagX];
  if (!fingerprints.every((value) => /^[0-9A-F]{12}$/.test(value))) {
    throw new Error('DA5 V5 Tag fingerprints must be uppercase 12-hex values');
  }
  if (new Set(fingerprints).size !== fingerprints.length) {
    throw new Error('DA5 V5 Tag fingerprints must be distinct');
  }
  if (input.technology !== 'NfcA+MifareUltralight') {
    throw new Error('DA5 V5 Tag technology is outside the packaged manifest boundary');
  }
  return Object.freeze({
    tagA: input.tagA,
    tagB: input.tagB,
    tagX: input.tagX,
    technology: input.technology,
  });
}

export class Da5V5MemoryOnlyPasswordBinding {
  private digest: Buffer | null;

  constructor(password: string | Buffer) {
    this.digest = digest(password);
  }

  compare(candidate: Buffer): 'match' | 'mismatch' {
    if (this.digest === null || !isDa5V5SyntheticCredential(candidate)) {
      return 'mismatch';
    }
    const candidateDigest = digest(candidate);
    try {
      return timingSafeEqual(candidateDigest, this.digest) ? 'match' : 'mismatch';
    } finally {
      candidateDigest.fill(0);
    }
  }

  destroy(): void {
    this.digest?.fill(0);
    this.digest = null;
  }
}

export function da5V5SyntheticCredentialBuffer(value: string): Buffer {
  const candidate = Buffer.from(value, 'ascii');
  if (!isDa5V5SyntheticCredential(candidate) || candidate.toString('ascii') !== value) {
    candidate.fill(0);
    throw new Error('DA5 V5 synthetic credential must be exact 64-hex ASCII');
  }
  return candidate;
}

function isDa5V5SyntheticCredential(value: Buffer): boolean {
  return value.length === 64 && /^[0-9a-fA-F]{64}$/u.test(value.toString('ascii'));
}

function digest(value: string | Buffer): Buffer {
  if (typeof value === 'string') {
    const candidate = da5V5SyntheticCredentialBuffer(value);
    try {
      return createHash('sha256').update(candidate).digest();
    } finally {
      candidate.fill(0);
    }
  }
  if (!isDa5V5SyntheticCredential(value)) {
    throw new Error('DA5 V5 synthetic credential must be exact 64-hex ASCII');
  }
  return createHash('sha256').update(value).digest();
}
