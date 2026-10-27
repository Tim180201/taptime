#!/usr/bin/env python3
"""Read actual encrypted manifest bytes with the installed Borg implementation."""
import json
import sys
from borg.helpers import Manifest
from borg.logger import setup_logging
from borg.repository import Repository

setup_logging()
with Repository(sys.argv[1], exclusive=False) as repository:
    encrypted = repository.get(Manifest.MANIFEST_ID)
    manifest, key = Manifest.load(repository, (Manifest.Operation.READ,))
    print(json.dumps({'storedManifestBytes': len(encrypted), 'archives': len(manifest.archives)}))
