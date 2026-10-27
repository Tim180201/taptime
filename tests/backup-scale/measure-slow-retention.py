#!/usr/bin/env python3
"""T-136b R2: real Borg checkpoints, deliberately slow deletes, bounded catch-up.

Prepare/cleanup with measure-retention.py. Only synthetic, owned offline resources
are used. The only accelerated scheduling step ages the previous attempt by one
hour between runs; no inventory, deletion decision or success time is invented.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import time

spec = importlib.util.spec_from_file_location('retention', Path(__file__).with_name('measure-retention.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
m = r.m


def configure_slow(config, label, budget):
    with config.open('a') as stream:
        stream.write(f'export BACKUP_RETENTION_BUDGET_SECONDS={budget}\n')
        stream.write('export T136_RETENTION_MODE=daily\n')
        stream.write('export TAPTIME_BACKUP_SCALE=synthetic-local-only\n')
        stream.write(f'export T136_SLOW_TRACE={m.shlex.quote(str(m.ROOT/"logs"/(label+".slow.jsonl")))}\n')


def red():
    if any((m.ROOT/'logs'/('slow-red'+suffix)).exists()
           for suffix in ['.log','.time.json','.borg.jsonl','.slow.jsonl']):
        raise RuntimeError('Preserve existing red evidence; refuse to overwrite it')
    state = r.build_backlog(800)
    target, config, before = r.clone('repo-slow-red', 'slow-red')
    configure_slow(config, 'slow-red', 60)
    # Run the preserved pre-R2 source and its original five-second transport.
    old = m.SOURCE/'.t136b-review/r2'
    source = old/'restore-verify-before'
    if not source.exists():
        raise RuntimeError('The pre-R2 source snapshot is required for the red proof')
    m.shutil.copyfile(m.SOURCE/'infrastructure/backup/taptime-backup-workspace', old/'taptime-backup-workspace')
    adapter = m.ROOT/'logs/operations-red.sh'
    text = (old/'operations-before.sh').read_text()
    text = text.replace('source "$T136_SOURCE/infrastructure/backup/taptime-${1:?operation}"',
                        f'source {m.shlex.quote(str(source))}')
    adapter.write_text(text)
    env = m.operation_env(config, 'slow-red', 'retention-run')
    log = (m.ROOT/'logs/slow-red.log').open('wb')
    process = subprocess.Popen(['python3', str(m.SOURCE/'tests/backup-scale/time-command.py'),
                                str(m.ROOT/'logs/slow-red.time.json'), 'bash', str(adapter), 'restore-verify'],
                               stdout=log, stderr=subprocess.STDOUT, env=env, cwd=m.ROOT,
                               start_new_session=True)
    m.JOBS.append(process)
    result = m.finish_operation((process, log, time.monotonic()), 'slow-red', allow_failure=True)
    status = (config.parent/'status/retention-status').read_text().strip()
    after = m.inventory(target, m.env_from_config(config))
    removed = sorted(set(before)-set(after))
    evidence = [json.loads(line) for line in (m.ROOT/'logs/slow-red.slow.jsonl').read_text().splitlines()]
    started = [e for e in evidence if e['event']=='manifest-start' and e['interrupted'] and e['deleted']>0]
    if not status.startswith('failed|') or not started or removed:
        raise RuntimeError('Old code did not reproduce the expected failed/lost-progress defect')
    m.event('slow-red-confirmed', retentionStatus=status, removed=removed,
            interruptedUncommittedDeletes=started[-1]['deleted'], **result)
    m.shutil.rmtree(target)


def completed_operation(label):
    """Recover already completed timing evidence; never rerun or edit a sample."""
    timing = json.loads((m.ROOT/'logs'/(label+'.time.json')).read_text())
    if timing['returncode']:
        raise RuntimeError('Cannot resume an unsuccessful production operation')
    calls = [json.loads(line) for line in (m.ROOT/'logs'/(label+'.borg.jsonl')).read_text().splitlines()]
    return {'label':label, **timing, 'borgCalls':len(calls),
            'commands':{name:sum(c['command']==name for c in calls) for name in {c['command'] for c in calls}},
            'borgSeconds':sum(c['seconds'] for c in calls)}


def measure(budget, resume=False):
    state = r.build_backlog(800)
    if resume:
        target, config = m.ROOT/'repo-slow', m.ROOT/'runs/slow/config.sh'
        initial = m.inventory(m.ROOT/'repo')  # untouched source of the exact clone
        if (m.ROOT/'logs/slow-run-2.time.json').exists():
            raise RuntimeError('Resume is limited to collecting the completed first run')
    else:
        target, config, initial = r.clone('repo-slow', 'slow')
    if sum(n.startswith('base-') for n in initial)<800:
        raise RuntimeError('Need at least 800 physical-base archives')
    expected = {f"wal-{state['cluster']}-{name}" for name in state['files'] if name<state['bases'][-1]['wal']}
    if len(expected)<20000:
        raise RuntimeError('Need at least 20,000 genuinely obsolete WAL archives')
    if resume:
        initial_bytes = next(json.loads(line)['estimatedRepositoryBytes'] for line in
                             (m.ROOT/'events.jsonl').read_text().splitlines()
                             if json.loads(line)['event']=='slow-initial')
    else:
        initial_bytes = int(m.run(['du', '-s', '-B1', target]).stdout.split()[0])
        m.event('slow-initial', archives=len(initial), bases=sum(n.startswith('base-') for n in initial),
                wal=sum(n.startswith('wal-') for n in initial), obsoleteWal=len(expected),
                estimatedRepositoryBytes=initial_bytes)
    lock_limits = {}
    for suffix, operation in [('base','backup'), ('wal','wal-archiver')]:
        value = 'borg_lock_wait_seconds' if suffix=='base' else 'printf "%s\\n" "$ARCHIVER_BORG_LOCK_WAIT_SECONDS"'
        lock_limits[suffix] = int(m.run(['bash','-ec','source "$1"; source "$2"; '+value,'_',
                                        m.SOURCE/'infrastructure/backup'/('taptime-'+operation),config]).stdout)
    m.start_receiver()
    count = 0
    states = []
    interrupted_prune = False
    while True:
        count += 1
        label = f'slow-run-{count}'
        status_file = config.parent/'status/retention-status'
        prior_success = '0'
        if status_file.exists() and not resume:
            previous = status_file.read_text().strip().split('|')
            if previous[0] != 'partial':
                raise RuntimeError('Only a partial run may be resumed')
            prior_success = previous[2]
            # Real daily path, but do not spend wall-clock hours waiting for cron.
            original_attempt = previous[1]
            previous[1] = str(int(previous[1])-3600)
            status_file.write_text('|'.join(previous)+'\n')
            m.event('hourly-gate-advanced', originalAttempt=original_attempt, attempt=previous[1],
                    successUnchanged=previous[2])
        if resume:
            before, sample = set(initial), None
            result = completed_operation(label)
            followers = [(f'{label}-{suffix}',None) for suffix in ['wal','base']]
        else:
            configure_slow(config, label, budget)
            before = set(m.inventory(target, m.env_from_config(config)))
            sample = m.new_wal_samples(1)[0].name
            job = m.operation(config, label, 'restore-verify', 'retention-run')
            r.wait_for_lock(job, label)
            followers = [(f'{label}-{suffix}', m.operation(config, f'{label}-{suffix}', operation))
                         for suffix, operation in [('wal', 'wal-archiver'), ('base', 'backup')]]
            result = m.finish_operation(job, label)
        status = status_file.read_text().strip()
        if result['seconds']>budget or status.split('|')[0] not in ['partial', 'ok']:
            raise RuntimeError('Retention exceeded its budget or failed')
        if status.startswith('partial|') and status.split('|')[2]!=prior_success:
            raise RuntimeError('Partial run advanced the full-success timestamp')
        if result['commands'].get('compact')!=1:
            raise RuntimeError('Expected exactly one compact after committed progress')
        follower_results = []
        for follower_label, follower_job in followers:
            follow = completed_operation(follower_label) if resume else m.finish_operation(follower_job, follower_label)
            wait = r.lock_wait(follower_label)
            limit = lock_limits[follower_label.rsplit('-',1)[1]]
            if wait>limit:
                raise RuntimeError('Follower exceeded its actual production lock deadline')
            follower_results.append({'lockWaitSeconds':wait, 'lockLimitSeconds':limit, **follow})
        after = set(m.inventory(target, m.env_from_config(config)))
        removed = sorted(before-after)
        if not removed:
            raise RuntimeError('No confirmed durable progress in this run')
        trace = [json.loads(line) for line in (m.ROOT/'logs'/(label+'.slow.jsonl')).read_text().splitlines()]
        commits = [e for e in trace if e['event']=='repository-committed' and e['interrupted']]
        for commit in commits:
            if set(commit['deletedNames']) & after:
                raise RuntimeError('An interrupted committed archive reappeared')
            if commit['command']=='prune' and commit['deletedNames']:
                interrupted_prune = True
        if sample:
            receipt = m.sql(f"SELECT count(*) FROM taptime_server.offsite_wal_archive_receipts WHERE wal_file='{sample}'")
            if receipt!='1':
                raise RuntimeError('Follower did not confirm the genuine WAL')
        else:
            wal_status = json.loads((config.parent/'wal-status.json').read_text())
            if wal_status['state']!='ok' or wal_status['pending_count']!=0:
                raise RuntimeError('Recovered first full archiver did not confirm all pending WAL')
        record = {'retentionStatus':status, 'removedBases':sum(n.startswith('base-') for n in removed),
                  'removedWal':sum(n.startswith('wal-') for n in removed),
                  'removedMarkers':sum(n.startswith('verified-') for n in removed),
                  'interruptedCommits':len(commits), 'followers':follower_results, **result}
        states.append(record)
        (m.ROOT/'logs'/(label+'.removed.json')).write_text(json.dumps(removed))
        m.event('slow-progress', **record)
        resume = False
        if status.startswith('ok|'):
            break
        if count>=50:
            raise RuntimeError('Bounded catch-up did not converge')
    final = set(m.inventory(target, m.env_from_config(config)))
    if {n for n in set(initial)-final if n.startswith('wal-')} != expected:
        raise RuntimeError('Catch-up deleted a different WAL set')
    if count<2 or not interrupted_prune:
        raise RuntimeError('The required repeated budget and mid-prune SIGINT were not exercised')
    pitr = m.configuration(target.name, 'pitr-after-slow')
    with pitr.open('a') as stream:
        stream.write(f"export TAPTIME_RESTORE_TARGET_TIME={m.shlex.quote(state['pitrTarget'])}\nexport T136_ASSERT_PITR=1\n")
    result = m.finish_operation(m.operation(pitr, 'pitr-after-slow', 'restore-verify'), 'pitr-after-slow')
    rows = (m.ROOT/'logs/pitr-restored-rows.txt').read_text().strip()
    if rows!='1|0':
        raise RuntimeError('PITR row proof failed')
    summary = {'budgetSeconds':budget, 'runs':states, 'removedInitialWal':len(expected),
               'initialBases':sum(n.startswith('base-') for n in initial),
               'initialEstimatedRepositoryBytes':initial_bytes,
               'finalEstimatedRepositoryBytes':int(m.run(['du', '-s', '-B1', target]).stdout.split()[0]),
               'finalArchives':len(final),
               'interruptedPruneCommitted':interrupted_prune, 'pitr':result, 'restoredRows':rows}
    (m.ROOT/'logs/slow-summary.json').write_text(json.dumps(summary, indent=2))
    m.event('slow-complete', runs=count, restoredRows=rows, interruptedPruneCommitted=interrupted_prune)


def main():
    if os.environ.get('TAPTIME_BACKUP_SCALE')!='synthetic-local-only' or os.geteuid()!=0:
        raise RuntimeError('Explicit root opt-in in the local Linux VM is required')
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['fixture', 'red', 'measure', 'resume'])
    parser.add_argument('--budget', type=int, default=120)
    args = parser.parse_args()
    if not 90<=args.budget<=600:
        raise ValueError('Budget must allow the production checkpoint grace')
    if args.action=='fixture':
        r.build_backlog(800)
    elif args.action=='red':
        red()
    else:
        measure(args.budget, resume=args.action=='resume')


if __name__=='__main__':
    main()
