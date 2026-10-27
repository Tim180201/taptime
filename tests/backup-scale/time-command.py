#!/usr/bin/env python3
"""Wall time independent of when the parent collects a concurrent job."""
import json
from pathlib import Path
import subprocess
import sys
import time

started = time.monotonic()
wall_started = time.time()
result = subprocess.run(sys.argv[2:])
Path(sys.argv[1]).write_text(json.dumps({'seconds': time.monotonic()-started,
                                      'started': wall_started, 'finished': time.time(),
                                      'returncode': result.returncode}))
sys.exit(result.returncode)
