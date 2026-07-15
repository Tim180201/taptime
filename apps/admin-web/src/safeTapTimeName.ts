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

/** Browser-side independent validation of the accepted taptime-name-v1 120/480 profile. */
export function isCanonicalSafeTapTimeName(value: string): boolean {
  if (utf8ByteLength(value) > 4_096) return false;
  const inputCodePoints = Array.from(value);
  if (inputCodePoints.some((codePoint) => {
    const scalar = codePoint.codePointAt(0)!;
    return inRanges(scalar, unassignedRanges) || inRanges(scalar, surrogateRanges);
  })) return false;

  const normalized = value.normalize('NFC');
  const codePoints = Array.from(normalized);
  let start = 0;
  let end = codePoints.length;
  while (start < end && inRanges(codePoints[start]!.codePointAt(0)!, whiteSpaceRanges)) start += 1;
  while (end > start && inRanges(codePoints[end - 1]!.codePointAt(0)!, whiteSpaceRanges)) end -= 1;
  const canonical = codePoints.slice(start, end).join('');
  const canonicalCodePoints = Array.from(canonical);
  return canonical === value
    && canonicalCodePoints.length >= 1
    && canonicalCodePoints.length <= 120
    && utf8ByteLength(canonical) <= 480
    && !canonicalCodePoints.some((codePoint) => (
      inRanges(codePoint.codePointAt(0)!, prohibitedRanges)
    ));
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index)!;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else {
      bytes += 4;
      index += 1;
    }
  }
  return bytes;
}

function inRanges(codePoint: number, ranges: readonly UnicodeRange[]): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const range = ranges[middle]!;
    if (codePoint < range.begin) high = middle - 1;
    else if (codePoint >= range.end) low = middle + 1;
    else return true;
  }
  return false;
}
