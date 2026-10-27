#!/usr/bin/env python3
"""Delay the installed Borg 1.2.8, without replacing any deletion/commit logic.

Only the synthetic offline measurement container uses this wrapper. Sleeps before
Archive.delete and Manifest.write simulate slow archive I/O and a slow SIGINT
checkpoint; all archive selection, transactions and signal handling remain Borg's.
"""
import json
import os
from pathlib import Path
import sys
import time


def main():
    if os.environ.get('TAPTIME_BACKUP_SCALE') != 'synthetic-local-only':
        raise RuntimeError('Explicit local synthetic opt-in required')
    import borg
    from borg import archiver
    from borg.archive import Archive
    from borg.helpers import Manifest
    from borg.repository import Repository
    if borg.__version__ != '1.2.8':
        raise RuntimeError('Delay instrumentation is specific to Borg 1.2.8')
    trace = Path(os.environ['T136_SLOW_TRACE'])
    base_delay = float(os.environ.get('T136_SLOW_BASE_SECONDS', '.08'))
    wal_delay = float(os.environ.get('T136_SLOW_WAL_SECONDS', '.006'))
    checkpoint_delay = float(os.environ.get('T136_SLOW_CHECKPOINT_SECONDS', '8'))
    if not all(0 <= delay <= 10 for delay in [base_delay, wal_delay, checkpoint_delay]):
        raise ValueError('Delay must be bounded')
    deleted = []

    def event(kind, **fields):
        with trace.open('a') as stream:
            stream.write(json.dumps({'event': kind, 'pid': os.getpid(), 'time': time.time(),
                                     'command': sys.argv[1], **fields}) + '\n')

    original_delete, original_write, original_commit = Archive.delete, Manifest.write, Repository.commit

    def delete(self, *args, **kwargs):
        time.sleep(base_delay if self.name.startswith('base-') else wal_delay)
        result = original_delete(self, *args, **kwargs)
        deleted.append(self.name)
        return result

    def write(self, *args, **kwargs):
        interrupted = bool(archiver.sig_int)
        event('manifest-start', interrupted=interrupted, deleted=len(deleted))
        if interrupted:
            time.sleep(checkpoint_delay)
        result = original_write(self, *args, **kwargs)
        event('manifest-written', interrupted=interrupted, deleted=len(deleted))
        return result

    def commit(self, *args, **kwargs):
        result = original_commit(self, *args, **kwargs)
        event('repository-committed', interrupted=bool(archiver.sig_int), deletedNames=deleted.copy())
        return result

    Archive.delete, Manifest.write, Repository.commit = delete, write, commit
    event('started', argv=sys.argv[1:5], baseDelay=base_delay, walDelay=wal_delay,
          interruptCheckpointDelay=checkpoint_delay)
    archiver.main()


if __name__ == '__main__':
    main()
