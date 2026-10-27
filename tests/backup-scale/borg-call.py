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
        if key.startswith('BORG_'):
            command += ['-e', key + '=' + value]
    command += [os.environ['T136_BORG_CONTAINER'], '/usr/bin/borg', *args]
    started = time.monotonic()
    wall_started = time.time()
    result = subprocess.run(command, timeout=6600)
    record = {'command': args[0], 'arguments': args[1:] if len(args) < 20 else args[1:2],
              'archiveArguments': max(0, len(args) - 2), 'seconds': time.monotonic() - started,
              'started': wall_started, 'finished': time.time(), 'returncode': result.returncode}
    with trace.open('a') as out:
        out.write(json.dumps(record) + '\n')
    return result.returncode


def main():
    args = sys.argv[1:]
    if not args:
        raise ValueError('Borg arguments required')
    return invoke(args)


if __name__ == '__main__':
    sys.exit(main())
