#!/usr/bin/env python3
"""T-136b offline regression/scale run, using the genuine T-136 WAL generator.

Only the root writer runs this inside the existing local Linux VM. No installs,
network, ports or Docker socket mounts. The supervised prepare phase may remain
for diagnosis; all always exports compact evidence and removes its own resources.
"""
import argparse
import json
import os
from pathlib import Path
import signal
import sys
import time
from datetime import datetime, timedelta, timezone
import measure as m

m.IMAGE = 't136b-borg:local'
VOLUME = 't136-scale-data'  # the existing generator's exclusively owned workspace
CREATED_VOLUME_TOKEN = None


def prepare():
    global CREATED_VOLUME_TOKEN
    if VOLUME in m.docker('volume', 'ls', '-q').stdout.decode().splitlines():
        raise RuntimeError('Refuse to replace an existing measurement volume')
    for image in [m.IMAGE, m.PG_IMAGE]:
        m.docker('image', 'inspect', image)
    for root in [m.SOURCE, Path('/var/lib/docker')]:
        if m.shutil.disk_usage(root).free < m.RESERVE:
            raise RuntimeError('Less than 30 GB free before setup')
    token=str(m.uuid.uuid4())
    m.docker('volume', 'create', '--label', f't136b-owner={token}', VOLUME)
    details=json.loads(m.docker('volume','inspect',VOLUME).stdout)[0]
    if details.get('Labels',{}).get('t136b-owner')!=token:
        raise RuntimeError('Measurement volume was acquired by another run')
    CREATED_VOLUME_TOKEN=token
    m.initialize()
    m.seed(20010)  # final real physical base begins after >=20,000 older segments


def build_backlog(base_count=300):
    """Real archives of the final genuine base, with synthetic hourly dates."""
    state = json.loads((m.ROOT/'state.json').read_text())
    if state.get('backlogReady'):
        return state
    if state.get('baseArchives'):
        raise RuntimeError('Incomplete fixture; preserve evidence and clean up')
    base = state['bases'][-1]
    old = [name for name in state['files'] if name < base['wal']]
    if len(old) < 20000:
        raise RuntimeError('Need at least 20,000 genuinely obsolete WAL archives')
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    created = []
    marker_dir = m.ROOT/'marker-fixture'
    marker_dir.mkdir(exist_ok=True)
    for index in range(base_count):
        stamp = today - timedelta(hours=base_count-index) + timedelta(minutes=5, seconds=1)
        name = f"base-{state['cluster']}-{stamp.strftime('%Y%m%dT%H%M%SZ')}"
        m.borg('create', '--compression', 'zstd,6', '--timestamp', stamp.strftime('%Y-%m-%dT%H:%M:%S'),
               f'{m.ROOT}/repo::{name}', 'base.tar', 'manifest', cwd=m.ROOT/'bases'/base['label'])
        m.sql(f"SET ROLE taptime_wal_archiver; SELECT taptime_server.record_offsite_base_backup_v1('{name}','{base['lsn']}'::pg_lsn,'{base['wal']}')")
        for key, value in {'base-archive-name': name, 'base-start-wal-lsn': base['lsn'],
                           'base-start-wal-file': base['wal'], 'cluster-system-identifier': state['system'],
                           'cluster-archive-identifier': state['cluster']}.items():
            (marker_dir/key).write_text(value+'\n')
        m.borg('create', '--compression', 'zstd,6', f'{m.ROOT}/repo::verified-{name}',
               *sorted(p.name for p in marker_dir.iterdir()), cwd=marker_dir)
        created.append({'name': name, **base})
        if (index+1) % 25 == 0:
            m.event('base-backlog', archives=len(created), bytes=m.guard())
    # Distinct committed transactions straddle a real recovery timestamp. The
    # production recovery path must retain the first and exclude the second.
    m.sql('DELETE FROM public.synthetic_wal_payload WHERE id IN (1000001,1000002)')
    m.sql("INSERT INTO public.synthetic_wal_payload VALUES (1000001,'pitr-before')")
    m.sql('SELECT pg_switch_wal()')
    target = m.sql("SELECT (clock_timestamp() at time zone 'UTC')::text").replace(' ','T')+'Z'
    m.sql("INSERT INTO public.synthetic_wal_payload VALUES (1000002,'pitr-after')")
    switched = m.sql('SELECT pg_walfile_name(pg_current_wal_insert_lsn())')
    m.sql('SELECT pg_switch_wal()')
    # Wait for PostgreSQL's real archive_command to finish the last switched file.
    deadline = time.monotonic()+60
    while not (m.ROOT/'spool'/switched).exists():
        if time.monotonic() > deadline:
            raise RuntimeError('PITR WAL spool did not complete')
        time.sleep(.1)
    for path in sorted((m.ROOT/'spool').iterdir()):
        if m.re.fullmatch('[0-9A-F]{24}', path.name) and path.name not in state['files']:
            m.borg('create', '--compression', 'zstd,6', f'{m.ROOT}/repo::wal-{state["cluster"]}-{path.name}',
                   path.name, cwd=path.parent)
            state['files'].append(path.name)
    state.update(baseArchives=created, weeklyBase=created[-1], pitrTarget=target,
                 obsoleteWal=len(old), backlogReady=True)
    m.save(state)
    m.borg('compact', m.ROOT/'repo')
    start=time.monotonic()
    proof=m.borg('check','--verify-data',m.ROOT/'repo',timeout=1800)
    (m.ROOT/'logs/fixture-check.log').write_bytes(proof.stdout+proof.stderr)
    m.event('backlog-fixture', wal=len(state['files']), obsoleteWal=len(old), bases=len(created),
            markers=len(created), checkSeconds=time.monotonic()-start,
            uniquePayloads=m.sql("SELECT count(*) || '|' || count(DISTINCT md5(payload)) FROM public.synthetic_wal_payload"),
            bytes=m.guard())
    return state


