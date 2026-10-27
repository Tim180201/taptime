import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
/** @param {string} path */
const source = path => readFileSync(resolve(root, path), 'utf8');
/** @param {string} text @param {RegExp} pattern @param {string} label */
const capture = (text, pattern, label) => {
  const match = text.match(pattern);
  if (!match) throw new Error(`Source changed: review ${label} before using this model.`);
  return match.slice(1).map(value => Number(value.replaceAll('_', '')));
};

export function readInputs() {
  const dataset = source('tests/pilot-size/dataset.ts');
  const load = source('tests/pilot-size/load.ts');
  const config = source('infrastructure/backup/backup.conf.example');
  /** @param {string} key */
  const scalar = key => capture(config, new RegExp(`^${key}='([0-9]+)'$`, 'm'), key)[0];
  const [people] = capture(dataset, /former:i >= (\d+)/, 'active population');
  const [expectedUnits, peakUnits] = capture(dataset, /unit<\(profile==='expected'\?(\d+):(\d+)\)/, 'units');
  const [spacingMinutes] = capture(dataset, /unit\*(\d+)\*60_000/, 'unit spacing');
  const [durationMinutes] = capture(dataset, /stop = start\+(\d+)\*60_000/, 'unit duration');
  const [breakStart] = capture(dataset, /start\+(\d+)\*60_000\),label\+'-pause'/, 'break start');
  const [breakEnd] = capture(dataset, /start\+(\d+)\*60_000\),label\+'-resume'/, 'break end');
  const [burstMilliseconds, burstPeople] = capture(load, /person.index\*\((\d[\d_]*)\/(\d+)\)/, 'burst');
  const [backfillDayFactor, backfillModulo] = capture(dataset, /person.index\+dayIndex\*(\d+)\+unit\)%(\d+)===0/, 'backfills');
  const weekdays = dataset.match(/profile==='expected' \? \[([\d,]+)\]\.includes\(weekday\) : weekday>(\d+) && weekday<(\d+)/);
  if (!weekdays) throw new Error('Source changed: workdays.');
  const [startHour] = capture(dataset, /Date.parse\(day\+'T(\d+):00:00Z'\)/, 'start time');
  const [baseMinute] = capture(source('infrastructure/backup/taptime-backup.timer'),
    /^OnCalendar=\*-\*-\* \*:(\d+):00$/m, 'hourly base timer');
  if (!source('infrastructure/backup/taptime-wal-archiver').includes('WAL_ARCHIVE_INTERVAL_SECONDS / 2')) {
    throw new Error('Source changed: archiver cadence.');
  }
  /** @param {string} unit */
  const timeout = unit => capture(source(`infrastructure/backup/${unit}.service`),
    /^TimeoutStartSec=(\d+)min$/m, `${unit} timeout`)[0] * 60;
  return { people, expectedUnits, peakUnits, spacingMinutes, durationMinutes, breakStart, breakEnd,
    startHour, baseMinute, backfillDayFactor, backfillModulo,
    burstSpacingSeconds: burstMilliseconds / burstPeople / 1000,
    expectedDays: weekdays[1].split(',').map(Number),
    peakDays: Array.from({ length: 7 }, (_, i) => i).filter(i => i > Number(weekdays[2]) && i < Number(weekdays[3])),
    minimumCyclePauseSeconds: scalar('WAL_ARCHIVE_INTERVAL_SECONDS') / 2,
    retention: Object.fromEntries(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'].map(key =>
      [key.toLowerCase(), scalar(`BASE_BACKUP_KEEP_${key}`)])),
    weeklyTimeoutSeconds: timeout('taptime-restore-verify'), backupTimeoutSeconds: timeout('taptime-backup') };
}

// Arrival scenario, NOT replayed production traffic. We extend the measured
// pilot start-burst spacing to every daily event wave. Runtime and lock delays
// are zero in this scenario; natural segment fills are not estimated.
/** @param {ReturnType<typeof readInputs>} inputs @param {number} units
 * @param {number} dayIndex @param {number} [spacing] */
export function demandDay(inputs, units, dayIndex, spacing = inputs.burstSpacingSeconds) {
  const slots = new Set();
  let events = 0, backfills = 0;
  for (let person = 0; person < inputs.people; person++) {
    for (let unit = 0; unit < units; unit++) {
      if (unit > 0 && (person + dayIndex * inputs.backfillDayFactor + unit) % inputs.backfillModulo === 0) {
        backfills++;
        continue;
      }
      const start = inputs.startHour * 3600 + unit * inputs.spacingMinutes * 60 + person * spacing;
      const offsets = unit === 0 ? [0, inputs.breakStart, inputs.breakEnd, inputs.durationMinutes]
        : [0, inputs.durationMinutes];
      for (const offset of offsets) {
        events++;
        slots.add(Math.floor((start + offset * 60) / inputs.minimumCyclePauseSeconds));
      }
    }
  }
  return { events, backfills, demandSegments: slots.size };
}

/** @param {ReturnType<typeof readInputs>} inputs @param {number} months
 * @param {'expected'|'peak'} profile @param {number} [baseSegmentsPerHour] */
export function calendar(inputs, months, profile, baseSegmentsPerHour = 2) {
  // A fixed synthetic calendar makes weekday/month boundaries reproducible.
  const first = Date.UTC(2026, 0, 1), end = Date.UTC(2026, months, 1);
  const units = inputs[`${profile}Units`], weekdays = inputs[`${profile}Days`];
  const days = [];
  let workday = 0;
  for (let time = first; time < end; time += 86400_000) {
    const working = weekdays.includes(new Date(time).getUTCDay());
    const demand = working ? demandDay(inputs, units, workday++) : { events: 0, backfills: 0, demandSegments: 0 };
    days.push({ date: new Date(time).toISOString().slice(0, 10), working, ...demand,
      baseSegments: 24 * baseSegmentsPerHour, segments: demand.demandSegments + 24 * baseSegmentsPerHour });
  }
  return { first, end, days, workdays: workday, generatedWal: days.reduce((sum, day) => sum + day.segments, 0) };
}
