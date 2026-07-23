import { createHash, timingSafeEqual } from 'node:crypto';

export const DA4_V5_PROFILE = 'da4-v5';

export const DA4_V5_PUBLIC_MANIFEST = Object.freeze({
  customerLabel: 'DA4 V5 Browser Customer',
  invitationDisplayName: 'DA4 V5 Browser Employee',
  reassignmentTagLabel: 'DA4 V5 Reassignment Tag',
  initialAssignmentTargetLabel: 'Synthetic Android Customer',
  reassignmentTargetLabel: 'Synthetic Reassignment Target',
  correctionTargetEmployeeLabel: 'DA4 V5 Correction Target',
  correctionReason: 'DA4 V5 correction observation',
  oldestReviewTargetEmployeeLabel: 'DA4 V5 Oldest Review Target',
  adjudicationReason: 'DA4 V5 adjudication observation',
  adjudicationResolution: 'no_time_record_change',
} as const);

export type Da4V5ReadSection = 'setup' | 'employees' | 'time-records' | 'review-items';

export const DA4_V5_READ_PROJECTION_ROUTES: Readonly<Record<Da4V5ReadSection, string>> =
  Object.freeze({
    setup: '/v1/administration/setup-projection',
    employees: '/v1/administration/employee-memberships-projection',
    'time-records': '/v1/administration/time-records/query',
    'review-items': '/v1/administration/review-items/query',
  });

export interface Da4V5FixtureManifest {
  readonly adjudicationReason: typeof DA4_V5_PUBLIC_MANIFEST.adjudicationReason;
  readonly adjudicationResolution: typeof DA4_V5_PUBLIC_MANIFEST.adjudicationResolution;
  readonly correctionOriginalStartedAt: string;
  readonly correctionOriginalStoppedAt: string;
  readonly correctionReason: typeof DA4_V5_PUBLIC_MANIFEST.correctionReason;
  readonly correctionTargetEmployeeLabel:
    typeof DA4_V5_PUBLIC_MANIFEST.correctionTargetEmployeeLabel;
  readonly correctionTransformedStartedAt: string;
  readonly correctionTransformedStoppedAt: string;
  readonly customerLabel: typeof DA4_V5_PUBLIC_MANIFEST.customerLabel;
  readonly initialAssignmentTargetLabel:
    typeof DA4_V5_PUBLIC_MANIFEST.initialAssignmentTargetLabel;
  readonly invitationDisplayName: typeof DA4_V5_PUBLIC_MANIFEST.invitationDisplayName;
  readonly oldestReviewTargetEmployeeLabel:
    typeof DA4_V5_PUBLIC_MANIFEST.oldestReviewTargetEmployeeLabel;
  readonly reassignmentTagLabel: typeof DA4_V5_PUBLIC_MANIFEST.reassignmentTagLabel;
  readonly reassignmentTargetLabel: typeof DA4_V5_PUBLIC_MANIFEST.reassignmentTargetLabel;
}

export function requireDa4V5Profile(value: string | undefined): typeof DA4_V5_PROFILE {
  if (value !== DA4_V5_PROFILE) {
    throw new Error('DA4 V5 requires the exact explicit synthetic profile');
  }
  return value;
}

export class MemoryOnlySyntheticPasswordBinding {
  private digest: Buffer | null;

  constructor(password: string) {
    this.digest = hashPassword(password);
  }

  compare(candidate: string): 'match' | 'mismatch' {
    if (this.digest === null) {
      return 'mismatch';
    }
    const actual = hashPassword(candidate);
    try {
      return timingSafeEqual(actual, this.digest) ? 'match' : 'mismatch';
    } finally {
      actual.fill(0);
    }
  }

  destroy(): void {
    this.digest?.fill(0);
    this.digest = null;
  }
}

export function validateDa4V5Timezone(
  timeZone: string,
  manifest: Da4V5FixtureManifest,
): 'match' | 'mismatch' {
  try {
    const instants = [
      manifest.correctionOriginalStartedAt,
      manifest.correctionOriginalStoppedAt,
      manifest.correctionTransformedStartedAt,
      manifest.correctionTransformedStoppedAt,
    ];
    return instants.every((instant) => hasUniqueLocalRoundTrip(instant, timeZone))
      ? 'match'
      : 'mismatch';
  } catch {
    return 'mismatch';
  }
}

function hashPassword(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function hasUniqueLocalRoundTrip(instant: string, timeZone: string): boolean {
  const date = new Date(instant);
  if (!Number.isFinite(date.valueOf())) {
    return false;
  }
  const expected = localParts(date, timeZone);
  let matches = 0;
  const naiveUtc = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
    expected.second,
  );
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const candidate = new Date(naiveUtc + offsetMinutes * 60_000);
    if (sameLocalParts(localParts(candidate, timeZone), expected)) {
      matches += 1;
    }
  }
  return matches === 1;
}

interface LocalParts {
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly month: number;
  readonly second: number;
  readonly year: number;
}

function localParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    second: '2-digit',
  });
  const values = new Map(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}

function sameLocalParts(left: LocalParts, right: LocalParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second;
}
