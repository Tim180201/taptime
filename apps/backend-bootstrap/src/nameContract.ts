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

const prohibitedRanges: readonly UnicodeRange[] = Object.freeze([
  ...controlRanges,
  ...formatRanges,
  ...surrogateRanges,
  ...privateUseRanges,
  ...unassignedRanges,
  ...lineSeparatorRanges,
  ...paragraphSeparatorRanges,
].sort((left, right) => left.begin - right.begin));

export type OrganizationNameResult =
  | { readonly status: 'valid'; readonly canonicalName: string }
  | { readonly status: 'invalid' };

export function normalizeOrganizationNameV1(input: string): OrganizationNameResult {
  if (Buffer.byteLength(input, 'utf8') > 4_096) {
    return { status: 'invalid' };
  }
  // Node 24 knows later Unicode versions. Reject every code point that was Cn/Cs in 15.1
  // before its newer normalizer can assign combining behavior that PostgreSQL 17 does not know.
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
  if (
    canonicalCodePoints.length < 1
    || canonicalCodePoints.length > 120
    || Buffer.byteLength(canonicalName, 'utf8') > 480
    || canonicalCodePoints.some((value) => inRanges(value.codePointAt(0)!, prohibitedRanges))
  ) {
    return { status: 'invalid' };
  }
  return Object.freeze({ status: 'valid', canonicalName });
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
