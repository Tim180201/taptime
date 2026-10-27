import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { setImmediate as yieldToSignals } from 'node:timers/promises';
import { readInputs, calendar, root } from './model.mjs';

const inputs = readInputs();
const outputRoot = join(root, '.t136-review');
mkdirSync(outputRoot, { recursive: true });
const scratch = mkdtempSync(join(outputRoot, 'model-'));
let stopRequested = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopRequested = true; });
process.stderr.write(`T-136 local model scratch: ${scratch}\n`);
/** @type {object[]} */
const stages = [];
const report = { kind: 'model-not-Borg-measurement', inputs, assumptions: {
  calendar: 'UTC; starts 2026-01-01; stage is immediately after the last hourly base of the final month',
  baseSegmentsPerHour: 2,
  demand: 'Every event wave uses the start-burst spacing; cycle runtime and lock waits are zero.',
  combination: 'Base and demand counts are added, ignoring overlap; natural WAL fills and extra writes excluded.',
  retention: 'Selection model uses the existing fake-borg-retention.mjs in dry-run mode, not real Borg. All historical hourly bases supplied; not a chronological production prune replay.',
}, stages, scratchRemoved: false };
try {
  let previous = Date.UTC(2026, 0, 1);
  for (const months of [1, 3, 6, 12]) {
    await yieldToSignals();
    if (stopRequested) throw new Error('Interrupted; removing owned model directory.');
    const end = Date.UTC(2026, months, 1);
    for (let hour = previous; hour < end; hour += 3600_000) {
      const time = new Date(hour + inputs.baseMinute * 60_000).toISOString().replaceAll('-', '').replaceAll(':', '').replace('.000', '');
      mkdirSync(join(scratch, `base-0123456789abcdef-${time}`));
    }
    previous = end;
    const selection = spawnSync(process.execPath, [join(root, 'infrastructure/tests/fake-borg-retention.mjs'),
      scratch, 'prune', '--dry-run', '--glob-archives', 'base-*',
      ...Object.entries(inputs.retention).flatMap(([rule, value]) => [`--keep-${rule}`, String(value)])],
    { env: { ...process.env, TZ: 'UTC' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024, timeout: 60_000 });
    if (selection.error || selection.status !== 0) throw new Error(selection.error?.message || selection.stderr);
    const kept = selection.stderr.split('\n').flatMap(line => {
      if (!line) return [];
      const match = line.match(/^Keeping archive \(rule:[^)]+\):\s+(base-\S+) /);
      if (match) return [match[1]];
      if (!line.startsWith('Would prune:')) throw new Error(`Unrecognized modeled selection: ${line}`);
      return [];
    }).sort();
    if (!kept.length) throw new Error('No modeled retained base.');
    const stamp = kept[0].match(/-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!stamp) throw new Error('Unrecognized base name.');
    const floor = `${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:${stamp[5]}:${stamp[6]}Z`;
    const profiles = /** @type {const} */ (['expected', 'peak']);
    for (const profile of profiles) {
      const data = calendar(inputs, months, profile);
      report.stages.push({ months, profile, days: data.days.length, workdays: data.workdays,
        generatedWal: data.generatedWal, retainedBasesModeled: kept.length, oldestBaseModeled: floor,
        retainedWalDayRounded: data.days.filter(day => day.date >= floor.slice(0, 10))
          .reduce((sum, day) => sum + day.segments, 0),
        retainedWalCaveat: 'Entire oldest-base day included; historical snapshot selection, no actual prune replay.' });
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
  report.scratchRemoved = true;
}
console.log(JSON.stringify(report, null, 2));