def clone(repository, label, trim_to=None):
    target=m.ROOT/repository
    if target.exists():
        raise RuntimeError('Refuse to overwrite a measured repository')
    m.shutil.copytree(m.ROOT/'repo',target)
    config=m.configuration(repository,label)
    environment=m.env_from_config(config)
    if trim_to:
        names=sorted(n for n in m.inventory(target,environment) if n.startswith('wal-'))
        excess=names[:-trim_to]
        # Fixture construction only; all measured deletes use production blocks.
        for offset in range(0,len(excess),300):
            m.borg('delete',target,*excess[offset:offset+300],extra_env=environment)
        if excess:
            m.borg('compact',target,extra_env=environment)
    initial=m.inventory(target,environment)
    # Warm the cache without changing archive contents; all measured calls remain
    # the genuine CLI. This avoids counting cloned-repository cache reconstruction.
    m.borg('info',target,extra_env=m.env_from_config(config))
    m.guard()
    return target,config,initial


def wait_for_lock(job,label):
    deadline=time.monotonic()+60
    path=m.ROOT/'logs'/f'{label}.lock.log'
    while not path.exists():
        if job[0].poll() is not None or time.monotonic()>deadline:
            raise RuntimeError('Retention did not acquire the shared lock')
        time.sleep(.05)


def lock_wait(label):
    lines=(m.ROOT/'logs'/f'{label}.lock.log').read_text().splitlines()
    waits=[float(line.split('|')[2])-float(line.split('|')[1])
           for line in lines if line.startswith('lock-acquired|')]
    if not waits:
        raise RuntimeError('Missing actual lock acquisition')
    return sum(waits)


