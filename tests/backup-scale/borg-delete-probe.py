#!/usr/bin/env python3
"""Real installed Borg CLI contract; creates and removes one temporary local repo."""
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time


def main():
    if os.environ.get('TAPTIME_BACKUP_SCALE') != 'synthetic-local-only':
        raise RuntimeError('Explicit local synthetic opt-in required')
    with tempfile.TemporaryDirectory(prefix='t136b-delete-') as directory:
        root=Path(directory)
        env={**os.environ, 'BORG_CACHE_DIR':str(root/'cache'), 'BORG_CONFIG_DIR':str(root/'config'),
             'BORG_SECURITY_DIR':str(root/'security'), 'BORG_HOST_ID':f'synthetic-{root.name}'}
        repo=str(root/'repo')
        def borg(*args,check=True):
            return subprocess.run(['borg',*args],env=env,cwd=root,capture_output=True,
                                  text=True,check=check,timeout=60)
        version=borg('--version').stdout.strip()
        borg('init','--encryption=none',repo)
        (root/'payload').write_text('synthetic local CLI semantics\n')
        names=['wal-0123456789abcdef-'+f'{number:024X}' for number in range(1,4)]
        adjacent=names[0]+'-adjacent'
        for name in [*names,adjacent]:
            borg('create',repo+'::'+name,'payload')
        borg('delete',repo,*names[:2])
        remaining=borg('list','--format','{archive}{NL}',repo).stdout.splitlines()
        if set(remaining)!=set([names[2],adjacent]):
            raise RuntimeError('Exact multi-archive deletion differs from the expected contract')
        missing=borg('delete',repo,'wal-0123456789abcdef-FFFFFFFFFFFFFFFFFFFFFFFF',check=False)
        after=borg('list','--format','{archive}{NL}',repo).stdout.splitlines()
        if missing.returncode!=0 or set(after)!=set(remaining):
            raise RuntimeError('Borg 1.2.8 absent-name selection semantics changed')
        ready=root/'locked'
        holder=subprocess.Popen(['borg','with-lock',repo,'sh','-c',
                                 'touch "$1"; read token; exit 0','_',str(ready)],
                                env=env,cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        try:
            deadline=time.monotonic()+10
            while not ready.exists():
                if holder.poll() is not None or time.monotonic()>deadline:
                    raise RuntimeError('Real Borg lock was not acquired')
                time.sleep(.05)
            failure=borg('delete','--lock-wait','0',repo,names[2],check=False)
        finally:
            holder.communicate(input=b'done\n',timeout=10)
        after=borg('list','--format','{archive}{NL}',repo).stdout.splitlines()
        if failure.returncode==0 or set(after)!=set(remaining):
            raise RuntimeError('Failed locked deletion modified the repository or succeeded')
        # Real forced vs graceful SIGINT checkpoint. The container's --init
        # must reap the killed child, and the explicit host ID must let Borg
        # distinguish its dead lock from a different machine's live process.
        interrupt_names=[f'base-interrupt-{number:03}' for number in range(20)]
        for name in interrupt_names:
            borg('create',repo+'::'+name,'payload')
        env['T136_SLOW_TRACE']=str(root/'interrupt.jsonl')
        def interrupted_delete(grace):
            return subprocess.run(['timeout','--signal=INT',f'--kill-after={grace}','1',
                                   'python3',str(Path(__file__).with_name('slow-borg.py')),
                                   'delete',repo,*interrupt_names],
                                  env=env,cwd=root,capture_output=True,text=True,timeout=30)
        killed=interrupted_delete(1)
        after_kill=borg('list','--format','{archive}{NL}',repo).stdout.splitlines()
        # subprocess reports a directly killed process as -SIGKILL; Docker/the
        # shell boundary reports the same event as 128+SIGKILL (137).
        if killed.returncode!=-signal.SIGKILL or set(after_kill)!=set(remaining+interrupt_names):
            raise RuntimeError(f'Hard-kill rollback/dead-lock recovery failed: rc={killed.returncode}, remaining={after_kill}')
        graceful=interrupted_delete(10)
        after_grace=borg('list','--format','{archive}{NL}',repo).stdout.splitlines()
        committed=set(after_kill)-set(after_grace)
        if graceful.returncode!=124 or not committed or not committed<set(interrupt_names):
            raise RuntimeError('SIGINT did not durably commit partial archive deletion')
        print(json.dumps({'borg':version,'exactTwoNameDelete':True,'unselectedPreserved':True,
                          'missingArchiveReturncode':missing.returncode,
                          'lockedRepositoryReturncode':failure.returncode,
                          'remainingAfterFailedBlock':after,'diagnostic':failure.stderr.strip()}))
        print(json.dumps({'hardKillReturncode':killed.returncode,'automaticDeadLockRecovery':True,
                          'gracefulTimeoutReturncode':graceful.returncode,
                          'gracefulCommittedDeletions':sorted(committed)}))


if __name__=='__main__':
    main()
