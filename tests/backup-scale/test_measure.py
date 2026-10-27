"""Safety conditions, not a reimplementation of Borg or PostgreSQL."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('measurement', Path(__file__).with_name('measure.py'))
measurement = importlib.util.module_from_spec(spec)
spec.loader.exec_module(measurement)


class SafetyConditions(unittest.TestCase):
    def test_low_free_space_aborts_before_du(self):
        class Disk:
            free = measurement.RESERVE - 1
        with patch.object(measurement.shutil, 'disk_usage', return_value=Disk()), \
                patch.object(measurement.subprocess, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'Less than 30 GB'):
                measurement.guard()
            run.assert_not_called()

    def test_du_disappearing_lock_file_is_a_bounded_snapshot_race(self):
        class Disk:
            free = measurement.RESERVE + 1
        with patch.object(measurement.shutil, 'disk_usage', return_value=Disk()), \
                patch.object(measurement.subprocess, 'run', return_value=subprocess.CompletedProcess(
                    [], 1, b'1234 /owned\n', b'du: lock.roster: No such file or directory\n')):
            self.assertEqual(measurement.guard(), 1234)

    def test_du_permission_error_is_not_masked(self):
        class Disk:
            free = measurement.RESERVE + 1
        with patch.object(measurement.shutil, 'disk_usage', return_value=Disk()), \
                patch.object(measurement.subprocess, 'run', return_value=subprocess.CompletedProcess(
                    [], 1, b'1234 /owned\n', b'du: /owned: Permission denied\n')):
            with self.assertRaisesRegex(RuntimeError, 'Permission denied'):
                measurement.guard()

    def test_working_budget_aborts_before_user_ceiling(self):
        class Disk:
            free = measurement.RESERVE + 1
        with patch.object(measurement.shutil, 'disk_usage', return_value=Disk()), \
                patch.object(measurement, 'event'), \
                patch.object(measurement.subprocess, 'run', return_value=subprocess.CompletedProcess(
                    [], 0, f'{measurement.LIMIT} /owned\n'.encode(), b'')):
            with self.assertRaisesRegex(RuntimeError, 'working budget'):
                measurement.guard()

    def test_cleanup_refuses_reused_container_name(self):
        with tempfile.TemporaryDirectory(prefix='t136-safety-') as temporary:
            root = Path(temporary)
            (root / 'state.json').write_text(json.dumps({'ownedContainers': {'owned': '1'*64},
                                                       'volume': 't136-scale-data'}))
            with patch.object(measurement, 'ROOT', root), patch.object(measurement, 'JOBS', []), \
                    patch.object(measurement, 'docker', return_value=subprocess.CompletedProcess(
                        [], 0, json.dumps([{'Id': '2'*64, 'Mounts': [{'Name': 't136-scale-data'}]}]).encode(), b'')) as docker:
                with self.assertRaisesRegex(RuntimeError, 'identity/mount changed'):
                    measurement.cleanup()
                self.assertTrue(all(call.args[0] == 'inspect' for call in docker.call_args_list))

    def test_existing_results_are_rejected_before_a_long_run(self):
        with tempfile.TemporaryDirectory(prefix='t136-destination-') as temporary:
            root = Path(temporary)
            existing = root / '.t136-review' / 'results'
            existing.mkdir(parents=True)
            with patch.object(measurement, 'SOURCE', root):
                with self.assertRaisesRegex(RuntimeError, 'already exists'):
                    measurement.validate_destination(existing)
                measurement.validate_destination(existing.parent / 'fresh')
                with self.assertRaisesRegex(RuntimeError, 'task review directory'):
                    measurement.validate_destination(root / 'outside')


if __name__ == '__main__':
    unittest.main()
