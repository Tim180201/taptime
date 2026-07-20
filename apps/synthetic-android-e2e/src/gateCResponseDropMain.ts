import { createInterface, type Interface } from 'node:readline';
import {
  SyntheticGateCResponseDropProxy,
  type SyntheticGateCResponseDropSafeEvent,
} from './SyntheticGateCResponseDropProxy.js';
import {
  SyntheticGateCReverseController,
  SystemSyntheticGateCAdbCommandRunner,
  type SyntheticGateCReverseSafeEvent,
} from './SyntheticGateCReverseController.js';

let input: Interface | null = null;
let shuttingDown = false;
let commandQueue = Promise.resolve();
const proxy = new SyntheticGateCResponseDropProxy({ onSafeEvent: reportSafeEvent });
const controller = new SyntheticGateCReverseController(
  proxy,
  new SystemSyntheticGateCAdbCommandRunner(),
  reportSafeEvent,
);

try {
  await controller.arm();
  process.stdout.write([
    'synthetic_gate_c_response_drop_ready',
    'operator_commands=status | restore | stop',
    'sensitive_values_are_never_printed',
    '',
  ].join('\n'));
  input = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  input.on('line', (line) => {
    commandQueue = commandQueue
      .then(() => handleCommand(line))
      .catch(() => {
        process.stdout.write('operator_command_failed\n');
      });
  });
  input.once('close', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
} catch {
  process.stderr.write('synthetic_gate_c_response_drop_start_failed\n');
  process.exitCode = 1;
}

async function handleCommand(line: string): Promise<void> {
  const normalized = line.trim();
  if (normalized === 'status') {
    const status = controller.getStatus();
    process.stdout.write(
      `synthetic_gate_c_response_drop_status=${status.reverse}/${status.proxy}\n`,
    );
    return;
  }
  if (normalized === 'restore') {
    const successfulDrop = await controller.restore();
    if (!successfulDrop) {
      process.exitCode = 1;
    }
    await shutdown();
    return;
  }
  if (normalized === 'stop') {
    await shutdown();
    return;
  }
  process.stdout.write('operator_command_rejected\n');
}

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  input?.close();
  input = null;
  try {
    await controller.close();
    process.stdout.write('synthetic_gate_c_response_drop_stopped\n');
  } catch {
    process.stderr.write('synthetic_gate_c_response_drop_cleanup_failed\n');
    process.exitCode = 1;
  }
}

function reportSafeEvent(
  event: SyntheticGateCResponseDropSafeEvent | SyntheticGateCReverseSafeEvent,
): void {
  process.stdout.write(`synthetic_gate_c_event=${event}\n`);
}
