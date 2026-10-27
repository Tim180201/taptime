#!/usr/bin/env python3
"""Count and time real CLI calls from unchanged production shell functions."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def invoke(args):
    trace = Path(os.environ['T136_TRACE'])
    root = Path(os.environ['T136_ROOT'])
    cwd = Path.cwd().resolve()
    if not cwd.is_relative_to(root):
        cwd = root
    command = ['docker', '--host', 'unix:///var/run/docker.sock', 'exec', '-w', str(cwd)]
    for key, value in os.environ.items():
        if key.startswith(('BORG_', 'T136_SLOW_')) or key == 'TAPTIME_BACKUP_SCALE':
            command += ['-e', key + '=' + value]
    command += [os.environ['T136_BORG_CONTAINER']]
    remaining = os.environ.get('T136_BORG_TIMEOUT_SECONDS')
    grace = int(os.environ.get('T136_BORG_GRACE_SECONDS', '5'))
    if remaining is not None:
        if not remaining.isdigit() or not 5 <= grace < int(remaining) <= 600:
            raise ValueError('Invalid remaining retention deadline')
        # Timeout must run beside Borg: killing docker exec alone leaves the
        # container process alive and would invalidate the lock-budget proof.
        command += ['/usr/bin/timeout', '--signal=INT', f'--kill-after={grace}', str(int(remaining)-grace)]
    if os.environ.get('T136_SLOW_TRACE') and args[0] in ['prune', 'delete']:
        command += ['python3', '/src/tests/backup-scale/slow-borg.py', *args]
    else:
        command += ['/usr/bin/borg', *args]
    started = time.monotonic()
    wall_started = time.time()
    result = subprocess.run(command, timeout=6600)
    elapsed = time.monotonic() - started
    returncode = result.returncode
    if remaining and returncode == 137 and elapsed >= int(remaining):
        returncode = 124  # Same deadline classification as retention_command.
    names = [arg for arg in args[1:] if arg.startswith(('wal-', 'base-', 'verified-base-'))]
    record = {'command': args[0], 'arguments': args[1:] if len(args) < 20 else args[1:5],
              'archiveArguments': len(names), 'seconds': elapsed,
              'timeoutSeconds': remaining, 'graceSeconds': grace,
              'started': wall_started, 'finished': time.time(), 'returncode': result.returncode}
    with trace.open('a') as out:
        out.write(json.dumps(record) + '\n')
    return returncode


def main():
    args = sys.argv[1:]
    if not args:
        raise ValueError('Borg arguments required')
    return invoke(args)


if __name__ == '__main__':
    sys.exit(main())
