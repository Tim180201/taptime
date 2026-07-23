const localTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

export interface TimeZoneContext {
  readonly timeZone: string;
  readonly usedUtcFallback: boolean;
}

export function resolveBrowserTimeZone(): TimeZoneContext {
  try {
    const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof candidate !== 'string' || candidate.length === 0) throw new Error('missing zone');
    new Intl.DateTimeFormat('de-DE', { timeZone: candidate }).format(0);
    return Object.freeze({ timeZone: candidate, usedUtcFallback: false });
  } catch {
    return Object.freeze({ timeZone: 'UTC', usedUtcFallback: true });
  }
}

export function formatZonedDateTime(value: string, context: TimeZoneContext): string {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return 'Ungültiger Zeitpunkt';
  try {
    const formatted = new Intl.DateTimeFormat('de-DE', {
      timeZone: context.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'shortOffset',
    }).format(epoch);
    return `${formatted} [${context.timeZone}]`;
  } catch {
    return `${new Date(epoch).toISOString()} [UTC]`;
  }
}

export function toZonedLocalInput(value: string, timeZone: string): string {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return '';
  const parts = partsAt(epoch, timeZone);
  if (parts === null) return '';
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(parts.millisecond, 3)}`;
}

export function parseZonedLocalTimestamp(value: string, timeZone: string): string | null {
  const parts = parseLocalParts(value);
  if (parts === null) return null;
  const wallClockUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  const roundTrip = new Date(wallClockUtc);
  if (
    roundTrip.getUTCFullYear() !== parts.year
    || roundTrip.getUTCMonth() + 1 !== parts.month
    || roundTrip.getUTCDate() !== parts.day
    || roundTrip.getUTCHours() !== parts.hour
    || roundTrip.getUTCMinutes() !== parts.minute
    || roundTrip.getUTCSeconds() !== parts.second
    || roundTrip.getUTCMilliseconds() !== parts.millisecond
  ) return null;

  const offsets = new Set<number>();
  try {
    for (let delta = -48; delta <= 48; delta += 4) {
      const sample = wallClockUtc + delta * 60 * 60 * 1_000;
      const local = partsAt(sample, timeZone);
      if (local !== null) offsets.add(localPartsAsUtc(local) - sample);
    }
  } catch {
    return null;
  }
  const candidates = [...offsets]
    .map((offset) => wallClockUtc - offset)
    .filter((epoch, index, values) => values.indexOf(epoch) === index)
    .filter((epoch) => sameParts(partsAt(epoch, timeZone), parts));
  return candidates.length === 1 ? new Date(candidates[0]!).toISOString() : null;
}

function parseLocalParts(value: string): LocalParts | null {
  const match = localTimestampPattern.exec(value);
  if (match === null) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? '0'),
    millisecond: Number((match[7] ?? '').padEnd(3, '0')),
  };
}

function partsAt(epoch: number, timeZone: string): LocalParts | null {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const values = Object.fromEntries(
    formatter.formatToParts(epoch)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  if (['year', 'month', 'day', 'hour', 'minute', 'second'].some(
    (key) => !Number.isFinite(values[key]),
  )) return null;
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
    millisecond: new Date(epoch).getUTCMilliseconds(),
  };
}

function localPartsAsUtc(parts: LocalParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

function sameParts(left: LocalParts | null, right: LocalParts): boolean {
  return left !== null
    && left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second
    && left.millisecond === right.millisecond;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}
