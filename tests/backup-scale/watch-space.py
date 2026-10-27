#!/usr/bin/env python3
"""Independent watchdog. Stop only the exact captured measurement containers."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time

root, host = map(Path, sys.argv[1:3])
containers = sys.argv[3:]
if len(containers) != 2 or any(len(value) != 64 or not all(c in '0123456789abcdef' for c in value) for value in containers):
    raise ValueError('Exactly two captured container IDs required')
peak = 0
while root.exists():
    sampled = subprocess.run(['du', '-s', '-B1', str(root)], capture_output=True)
    if sampled.returncode and (sampled.returncode != 1 or not sampled.stderr or
            any(b'No such file or directory' not in line for line in sampled.stderr.splitlines())):
        raise RuntimeError(sampled.stderr.decode())
    allocated = int(sampled.stdout.split()[0])
    peak = max(peak, allocated)
    free = min(shutil.disk_usage(root).free, shutil.disk_usage(host).free)
    record = {'time': time.time(), 'allocatedBytes': allocated, 'peakBytes': peak, 'minimumFreeBytes': free}
    print(json.dumps(record), flush=True)
    if allocated > 18 * 1000**3 or free < 30 * 1000**3:
        subprocess.run(['docker', '--host', 'unix:///var/run/docker.sock', 'stop', '--time', '2', *containers], check=True)
        raise RuntimeError('Disk guard stopped the exact owned containers')
    if (root / 'measurement-done').exists():
        break
    time.sleep(10)
print(json.dumps({'finished': True, 'peakBytes': peak}), flush=True)
