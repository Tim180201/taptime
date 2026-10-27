#!/usr/bin/env python3
"""Populate real Borg archives using Borg's installed API; never a timing sample.

Each Archive.save constructs real chunks, items and archive metadata. Fixture
construction batches the final manifest/repository/cache commit for <=100 WALs.
This is expressly not a measurement of borg create. Measured operations always
use the unmodified /usr/bin/borg CLI. A normal Borg check validates the fixture.
"""
import json
import os
from pathlib import Path
import sys
import time

from borg.archive import Archive, ChunksProcessor, FilesystemObjectProcessors, MetadataCollector
from borg.cache import Cache
from borg.constants import CHUNKER_PARAMS
from borg.helpers import Manifest
from borg.logger import setup_logging
from borg.repository import Repository


def main():
    root = Path(sys.argv[1])
    repo = str(root / "repo")
    setup_logging()
    os.chdir(root / "spool")
    with Repository(repo, exclusive=True) as repository:
        manifest, key = Manifest.load(repository, (Manifest.Operation.WRITE,))
        with Cache(repository, key, manifest) as cache:
            requests = [json.loads(line) for line in sys.stdin]
            if not 1 <= len(requests) <= 100:
                raise ValueError('Seed transaction must contain 1..100 WAL files')
            manifest_write, repo_commit, cache_commit = manifest.write, repository.commit, cache.commit
            manifest.write = lambda *a, **kw: None
            repository.commit = lambda *a, **kw: None
            cache.commit = lambda *a, **kw: None
            for request in requests:
                name = request["file"]
                if len(name) != 24 or any(c not in "0123456789ABCDEF" for c in name):
                    raise ValueError("Only a genuine segment filename is accepted")
                if Path(name).stat().st_size != 16 * 1024 * 1024:
                    raise ValueError("Expected PostgreSQL 16 MiB segment")
                archive = Archive(repository, key, manifest, request["archive"], cache=cache,
                                  create=True, noatime=True)
                cp = ChunksProcessor(cache=cache, key=key, add_item=archive.add_item,
                                     write_checkpoint=archive.write_checkpoint,
                                     checkpoint_interval=1800, rechunkify=False)
                fso = FilesystemObjectProcessors(
                    metadata_collector=MetadataCollector(noatime=True, noctime=False,
                        nobirthtime=False, numeric_ids=False, noflags=False, noacls=False,
                        noxattrs=False), cache=cache, key=key,
                    process_file_chunks=cp.process_file_chunks, add_item=archive.add_item,
                    chunker_params=CHUNKER_PARAMS, show_progress=False, sparse=False,
                    log_json=False, iec=False)
                key.compressor = __import__("borg.compress", fromlist=["CompressionSpec"]).CompressionSpec("zstd,6").compressor
                fso.process_file(path=name, parent_fd=None, name=None, st=os.stat(name), cache=cache)
                archive.stats += fso.stats
                archive.save()
            manifest.write, repository.commit, cache.commit = manifest_write, repo_commit, cache_commit
            manifest.write()
            repository.commit(compact=False)
            cache.commit()
            for request in requests:
                Path(request['file']).unlink()
                print(json.dumps({"archive": request["archive"], "stored": True}), flush=True)


if __name__ == "__main__":
    main()
