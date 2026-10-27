"""A refused second run must never clean up the first run's resources."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('retention_measure',Path(__file__).with_name('measure-retention.py'))
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class OwnedCleanup(unittest.TestCase):
    def test_existing_volume_refusal_does_not_cleanup_existing_state(self):
        with tempfile.TemporaryDirectory(prefix='t136b-refusal-') as directory:
            root=Path(directory)
            (root/'.t136b-review').mkdir()
            (root/'state.json').write_text(json.dumps({'ownerToken':'other-run'}))
            original_exists=Path.exists
            def exists(path):
                return str(path)=='/var/run/docker.sock' or original_exists(path)
            with patch.object(runner.m,'ROOT',root), patch.object(runner.m,'SOURCE',root), \
                    patch.object(runner,'CREATED_VOLUME_TOKEN',None), \
                    patch.object(runner.sys,'platform','linux'), patch.object(runner.os,'geteuid',return_value=0), \
                    patch.dict(runner.os.environ,{'TAPTIME_BACKUP_SCALE':'synthetic-local-only'}), \
                    patch.object(runner.sys,'argv',['measure-retention.py','all','--results',str(root/'.t136b-review/results')]), \
                    patch.object(Path,'exists',exists), patch.object(runner.m,'cleanup') as cleanup, \
                    patch.object(runner.m,'docker',return_value=subprocess.CompletedProcess([],0,b't136-scale-data\n')) as docker:
                with self.assertRaisesRegex(RuntimeError,'existing measurement volume'):
                    runner.main()
                cleanup.assert_not_called()
                docker.assert_called_once_with('volume','ls','-q')
                self.assertEqual(json.loads((root/'state.json').read_text()),{'ownerToken':'other-run'})


if __name__=='__main__':
    unittest.main()
