import whiteSpaceRanges from '@unicode/unicode-15.1.0/Binary_Property/White_Space/ranges.js';
import controlRanges from '@unicode/unicode-15.1.0/General_Category/Control/ranges.js';
import formatRanges from '@unicode/unicode-15.1.0/General_Category/Format/ranges.js';
import lineSeparatorRanges from '@unicode/unicode-15.1.0/General_Category/Line_Separator/ranges.js';
import paragraphSeparatorRanges from '@unicode/unicode-15.1.0/General_Category/Paragraph_Separator/ranges.js';
import privateUseRanges from '@unicode/unicode-15.1.0/General_Category/Private_Use/ranges.js';
import surrogateRanges from '@unicode/unicode-15.1.0/General_Category/Surrogate/ranges.js';
import unassignedRanges from '@unicode/unicode-15.1.0/General_Category/Unassigned/ranges.js';

interface UnicodeRange {
  readonly begin: number;
  readonly end: number;
}

export type TapTimeNameKind = 'customer' | 'organization' | 'tag';

export type TapTimeNameResult =
  | { readonly status: 'valid'; readonly canonicalName: string }
  | { readonly status: 'invalid' };

export type OrganizationNameResult = TapTimeNameResult;

const prohibitedRanges: readonly UnicodeRange[] = Object.freeze([
  ...controlRanges,
  ...formatRanges,
  ...surrogateRanges,
  ...privateUseRanges,
  ...unassignedRanges,
  ...lineSeparatorRanges,
  ...paragraphSeparatorRanges,
].sort((left, right) => left.begin - right.begin));

const bounds = Object.freeze({
  customer: { scalarMaximum: 120, byteMaximum: 480 },
  organization: { scalarMaximum: 120, byteMaximum: 480 },
  tag: { scalarMaximum: 80, byteMaximum: 320 },
} satisfies Readonly<Record<TapTimeNameKind, {
  readonly scalarMaximum: number;
  readonly byteMaximum: number;
}>>);

export function normalizeTapTimeNameV1(input: string, kind: TapTimeNameKind): TapTimeNameResult {
  if (Buffer.byteLength(input, 'utf8') > 4_096) {
    return { status: 'invalid' };
  }

  // Node 24 knows later Unicode versions. Reject every code point that was Cn/Cs in 15.1
  // before its newer normalizer can assign combining behavior unknown to PostgreSQL 17.
  if (Array.from(input).some((value) => {
    const codePoint = value.codePointAt(0)!;
    return inRanges(codePoint, unassignedRanges) || inRanges(codePoint, surrogateRanges);
  })) {
    return { status: 'invalid' };
  }

  const normalized = input.normalize('NFC');
  const codePoints = Array.from(normalized);
  let start = 0;
  let end = codePoints.length;
  while (start < end && inRanges(codePoints[start]!.codePointAt(0)!, whiteSpaceRanges)) {
    start += 1;
  }
  while (end > start && inRanges(codePoints[end - 1]!.codePointAt(0)!, whiteSpaceRanges)) {
    end -= 1;
  }

  const canonicalName = codePoints.slice(start, end).join('');
  const canonicalCodePoints = Array.from(canonicalName);
  const selectedBounds = bounds[kind];
  if (
    canonicalCodePoints.length < 1
    || canonicalCodePoints.length > selectedBounds.scalarMaximum
    || Buffer.byteLength(canonicalName, 'utf8') > selectedBounds.byteMaximum
    || canonicalCodePoints.some((value) => inRanges(value.codePointAt(0)!, prohibitedRanges))
  ) {
    return { status: 'invalid' };
  }
  return Object.freeze({ status: 'valid', canonicalName });
}

export function normalizeOrganizationNameV1(input: string): OrganizationNameResult {
  return normalizeTapTimeNameV1(input, 'organization');
}

export function normalizeCustomerNameV1(input: string): TapTimeNameResult {
  return normalizeTapTimeNameV1(input, 'customer');
}

export function normalizeNfcTagNameV1(input: string): TapTimeNameResult {
  return normalizeTapTimeNameV1(input, 'tag');
}

function inRanges(codePoint: number, ranges: readonly UnicodeRange[]): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const range = ranges[middle]!;
    if (codePoint < range.begin) {
      high = middle - 1;
    } else if (codePoint >= range.end) {
      low = middle + 1;
    } else {
      return true;
    }
  }
  return false;
}
