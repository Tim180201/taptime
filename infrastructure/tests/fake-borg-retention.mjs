// Synthetic archive directories; only list/prune are modeled here. Keep semantics:
// https://github.com/borgbackup/borg/blob/1.2.8/src/borg/helpers/misc.py (prune_split)
// https://github.com/borgbackup/borg/blob/1.4.1/src/borg/archiver.py (do_prune)
// Earlier rules consume archives, but their periods still count as visited.
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const [directory, operation, ...args] = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const glob = option('--glob-archives', '*');
const match = new RegExp(`^${glob.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
const archives = readdirSync(directory).filter(name => match.test(name)).map(name => {
  const file = join(directory, name, 'timestamp');
  const stamp = name.match(/-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  const time = new Date(existsSync(file) ? readFileSync(file, 'utf8').trim()
    : stamp ? `${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:${stamp[5]}:${stamp[6]}Z` : 0);
  if (!Number.isFinite(time.getTime())) throw Error(`Invalid fixture time: ${name}`);
  return { name, time, checkpoint: /\.checkpoint(?:\.\d+)?$/.test(name) };
}).sort((a, b) => b.time - a.time || b.name.localeCompare(a.name));

if (operation === 'list') {
  for (const archive of [...archives].reverse()) {
    const format = option('--format', '{archive}{NL}');
    if (format === '{archive}{NL}') process.stdout.write(`${archive.name}\n`);
    else if (format === '{archive}|{time:%Y-%m-%d}{NL}') {
      const d = archive.time;
      process.stdout.write(`${archive.name}|${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}\n`);
    } else throw Error(`Unsupported fixture format: ${format}`);
  }
} else if (operation === 'prune') {
  const complete = archives.filter(a => !a.checkpoint);
  const kept = new Map();
  const week = date => {
    // ISO week uses local calendar fields, including DST, just like %G-%V.
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    return `${year}-${Math.ceil((((d - Date.UTC(year, 0, 1)) / 86400000) + 1) / 7)}`;
  };
  const period = (date, rule) => {
    const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return { hourly: `${day}-${date.getHours()}`, daily: day, weekly: week(date),
      monthly: `${date.getFullYear()}-${date.getMonth()}` }[rule];
  };
  for (const rule of ['hourly', 'daily', 'weekly', 'monthly']) {
    const limit = Number(option(`--keep-${rule}`, '0'));
    if (limit === 0) continue;
    let last = null, count = 0, archive;
    for (archive of complete) {
      const key = period(archive.time, rule);
      if (key === last) continue;
      last = key;
      if (!kept.has(archive.name)) {
        kept.set(archive.name, `${rule} #${++count}`);
        if (count === limit) break;
      }
    }
    // Borg >= 1.2 preserves the oldest archive when a rule cannot fill its quota.
    if (archive && count < limit && !kept.has(archive.name)) {
      kept.set(archive.name, `${rule}[oldest] #${++count}`);
    }
  }
  for (const archive of archives) {
    const checkpointKept = archive.checkpoint && archive === archives[0];
    const keep = kept.has(archive.name) || checkpointKept;
    const label = checkpointKept ? 'Keeping checkpoint archive:' : keep
      ? `Keeping archive (rule: ${kept.get(archive.name)}):`
      : args.includes('--dry-run') ? 'Would prune:' : 'Pruning archive:';
    const d = archive.time;
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}, ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    process.stderr.write(`${label.padEnd(40)} ${archive.name} ${stamp} [fixture]\n`);
    if (!keep && !args.includes('--dry-run')) rmSync(join(directory, archive.name), { recursive: true });
  }
} else throw Error(`Unsupported fixture operation: ${operation}`);