def measure(include_weekly=True):
    state=build_backlog()
    if include_weekly:
        weekly_repo,weekly_config,weekly_initial=clone('repo-weekly','weekly',trim_to=20000)
        wal_count=sum(n.startswith('wal-') for n in weekly_initial)
        if wal_count != 20000:
            raise RuntimeError('Weekly probe must begin with exactly 20,000 WAL archives')
        weekly=m.finish_operation(m.operation(weekly_config,'weekly','restore-verify'),'weekly')
        if weekly['seconds'] >= 6600:
            raise RuntimeError('Weekly verification exceeded 110 minutes')
        m.event('weekly-green', walBefore=wal_count, **weekly)
        m.shutil.rmtree(weekly_repo)

    target,config,initial=clone('repo-backlog','backlog')
    expected={f"wal-{state['cluster']}-{name}" for name in state['files'] if name < state['bases'][-1]['wal']}
    if len(expected)<20000 or sum(n.startswith('base-') for n in initial)<300:
        raise RuntimeError('Backlog acceptance conditions were not met')
    m.start_receiver()
    sample=m.new_wal_samples(1)[0].name
    followers=[]
    count=0
    while True:
        count+=1
        label=f'backlog-run-{count}'
        job=m.operation(config,label,'restore-verify','retention-run')
        if count==1:
            wait_for_lock(job,label)
            for name,operation in [('backlog-wal-wait','wal-archiver'),('backlog-base-wait','backup')]:
                followers.append((name,m.operation(config,name,operation)))
        result=m.finish_operation(job,label,allow_failure=True)
        status=(config.parent/'status/retention-status').read_text().strip()
        m.event('backlog-run', retentionStatus=status, **result)
        if status.startswith('ok|') and result['returncode']==0:
            break
        if not status.startswith('partial|') or count>=100:
            raise RuntimeError('Retention failed or made no bounded completion')
        # Local supervised experiment: weekly mode bypasses the hourly gate so
        # the requested run count can be measured without waiting wall-clock hours.
    for label,job in followers:
        result=m.finish_operation(job,label)
        m.event('backlog-follower', lockWaitSeconds=lock_wait(label), **result)
    remaining=m.inventory(target,m.env_from_config(config))
    removed=set(initial)-set(remaining)
    if {name for name in removed if name.startswith('wal-')} != expected:
        raise RuntimeError('Deleted WAL differs from the exact obsolete selection')
    receipt=m.sql(f"SELECT count(*) FROM taptime_server.offsite_wal_archive_receipts WHERE wal_file='{sample}'")
    if receipt!='1':
        raise RuntimeError('Concurrent archiver did not write its genuine receipt')
    m.event('backlog-complete', runs=count, removedWal=sum(n.startswith('wal-') for n in removed),
            removedBases=sum(n.startswith('base-') for n in removed), removedMarkers=sum(n.startswith('verified-') for n in removed),
            remainingWal=sum(n.startswith('wal-') for n in remaining), realWalReceipt=True, bytes=m.guard())
    pitr=m.configuration(target.name,'pitr-after-backlog')
    with pitr.open('a') as stream:
        stream.write(f"export TAPTIME_RESTORE_TARGET_TIME={m.shlex.quote(state['pitrTarget'])}\nexport T136_ASSERT_PITR=1\n")
    result=m.finish_operation(m.operation(pitr,'pitr-after-backlog','restore-verify'),'pitr-after-backlog')
    evidence=(m.ROOT/'logs/pitr-restored-rows.txt').read_text().strip()
    if evidence!='1|0':
        raise RuntimeError('Actual recovered rows do not match the recovery target')
    m.event('pitr-after-backlog-green', restoredRows=evidence, **result)


def main():
    if os.environ.get('TAPTIME_BACKUP_SCALE') != 'synthetic-local-only':
        raise RuntimeError('Explicit local synthetic opt-in required')
    if sys.platform != 'linux' or os.geteuid() != 0 or not Path('/var/run/docker.sock').exists():
        raise RuntimeError('Use sudo in the existing local Docker VM')
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'fixture', 'measure', 'backlog', 'all', 'cleanup'])
    parser.add_argument('--results', type=Path)
    args = parser.parse_args()
    if args.action in ['all','cleanup']:
        if not args.results or args.results.exists() or not args.results.parent.is_dir() or not args.results.resolve().is_relative_to((m.SOURCE/'.t136b-review').resolve()):
            raise RuntimeError('Choose a new result directory inside .t136b-review')
    def interrupted(_signum, _frame):
        raise KeyboardInterrupt('Interrupted local measurement')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        if args.action in ['prepare','all']:
            prepare()
        if args.action == 'fixture':
            build_backlog()
        if args.action in ['measure','all']:
            measure()
        if args.action == 'backlog':
            measure(include_weekly=False)
    finally:
        owns_volume = args.action == 'cleanup'
        if args.action == 'all' and CREATED_VOLUME_TOKEN:
            details=json.loads(m.docker('volume','inspect',VOLUME).stdout)[0]
            owns_volume=details.get('Labels',{}).get('t136b-owner')==CREATED_VOLUME_TOKEN
        if owns_volume and (m.ROOT/'state.json').exists():
            try:
                m.export_results(args.results)
            finally:
                (m.ROOT/'measurement-done').touch()
                m.cleanup()
        elif owns_volume and args.action == 'all':
            # initialize records state before creating any container. A failure
            # before that point can only leave this newly created empty volume.
            m.docker('volume','rm',VOLUME)
        elif owns_volume:
            raise RuntimeError('Missing recorded ownership; refusing cleanup')


if __name__ == '__main__':
    main()
