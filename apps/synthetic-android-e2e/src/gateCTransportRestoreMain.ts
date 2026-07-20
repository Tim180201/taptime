import {
  restoreSyntheticGateCTransport,
  SystemSyntheticGateCAdbCommandRunner,
} from './SyntheticGateCReverseController.js';

try {
  const result = restoreSyntheticGateCTransport(
    new SystemSyntheticGateCAdbCommandRunner(),
  );
  process.stdout.write(`synthetic_gate_c_emergency_restore=${result}\n`);
} catch {
  process.stderr.write('synthetic_gate_c_emergency_restore_failed\n');
  process.exitCode = 1;
}
