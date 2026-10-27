#!/usr/bin/env python3
"""Offline measurement driver. Run inside the local Colima VM, not a container.

The host Docker CLI controls two owned containers. No Docker socket is mounted.
Installation and image removal are separate, explicitly authorised host steps.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import shlex
import subprocess
import sys
import time
import uuid

GIB = 1024 ** 3
LIMIT = 18 * 1000 ** 3
RESERVE = 30 * 1000 ** 3
ROOT = Path('/var/lib/docker/volumes/t136-scale-data/_data')
SOURCE = Path(__file__).resolve().parents[2]
PG = 't136-scale-pg'
BORG = 't136-scale-borg'
IMAGE = 't136-borg:local'
PG_IMAGE = 'postgres:17.10-bookworm'
ENV = {**os.environ, 'BORG_PASSPHRASE': 'synthetic-t136-only',
       'BORG_CACHE_DIR': str(ROOT / 'cache'), 'BORG_CONFIG_DIR': str(ROOT / 'config'),
       'BORG_SECURITY_DIR': str(ROOT / 'security'), 'BORG_RELOCATED_REPO_ACCESS_IS_OK': 'yes',
       'TZ': 'UTC'}
JOBS = []
PEAK_ALLOCATED = 0
LAST_SPACE_EVENT = 0


def run(args, *, input=None, timeout=600, cwd=None, env=None):
    result = subprocess.run([str(a) for a in args], input=input, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=timeout,
                            cwd=cwd, env=env or ENV)
    if result.returncode:
        sys.stderr.buffer.write(result.stderr)
        result.check_returncode()
    return result


def docker(*args, **kwargs):
    return run(['docker', '--host', 'unix:///var/run/docker.sock', *args], **kwargs)


def borg(*args, cwd=None, timeout=600, extra_env=None):
    command = ['exec', '-w', str(cwd or ROOT)]
    for key, value in (extra_env or {}).items():
        command += ['-e', f'{key}={value}']
    command += [BORG, 'borg', *map(str, args)]
    return docker(*command, timeout=timeout)


def sql(text):
    return docker('exec', '--user', 'postgres', PG, 'psql', '-XqAt', '-v', 'ON_ERROR_STOP=1',
                  '-d', 'postgres', '-c', text).stdout.decode().strip()


def event(kind, **fields):
    value = {'event': kind, 'utc': datetime.now(timezone.utc).isoformat(), **fields}
    print(json.dumps(value), flush=True)
    with (ROOT / 'events.jsonl').open('a') as stream:
        stream.write(json.dumps(value) + '\n')


def guard():
    global PEAK_ALLOCATED, LAST_SPACE_EVENT
    # Only the dedicated data filesystem and the host-backed source filesystem.
    for path in [ROOT, SOURCE]:
        if shutil.disk_usage(path).free < RESERVE:
            raise RuntimeError(f'Less than 30 GB free on {path}')
    sampled = subprocess.run(['du', '-s', '-B1', str(ROOT)], capture_output=True)
    # Borg atomically replaces cache files while du traverses them. Only ENOENT
    # races are tolerated; permission/I/O/other errors still abort the run.
    if sampled.returncode and (sampled.returncode != 1 or not sampled.stderr or
            any(b'No such file or directory' not in line for line in sampled.stderr.splitlines())):
        raise RuntimeError(sampled.stderr.decode())
    used = int(sampled.stdout.split()[0])
    PEAK_ALLOCATED = max(PEAK_ALLOCATED, used)
    if PEAK_ALLOCATED - LAST_SPACE_EVENT >= 100 * 1000 ** 2:
        event('space-peak', allocatedBytes=PEAK_ALLOCATED)
        LAST_SPACE_EVENT = PEAK_ALLOCATED
    # 1 GB headroom for bounded single-step writes, runtime image and metadata.
    if used > LIMIT - 1000 ** 3:
        raise RuntimeError('Measurement data approaching the 18 GB working budget')
    return used


def initialize():
    ROOT.mkdir(exist_ok=True)
    if (ROOT / 'state.json').exists():
        raise RuntimeError('Refuse to overwrite existing measurement state')
    guard()
    state = {'ownerToken': str(uuid.uuid4()), 'ownedContainers': {}, 'volume': 't136-scale-data',
             'files': [], 'bases': []}
    save(state)
    for path in ['spool', 'bases', 'logs', 'state', 'workspace', 'cache', 'config', 'security']:
        (ROOT / path).mkdir(mode=0o700)
    os.chmod(ROOT, 0o755)
    os.chown(ROOT / 'spool', 999, 999)
    for image in [IMAGE, PG_IMAGE]:
        docker('image', 'inspect', image)
    docker('run', '-d', '--pull=never', '--network=none', '--name', BORG,
           '--label', f't136-owner={state["ownerToken"]}',
           '--mount', f'type=volume,source=t136-scale-data,target={ROOT}',
           '--mount', f'type=bind,source={SOURCE},target=/src,readonly',
           *[arg for k, v in ENV.items() if k.startswith('BORG_') for arg in ['-e', f'{k}={v}']],
           IMAGE, 'sleep', 'infinity')
    state['ownedContainers'][BORG] = json.loads(docker('inspect', BORG).stdout)[0]['Id']
    save(state)
    docker('run', '-d', '--pull=never', '--network=none', '--name', PG,
           '--label', f't136-owner={state["ownerToken"]}',
           '--mount', 'type=volume,source=t136-scale-data,target=/work',
           '--mount', f'type=bind,source={SOURCE}/apps/backend-schema/migrations,target=/migrations,readonly',
           '-e', 'PGDATA=/work/pgdata', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', PG_IMAGE,
           'postgres', '-c', 'listen_addresses=', '-c', 'archive_mode=on',
           '-c', 'archive_command=test -f /work/spool/%f || cp --sparse=always %p /work/spool/%f',
           '-c', 'max_wal_size=128MB', '-c', 'min_wal_size=32MB', '-c', 'checkpoint_timeout=30min')
    state['ownedContainers'][PG] = json.loads(docker('inspect', PG).stdout)[0]['Id']
    save(state)
    for _ in range(120):
        try:
            if docker('exec', PG, 'cat', '/proc/1/comm').stdout.strip() == b'postgres' and sql('SELECT 1') == '1':
                break
        except subprocess.CalledProcessError:
            pass
        time.sleep(.5)
    else:
        raise RuntimeError('PostgreSQL startup deadline exceeded')
    sql('CREATE TABLE public.taptime_server_schema_migrations (version text PRIMARY KEY, name text NOT NULL, checksum char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT transaction_timestamp())')
    with (ROOT / 'logs/migrations.log').open('wb') as log:
        for path in sorted((SOURCE / 'apps/backend-schema/migrations').glob('*.sql')):
            result = docker('exec', '--user', 'postgres', PG, 'psql', '-Xq', '-v', 'ON_ERROR_STOP=1',
                            '-d', 'postgres', '-f', '/migrations/' + path.name)
            log.write(result.stdout + result.stderr)
            version = path.name.split('_')[0]
            checksum = hashlib.sha256(path.read_bytes()).hexdigest()
            sql(f"INSERT INTO public.taptime_server_schema_migrations(version,name,checksum) VALUES ('{version}','{path.name}','{checksum}')")
    sql('CREATE TABLE public.synthetic_wal_payload(id bigint PRIMARY KEY, payload text NOT NULL)')
    cluster = sql("SELECT system_identifier::text || '|' || lpad(to_hex(system_identifier),16,'0') FROM pg_control_system()")
    system, identifier = cluster.split('|')
    state.update({'system': system, 'cluster': identifier})
    save(state)
    borg('init', '--encryption=repokey-blake2', '--storage-quota=5G', ROOT / 'repo')
    event('initialized', borg=docker('exec', BORG, 'borg', '--version').stdout.decode().strip(),
          pg=sql('SHOW server_version'), bytes=guard())


def save(state):
    temporary = ROOT / 'state.json.tmp'
    temporary.write_text(json.dumps(state, indent=2))
    temporary.replace(ROOT / 'state.json')


def take_base(state, label):
    target = ROOT / 'bases' / label
    target.mkdir()
    manifest = target / 'manifest'
    manifest.mkdir()
    with (target / 'base.tar').open('wb') as out:
        subprocess.run(['docker', '--host', 'unix:///var/run/docker.sock', 'exec', '--user', 'postgres', PG,
                        'pg_basebackup', '--dbname=dbname=postgres', '--format=tar', '--pgdata=-',
                        '--wal-method=fetch', '--checkpoint=fast', '--manifest-checksums=SHA256'],
                       stdout=out, check=True, timeout=300)
    text = run(['tar', '-xOf', target / 'base.tar', 'backup_label']).stdout.decode()
    lsn, wal = re.search(r'START WAL LOCATION: (\S+) \(file ([0-9A-F]{24})\)', text).groups()
    for name, value in {'base-start-wal-lsn': lsn, 'base-start-wal-file': wal,
                        'cluster-system-identifier': state['system'], 'cluster-archive-identifier': state['cluster'],
                        'base-started-at-utc': datetime.now(timezone.utc).isoformat(),
                        'base-created-at-utc': datetime.now(timezone.utc).isoformat()}.items():
        (manifest / name).write_text(value + '\n')
    (manifest / 'source-migration-checksums.tsv').write_text(''.join(
        hashlib.sha256(p.read_bytes()).hexdigest() + '  ./' + p.name + '\n'
        for p in sorted((SOURCE / 'apps/backend-schema/migrations').glob('*.sql'))))
    state['bases'].append({'label': label, 'wal': wal, 'lsn': lsn})
    save(state)
    event('base-fixture', label=label, wal=wal)


def seed(target):
    state = json.loads((ROOT / 'state.json').read_text())
    # Real bases at the old/new monthly floors; the final base leaves ~9 WALs.
    milestones = [0, 4088, 8176, 12264, 16352, target - 10]
    next_id = int(sql('SELECT coalesce(max(id),0) FROM public.synthetic_wal_payload'))
    start = time.monotonic()
    while len(state['files']) < target:
        count = len(state['files'])
        if count in milestones and not any(b['label'] == f'at-{count}' for b in state['bases']):
            take_base(state, f'at-{count}')
        limit = min([m for m in milestones if m > count] + [target, count + 100])
        amount = limit - count
        # One genuine INSERT (16 KiB independently generated payload) per switch.
        available = [p for p in (ROOT / 'spool').iterdir()
                     if re.fullmatch('[0-9A-F]{24}', p.name) and p.name not in state['files']]
        statements = []
        for _ in range(max(0, amount - len(available))):
            next_id += 1
            statements.append(f"INSERT INTO public.synthetic_wal_payload SELECT {next_id}, string_agg(md5(random()::text), '') FROM generate_series(1,512); SELECT pg_switch_wal();")
        if statements:
            sql('\n'.join(statements))
        deadline = time.monotonic() + 60
        while True:
            pending = sorted(p for p in (ROOT / 'spool').iterdir()
                             if re.fullmatch('[0-9A-F]{24}', p.name) and p.name not in state['files'])
            if len(pending) >= amount or time.monotonic() > deadline:
                break
            time.sleep(.1)
        if not pending:
            raise RuntimeError('WAL archiving stalled')
        # Take only up to the milestone; base-generated segments can add extras.
        pending = pending[:amount]
        requests = ''.join(json.dumps({'file': p.name, 'archive': f"wal-{state['cluster']}-{p.name}"}) + '\n'
                           for p in pending)
        result = docker('exec', '-i', BORG, 'python3', '/src/tests/backup-scale/seed-borg.py', str(ROOT),
                        input=requests.encode(), timeout=600)
        if len(result.stdout.splitlines()) != len(pending):
            raise RuntimeError('Missing Borg archive acknowledgements')
        state['files'].extend(p.name for p in pending)
        save(state)
        if len(state['files']) % 500 == 0 or len(state['files']) in milestones:
            borg('compact', ROOT / 'repo', timeout=300)
            event('seed', archives=len(state['files']), seconds=time.monotonic()-start, bytes=guard())
    borg('compact', ROOT / 'repo')
    listed = borg('list', '--glob-archives', 'wal-*', '--format', '{archive}{NL}', ROOT / 'repo').stdout.splitlines()
    if len(listed) != target:
        raise RuntimeError('Actual Borg inventory differs from target')
    event('seed-complete', archives=len(listed), seconds=time.monotonic()-start, bytes=guard())


def fixture(replace=False):
    from datetime import timedelta
    import calendar
    state = json.loads((ROOT / 'state.json').read_text())
    if len(state['files']) < 20000:
        raise RuntimeError('Monthly fixture requires at least 20000 real WAL archives')
    if replace:
        names = [n for n in inventory(ROOT / 'repo')
                 if n.startswith(f"base-{state['cluster']}-") or n.startswith(f"verified-base-{state['cluster']}-")]
        if names:
            borg('delete', ROOT / 'repo', *names)
    # Temporary old manifest segments during thousands of CLI deletes count too.
    # The outer disk guard remains the stricter total budget across both copies.
    borg('config', ROOT / 'repo', 'storage_quota', '10000000000')
    # Synthetic calendar positions, real physical backup contents and WAL floors.
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    anchors = []
    # Hourly/daily/weekly retained archives do not consume all six monthly slots.
    # Nine month-end candidates ensure an actual oldest-month retirement here.
    for offset in range(9, 0, -1):
        serial = today.year * 12 + today.month - 1 - offset
        year, month0 = divmod(serial, 12)
        anchors.append(datetime(year, month0 + 1, calendar.monthrange(year, month0 + 1)[1], 23, 5, 1, tzinfo=timezone.utc))
    mapping = {stamp: state['bases'][min(i, len(state['bases'])-1)] for i, stamp in enumerate(anchors)}
    newest = state['bases'][-1]
    for days in range(1, 71):
        if days <= 14 or days % 7 == 0:
            mapping[today - timedelta(days=days) + timedelta(hours=23, minutes=5, seconds=1)] = newest
    for hours in range(1, 25):
        mapping[today - timedelta(hours=hours) + timedelta(minutes=5, seconds=1)] = newest
    created = []
    for stamp, base in sorted(mapping.items()):
        name = f"base-{state['cluster']}-{stamp.strftime('%Y%m%dT%H%M%SZ')}"
        borg('create', '--compression', 'zstd,6', '--timestamp', stamp.strftime('%Y-%m-%dT%H:%M:%S'),
             f'{ROOT}/repo::{name}', 'base.tar', 'manifest', cwd=ROOT / 'bases' / base['label'])
        sql(f"SET ROLE taptime_wal_archiver; SELECT taptime_server.record_offsite_base_backup_v1('{name}','{base['lsn']}'::pg_lsn,'{base['wal']}')")
        created.append({'name': name, **base})
    state['baseArchives'] = created
    state['weeklyBase'] = created[-1]
    save(state)
    config = configuration('repo', 'fixture')
    env = operation_env(config, 'fixture-marker')
    base = state['weeklyBase']
    # The real record function validates/checks the stored marker.
    shell = f'''source "$T136_SOURCE/infrastructure/backup/taptime-restore-verify"
source "$TAPTIME_BACKUP_CONFIG"
borg() {{ python3 "$T136_SOURCE/tests/backup-scale/borg-call.py" "$@"; }}
RESTORE_SYSTEM_IDENTIFIER={shlex.quote(state['system'])}
RESTORE_ARCHIVE_IDENTIFIER={shlex.quote(state['cluster'])}
record_verified_base_marker "$T136_ROOT/bases/{base['label']}" {shlex.quote(base['name'])} {shlex.quote(base['lsn'])} {shlex.quote(base['wal'])}
'''
    run(['bash', '-ec', shell], env=env)
    borg('compact', ROOT / 'repo')
    # Full Borg archive metadata/chunk consistency check on the genuine fixture.
    started = time.monotonic()
    result = borg('check', '--verify-data', ROOT / 'repo', timeout=1800)
    (ROOT / 'logs/fixture-check.log').write_bytes(result.stdout + result.stderr)
    event('fixture-complete', bases=len(created), wal=len(state['files']), checkSeconds=time.monotonic()-started,
          uniquePayloads=sql('SELECT count(*) || \'|\' || count(DISTINCT md5(payload)) FROM public.synthetic_wal_payload'),
          bytes=guard())


def configuration(repository, name):
    state = json.loads((ROOT / 'state.json').read_text())
    directory = ROOT / 'runs' / name
    directory.mkdir(parents=True, exist_ok=True)
    (ROOT / 'passphrase').write_text('synthetic-t136-only\n')
    values = {
        'BORG_REPOSITORY': str(ROOT / repository), 'BORG_PASSPHRASE_FILE': str(ROOT / 'passphrase'),
        'BORG_RSH': 'ssh -o BatchMode=yes', 'DATABASE_CONTAINER': PG, 'DATABASE_NAME': 'postgres',
        'RESTORE_IMAGE': PG_IMAGE, 'MIGRATIONS_DIRECTORY': str(SOURCE / 'apps/backend-schema/migrations'),
        'STATUS_FILE': str(directory / 'backup-status.json'), 'RESTORE_STATUS_FILE': str(directory / 'restore-status.json'),
        'BASE_BACKUP_KEEP_HOURLY': '24', 'BASE_BACKUP_KEEP_DAILY': '14', 'BASE_BACKUP_KEEP_WEEKLY': '8',
        'BASE_BACKUP_KEEP_MONTHLY': '6', 'RESTORE_RECOVERY_TIMEOUT_SECONDS': '300', 'RESTORE_RECOVERY_POLL_SECONDS': '1',
        'TAPTIME_BACKUP_STAGING_ROOT': str(ROOT / 'workspace'), 'TAPTIME_BORG_LOCK_FILE': str(ROOT / 'shared.lock'),
        'TAPTIME_BORG_DIRECTORY': str(directory / 'borg'), 'TAPTIME_BORG_STATE_DIRECTORY': str(directory / 'borg-state'),
        'TAPTIME_BACKUP_STATE_DIRECTORY': str(directory / 'status'),
        'TAPTIME_BACKUP_DAILY_MONITOR_COMMAND': str(SOURCE / 'infrastructure/monitoring/taptime-daily-monitor'),
        'BORG_CACHE_DIR': str(directory / 'borg/cache'), 'BORG_CONFIG_DIR': str(directory / 'borg-state/config'),
        'BORG_SECURITY_DIR': str(directory / 'borg-state/config/security'),
        'WAL_SPOOL_DIRECTORY': str(ROOT / 'confirmation-spool'), 'WAL_ARCHIVE_STATUS_FILE': str(directory / 'wal-status.json'),
        'WAL_ARCHIVE_CACHE_DIRECTORY': str(directory / 'archiver-cache'), 'WAL_REPLICATION_SLOT': 't136_receiver',
        'WAL_ARCHIVE_INTERVAL_SECONDS': '60', 'WAL_ARCHIVE_RECONCILE_INTERVAL_SECONDS': '900',
    }
    # Retention values are conditions from the current source, not copied counts.
    defaults = (SOURCE / 'infrastructure/backup/backup.conf.example').read_text()
    for key in ['BASE_BACKUP_KEEP_HOURLY', 'BASE_BACKUP_KEEP_DAILY', 'BASE_BACKUP_KEEP_WEEKLY',
                'BASE_BACKUP_KEEP_MONTHLY', 'RESTORE_RECOVERY_TIMEOUT_SECONDS', 'RESTORE_RECOVERY_POLL_SECONDS']:
        match = re.search(r'^' + key + r'=[\'"]?([0-9]+)[\'"]?$', defaults, re.M)
        if not match:
            raise RuntimeError(f'Unrecognized source setting {key}')
        values[key] = match[1]
    path = directory / 'config.sh'
    path.write_text(''.join(f'export {key}={shlex.quote(value)}\n' for key, value in values.items()))
    os.chmod(path, 0o600)
    return path


def operation_env(config, label, mode='main', batch=False):
    state = json.loads((ROOT / 'state.json').read_text())
    return {**ENV, 'T136_ROOT': str(ROOT), 'T136_SOURCE': str(SOURCE), 'T136_CLUSTER': state['cluster'],
            'T136_BORG_CONTAINER': BORG, 'TAPTIME_BACKUP_CONFIG': str(config), 'T136_MODE': mode,
            'T136_TRACE': str(ROOT / 'logs' / (label + '.borg.jsonl')),
            'T136_LOCK_TRACE': str(ROOT / 'logs' / (label + '.lock.log')),
            'T136_BATCH_DELETE': '1' if batch else '0', 'TAPTIME_WAL_ARCHIVE_RUN_ONCE': '1',
            'T136_ISOLATED_RETENTION': '1' if label.startswith('isolated-month-') and mode == 'retention' else '0',
            'TAPTIME_BORG_LOCK_FILE': str(ROOT / 'shared.lock')}


def operation(config, label, operation_name, mode='main', batch=False, args=()):
    env = operation_env(config, label, mode, batch)
    for suffix in ['.borg.jsonl', '.lock.log', '.time.json', '.log']:
        path = ROOT / 'logs' / (label + suffix)
        if path.exists():
            raise RuntimeError(f'Output already exists: {path}; preserve it and choose a fresh label')
    log = (ROOT / 'logs' / (label + '.log')).open('wb')
    process = subprocess.Popen(['python3', str(SOURCE / 'tests/backup-scale/time-command.py'),
                                str(ROOT / 'logs' / (label + '.time.json')),
                                'bash', str(SOURCE / 'tests/backup-scale/operations.sh'), operation_name, *args],
                               stdout=log, stderr=subprocess.STDOUT, env=env, cwd=ROOT, start_new_session=True)
    JOBS.append(process)
    return process, log, time.monotonic()


def finish_operation(job, label, allow_failure=False):
    process, log, began = job
    try:
        while process.poll() is None:
            guard()
            if time.monotonic() - began > 6600:
                raise TimeoutError('Production 110 minute window exceeded')
            time.sleep(2)
    except BaseException:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
        raise
    finally:
        log.close()
    trace = ROOT / 'logs' / (label + '.borg.jsonl')
    calls = [json.loads(line) for line in trace.read_text().splitlines()] if trace.exists() else []
    timing = json.loads((ROOT / 'logs' / (label + '.time.json')).read_text())
    result = {'label': label, **timing,
              'borgCalls': len(calls), 'commands': {name: sum(c['command'] == name for c in calls)
                                                for name in sorted({c['command'] for c in calls})},
              'borgSeconds': sum(c['seconds'] for c in calls), 'bytes': guard()}
    event('operation', **result)
    if process.returncode and not allow_failure:
        raise RuntimeError(f'{label} failed; inspect logs/{label}.log')
    return result


def monthly():
    initial = inventory(ROOT / 'repo')
    if sum(name.startswith('wal-') for name in initial) < 20000:
        raise RuntimeError('Monthly comparison requires >=20000 actual WAL archives')
    sets = []
    for arm in ['individual', 'batch']:
        label = f'isolated-month-{arm}'
        target = ROOT / 'repo-month'
        if target.exists():
            raise RuntimeError('Refuse to overwrite monthly comparison repository')
        guard()
        shutil.copytree(ROOT / 'repo', target)
        config = configuration('repo-month', label)
        env = operation_env(config, label)
        # Warm each arm's own genuine Borg cache before timing, same initial data.
        shell = 'source "$TAPTIME_BACKUP_CONFIG"; python3 "$T136_SOURCE/tests/backup-scale/borg-call.py" info "$BORG_REPOSITORY" >/dev/null'
        run(['bash', '-ec', shell], env=env)
        Path(env['T136_TRACE']).unlink()
        job = operation(config, label, 'restore-verify', 'retention', arm == 'batch')
        followers = []
        if arm == 'individual':
            # A real unarchived segment is waiting before either contender starts.
            state = json.loads((ROOT / 'state.json').read_text())
            pending = sorted(p for p in (ROOT / 'spool').iterdir()
                             if re.fullmatch('[0-9A-F]{24}', p.name) and p.name > state['files'][-1])
            if not pending:
                sql("INSERT INTO public.synthetic_wal_payload SELECT coalesce(max(id),0)+1, md5(random()::text) FROM public.synthetic_wal_payload; SELECT pg_switch_wal()")
                time.sleep(1)
                pending = sorted(p for p in (ROOT / 'spool').iterdir()
                                 if re.fullmatch('[0-9A-F]{24}', p.name) and p.name > state['files'][-1])
            if not pending:
                raise RuntimeError('No real pending WAL for the contention measurement')
            destination = ROOT / 'confirmation-spool'
            destination.mkdir(exist_ok=True)
            shutil.copyfile(pending[0], destination / pending[0].name)
            deadline = time.monotonic()+10
            while not Path(env['T136_LOCK_TRACE']).exists():
                if time.monotonic() > deadline:
                    raise RuntimeError('Retention did not acquire the outer lock')
                time.sleep(.02)
            followers = [
                (operation(config, 'isolated-month-wal-wait', 'wal-archiver', 'archive-file', args=[pending[0].name]), 'isolated-month-wal-wait'),
                (operation(config, 'isolated-month-base-wait', 'backup'), 'isolated-month-base-wait')]
        result = finish_operation(job, label)
        for follower, label in followers:
            follower_result = finish_operation(follower, label, allow_failure=label.endswith('base-wait'))
            if follower_result['returncode'] and 'lock-timeout' not in (ROOT / 'logs' / (label + '.lock.log')).read_text():
                raise RuntimeError('Unexpected concurrent base failure')
        # Independent cache prevents clone security history from changing baseline.
        remaining = inventory(target, env_from_config(config))
        removed = sorted(set(initial) - set(remaining))
        wal_removed = [name for name in removed if name.startswith('wal-')]
        if not wal_removed:
            raise RuntimeError('Fixture did not exercise monthly WAL deletion')
        sets.append(removed)
        event('month-result', arm=arm, removedWal=len(wal_removed), removedBases=sum(n.startswith('base-') for n in removed),
              remainingWal=sum(n.startswith('wal-') for n in remaining), **result)
        (ROOT / 'logs' / f'isolated-month-{arm}-removed.json').write_text(json.dumps(removed))
        shutil.rmtree(target)
    if sets[0] != sets[1]:
        raise RuntimeError('Individual and batch deletion selected different archives')
    event('monthly-equivalence', exactDeletedSetsEqual=True, removed=len(sets[0]))


def registration_probe():
    target = ROOT / 'repo-registration'
    if target.exists():
        raise RuntimeError('Refuse to overwrite registration probe repository')
    shutil.copytree(ROOT / 'repo', target)
    try:
        config = configuration(target.name, 'production-registration')
        result = finish_operation(operation(config, 'production-registration', 'restore-verify', 'retention'),
                                  'production-registration', allow_failure=True)
        log = (ROOT / 'logs/production-registration.log').read_text()
        known_defect = result['returncode'] == 2 and 'Deferring retention until the archiver registered' in log
        if result['returncode'] and not known_defect:
            raise RuntimeError('Unexpected original retention failure')
        event('unmodified-registration-probe', knownSetPrefixDefect=known_defect, **result)
    finally:
        shutil.rmtree(target)


def env_from_config(path):
    result = run(['bash', '-ec', 'source "$1"; env -0', '_', str(path)])
    return {line.split(b'=',1)[0].decode(): line.split(b'=',1)[1].decode()
            for line in result.stdout.split(b'\0') if line.startswith(b'BORG_')}


def inventory(repository, environment=None):
    return borg('list', '--format', '{archive}{NL}', repository, extra_env=environment).stdout.decode().splitlines()


def start_receiver():
    destination = ROOT / 'confirmation-spool'
    destination.mkdir(exist_ok=True)
    os.chown(destination, 999, 999)
    os.chmod(destination, 0o700)
    state = json.loads((ROOT / 'state.json').read_text())
    identity = sql("SELECT lpad(to_hex(system_identifier),16,'0') FROM pg_control_system()")
    if identity != state['cluster']:
        raise RuntimeError('Receiver database differs from the fixture cluster')
    identity_file = destination / '.cluster-system-identifier'
    if identity_file.exists() and identity_file.read_text().strip() != identity:
        raise RuntimeError('Receiver spool belongs to another cluster')
    identity_file.write_text(identity+'\n')
    os.chown(identity_file, 999, 999)
    os.chmod(identity_file, 0o600)
    if sql("SELECT active FROM pg_replication_slots WHERE slot_name='t136_receiver'") == 't':
        return
    # Preserve every genuine completed segment after the seeding window.
    for path in (ROOT / 'spool').iterdir():
        if re.fullmatch('[0-9A-F]{24}', path.name):
            shutil.copyfile(path, destination / path.name)
            os.chown(destination / path.name, 999, 999)
    sql("ALTER SYSTEM SET archive_command = 'true'")
    sql('SELECT pg_reload_conf()')
    docker('exec', '--user', 'postgres', PG, 'pg_receivewal', '--create-slot', '--slot=t136_receiver',
           '--directory=/work/confirmation-spool', '--dbname=dbname=postgres')
    docker('exec', '-d', '--user', 'postgres', PG, 'pg_receivewal', '--slot=t136_receiver',
           '--directory=/work/confirmation-spool', '--dbname=dbname=postgres', '--synchronous')
    for _ in range(100):
        if sql("SELECT active FROM pg_replication_slots WHERE slot_name='t136_receiver'") == 't':
            return
        time.sleep(.1)
    raise RuntimeError('Local pg_receivewal did not activate its slot')


def new_wal_samples(amount=5):
    directory = ROOT / 'confirmation-spool'
    before = {p.name for p in directory.iterdir()}
    for _ in range(amount):
        sql("INSERT INTO public.synthetic_wal_payload SELECT (SELECT coalesce(max(id),0)+1 FROM public.synthetic_wal_payload), string_agg(md5(random()::text),'') FROM generate_series(1,512); SELECT pg_switch_wal()")
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        fresh = sorted(p for p in directory.iterdir() if re.fullmatch('[0-9A-F]{24}', p.name) and p.name not in before)
        if len(fresh) >= amount:
            return fresh[:amount]
        time.sleep(.1)
    raise RuntimeError('Timed out waiting for real completed sample WALs')


def stages(start_size=20000):
    state = json.loads((ROOT / 'state.json').read_text())
    start_receiver()
    snapshot_spool = ROOT / 'spool-snapshot'
    if 'stageFixture' not in state:
        samples = new_wal_samples()
        snapshot_spool.mkdir()
        for p in (ROOT / 'confirmation-spool').iterdir():
            if re.fullmatch('[0-9A-F]{24}', p.name):
                shutil.copyfile(p, snapshot_spool / p.name)
        state['stageFixture'] = {'samples': [p.name for p in samples],
                                'receipted': sql('SELECT wal_file FROM taptime_server.offsite_wal_archive_receipts ORDER BY wal_file').splitlines()}
        save(state)
    samples = [snapshot_spool / name for name in state['stageFixture']['samples']]
    # Earlier contention diagnostics recorded a genuine immutable receipt. A
    # copied repository must contain those exact bytes before the full archiver
    # may trust the receipt. Keep the same initial set at every measured stage.
    receipted = state['stageFixture']['receipted']
    sizes = [20000, 11920, 7648, 4088]
    for size in sizes[sizes.index(start_size):]:
        label = f'stage-{size}'
        target = ROOT / 'repo-stage'
        if target.exists():
            raise RuntimeError('Refuse to overwrite stage repository')
        shutil.copytree(ROOT / 'repo', target)
        config = configuration('repo-stage', label)
        environment = env_from_config(config)
        for wal_file in receipted:
            archive = f"wal-{state['cluster']}-{wal_file}"
            if archive not in inventory(target, environment):
                if not (snapshot_spool / wal_file).is_file():
                    raise RuntimeError('Missing immutable receipt-backed WAL fixture')
                borg('create', '--compression', 'zstd,6', f'{target}::{archive}', wal_file,
                     cwd=snapshot_spool, extra_env=environment)
        # Controlled manifest-size experiment: identical bases and current chain,
        # remove oldest WALs only. Historical PITR of every old base is NOT tested.
        names = inventory(target, environment)
        wal = sorted(n for n in names if n.startswith('wal-'))
        if len(wal) > size:
            borg('delete', target, *wal[:len(wal)-size], extra_env=environment, timeout=600)
        compact_started = time.monotonic()
        borg('compact', target, extra_env=environment)
        compact_seconds = time.monotonic() - compact_started
        # Warm-cache CLI samples; all WAL payloads came from real PostgreSQL.
        counts = inventory(target, environment)
        raw = docker('exec', *[a for k,v in environment.items() for a in ['-e', f'{k}={v}']],
                     BORG, 'python3', '/src/tests/backup-scale/repo-metrics.py', str(target))
        metrics = json.loads(raw.stdout)
        metrics['repositoryAllocatedBytes'] = int(run(['du', '-s', '-B1', target]).stdout.split()[0])
        metrics['walArchives'] = sum(n.startswith('wal-') for n in counts)
        metrics['baseArchives'] = sum(n.startswith('base-') for n in counts)
        list_samples = []
        create_samples = []
        for sample in samples:
            start = time.monotonic()
            inventory(target, environment)
            list_samples.append(time.monotonic()-start)
            name = f'create-sample-{sample.name}'
            start = time.monotonic()
            borg('create', '--compression', 'zstd,6', f'{target}::{name}', sample.name,
                 cwd=sample.parent, extra_env=environment)
            create_samples.append(time.monotonic()-start)
            returned = borg('extract', '--stdout', f'{target}::{name}', sample.name, extra_env=environment).stdout
            if hashlib.sha256(returned).digest() != hashlib.sha256(sample.read_bytes()).digest():
                raise RuntimeError('Created WAL differs on readback')
            borg('delete', f'{target}::{name}', extra_env=environment)
        metrics.update({'listSeconds': list_samples, 'createSeconds': create_samples, 'compactSeconds': compact_seconds,
                        'payloadBytesPerWal': samples[0].stat().st_size, 'sizeIsSyntheticEstimate': True})
        (ROOT / 'logs' / (label + '.metrics.json')).write_text(json.dumps(metrics, indent=2))
        event('stage-metrics', label=label, **metrics)
        base = state['weeklyBase']
        finish_operation(operation(config, label+'-plan', 'restore-verify', 'plan-extract',
                                   args=[base['name'], base['wal']]), label+'-plan')
        job = operation(config, label+'-weekly', 'restore-verify')
        followers = []
        if size == start_size:
            lock = ROOT / 'logs' / (label+'-weekly.lock.log')
            deadline = time.monotonic()+20
            while not lock.exists():
                if time.monotonic() > deadline:
                    raise RuntimeError('Weekly probe did not acquire the lock')
                time.sleep(.02)
            followers = [(operation(config, f'weekly-{size}-wal-wait', 'wal-archiver'), f'weekly-{size}-wal-wait'),
                         (operation(config, f'weekly-{size}-base-wait', 'backup'), f'weekly-{size}-base-wait')]
        weekly = finish_operation(job, label+'-weekly', allow_failure=True)
        if weekly['returncode']:
            text = (ROOT / 'logs' / (label+'-weekly.log')).read_text()
            if 'Physical restore verification completed:' not in text or 'Retention has no success within the last eight days.' not in text:
                raise RuntimeError('Unexpected weekly failure; do not classify as the known registration guard defect')
            event('weekly-production-defect', label=label, physicalRestoreSucceeded=True,
                  completeWeeklySucceeded=False, reason='registration-output-SET-prefix')
        for follower, follower_label in followers:
            finish_operation(follower, follower_label)
        shutil.rmtree(target)
        guard()


def cleanup():
    """Remove only exact owned containers, their anonymous volumes and this volume."""
    state = json.loads((ROOT / 'state.json').read_text())
    owned = state.get('ownedContainers')
    if owned is None or state.get('volume') != 't136-scale-data':
        raise RuntimeError('Missing recorded ownership; do not guess cleanup targets')
    for process in JOBS:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
    if state.get('ownerToken'):
        # Recover a successfully created container even if its response was lost.
        identifiers = docker('ps', '-aq', '--no-trunc', '--filter', f'label=t136-owner={state["ownerToken"]}').stdout.decode().splitlines()
        for identifier in identifiers:
            details = json.loads(docker('inspect', identifier).stdout)[0]
            owned[details['Name'].lstrip('/')] = identifier
    for name, expected in owned.items():
        details = json.loads(docker('inspect', name).stdout)[0]
        if details['Id'] != expected or not any(m.get('Name') == state['volume'] for m in details['Mounts']):
            raise RuntimeError('Container identity/mount changed; refusing cleanup')
    # Production restore container names are recorded by the local adapter.
    spawned = ROOT / 'spawned-containers.txt'
    if spawned.exists():
        for identifier in spawned.read_text().splitlines():
            if not re.fullmatch('[0-9a-f]{64}', identifier):
                raise RuntimeError('Invalid exact restore-container ID')
            result = subprocess.run(['docker', '--host', 'unix:///var/run/docker.sock', 'inspect', identifier], capture_output=True)
            if result.returncode == 0:
                docker('rm', '-f', '-v', identifier)
    for expected in owned.values():
        docker('rm', '-f', '-v', expected)
    docker('volume', 'rm', state['volume'])


def export_results(destination):
    destination.mkdir(parents=True, exist_ok=False)
    shutil.copytree(ROOT / 'logs', destination / 'logs')
    if (ROOT / 'events.jsonl').exists():
        shutil.copyfile(ROOT / 'events.jsonl', destination / 'events.jsonl')
    # Payloads, PGDATA, Borg repositories/caches and the full fixture state stay
    # on the owned volume and are removed. Only compact evidence is exported.
    inventory = json.loads((ROOT / 'state.json').read_text())
    summary = {key: value for key, value in inventory.items() if key not in ['files']}
    summary['seedWalArchives'] = len(inventory['files'])
    (destination / 'fixture-summary.json').write_text(json.dumps(summary, indent=2))


def validate_destination(destination):
    if destination.exists():
        raise RuntimeError('Results destination already exists; preserve it and choose a new directory')
    if not destination.parent.is_dir():
        raise RuntimeError('Results parent directory must already exist')
    if not destination.resolve().is_relative_to((SOURCE / '.t136-review').resolve()):
        raise RuntimeError('Results must stay inside the task review directory')


def main():
    if os.environ.get('TAPTIME_BACKUP_SCALE') != 'synthetic-local-only':
        raise RuntimeError('Set TAPTIME_BACKUP_SCALE=synthetic-local-only')
    if os.geteuid() != 0:
        raise RuntimeError('Run under sudo inside the local VM')
    if sys.platform != 'linux' or not Path('/var/run/docker.sock').exists():
        raise RuntimeError('Only the existing local Linux Docker VM is supported')
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['initialize', 'seed', 'fixture', 'registration', 'monthly', 'stages', 'cleanup', 'all'])
    parser.add_argument('--archives', type=int, default=20000)
    parser.add_argument('--replace-fixture', action='store_true')
    parser.add_argument('--stage-from', type=int, choices=[20000,11920,7648,4088], default=20000)
    parser.add_argument('--results', type=Path)
    args = parser.parse_args()
    def interrupted(_signal, _frame):
        raise KeyboardInterrupt('Interrupted; the complete-run finally performs cleanup')
    signal.signal(signal.SIGTERM, interrupted)
    if args.action == 'initialize':
        initialize()
    elif args.action == 'seed':
        seed(args.archives)
    elif args.action == 'fixture':
        fixture(args.replace_fixture)
    elif args.action == 'monthly':
        monthly()
    elif args.action == 'registration':
        registration_probe()
    elif args.action == 'stages':
        stages(args.stage_from)
    elif args.action == 'cleanup':
        try:
            if args.results:
                export_results(args.results)
        finally:
            (ROOT / 'measurement-done').touch()
            cleanup()
    elif args.action == 'all':
        if not args.results:
            raise RuntimeError('--results is required for the self-cleaning complete run')
        validate_destination(args.results)
        # Runtime images must already exist; this runner never installs/pulls.
        docker('image', 'inspect', IMAGE)
        docker('image', 'inspect', PG_IMAGE)
        existing = docker('volume', 'ls', '--format', '{{.Name}}').stdout.decode().splitlines()
        if 't136-scale-data' in existing:
            raise RuntimeError('An existing measurement volume must be resolved first')
        docker('volume', 'create', 't136-scale-data')
        try:
            initialize()
            seed(args.archives)
            fixture()
            registration_probe()
            monthly()
            stages()
        finally:
            # A partial setup still needs explicit ownership evidence. Never use
            # prefix cleanup or delete unrelated resources after an unknown error.
            if (ROOT / 'state.json').exists():
                try:
                    export_results(args.results)
                finally:
                    (ROOT / 'measurement-done').touch()
                    cleanup()
            else:
                docker('volume', 'rm', 't136-scale-data')


if __name__ == '__main__':
    main()
