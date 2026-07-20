import { describe, expect, it } from 'vitest';
import type {
  SyntheticGateCResponseDropProxyControl,
  SyntheticGateCResponseDropState,
} from '../src/SyntheticGateCResponseDropProxy.js';
import {
  restoreSyntheticGateCTransport,
  SyntheticGateCReverseController,
  type SyntheticGateCAdbCommandRunner,
  type SyntheticGateCReverseSafeEvent,
} from '../src/SyntheticGateCReverseController.js';

describe('SyntheticGateCReverseController', () => {
  it('swaps only the API mapping, preserves unrelated mappings and restores after a valid drop',
    async () => {
      const adb = new FakeAdb();
      adb.mappings.set('tcp:54321', 'tcp:54321');
      adb.mappings.set('tcp:3000', 'tcp:3000');
      adb.mappings.set('tcp:9999', 'tcp:9998');
      const proxy = new FakeProxy();
      const events: SyntheticGateCReverseSafeEvent[] = [];
      const controller = new SyntheticGateCReverseController(
        proxy,
        adb,
        (event) => events.push(event),
      );

      await controller.arm();
      expect(adb.mappings).toEqual(new Map([
        ['tcp:54321', 'tcp:54321'],
        ['tcp:9999', 'tcp:9998'],
        ['tcp:3000', 'tcp:3001'],
      ]));
      expect(controller.getStatus()).toEqual({ proxy: 'armed', reverse: 'armed' });
      expect(events).toEqual(['gate_c_transport_armed']);

      proxy.state = 'blocked';
      await expect(controller.restore()).resolves.toBe(true);
      expect(adb.mappings).toEqual(new Map([
        ['tcp:54321', 'tcp:54321'],
        ['tcp:9999', 'tcp:9998'],
        ['tcp:3000', 'tcp:3000'],
      ]));
      expect(proxy.state).toBe('closed');
      expect(events).toEqual([
        'gate_c_transport_armed',
        'gate_c_transport_restored',
      ]);
      expect(adb.commands.some((command) => command.includes('--remove-all'))).toBe(false);
      expect(events.join(' ')).not.toContain(adb.serial);
    });

  it('restores transport after an operator abort without claiming a valid response drop',
    async () => {
      const adb = directAdb();
      const proxy = new FakeProxy();
      const events: SyntheticGateCReverseSafeEvent[] = [];
      const controller = new SyntheticGateCReverseController(
        proxy,
        adb,
        (event) => events.push(event),
      );
      await controller.arm();

      await expect(controller.restore()).resolves.toBe(false);
      expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
      expect(events.at(-1)).toBe('gate_c_transport_restored_after_abort');
    });

  it('rolls the API mapping back when proxy mapping installation fails', async () => {
    const adb = directAdb();
    adb.failOnce = (arguments_) => (
      arguments_.join(' ') === '-s synthetic-device reverse tcp:3000 tcp:3001'
    );
    const proxy = new FakeProxy();
    const events: SyntheticGateCReverseSafeEvent[] = [];
    const controller = new SyntheticGateCReverseController(
      proxy,
      adb,
      (event) => events.push(event),
    );

    await expect(controller.arm()).rejects.toThrow(
      'Synthetic Gate-C transport arm failed',
    );
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
    expect(adb.mappings.get('tcp:54321')).toBe('tcp:54321');
    expect(proxy.state).toBe('closed');
    expect(controller.getStatus().reverse).toBe('failed');
    expect(events).not.toContain('gate_c_transport_armed');
  });

  it('rejects absent, multiple and unauthorized device states before transport mutation',
    async () => {
      for (const devices of [
        [] as Array<{ details?: string; serial: string; state: string }>,
        [
          { serial: 'one', state: 'device' },
          { serial: 'two', state: 'device' },
        ],
        [{ serial: 'one', state: 'unauthorized' }],
        [
          {
            details: 'usb:synthetic transport_id:1',
            serial: 'synthetic-device',
            state: 'device',
          },
          { serial: 'offline-device', state: 'offline' },
        ],
      ]) {
        const adb = directAdb();
        adb.devices = devices;
        const proxy = new FakeProxy();
        const controller = new SyntheticGateCReverseController(proxy, adb);

        await expect(controller.arm()).rejects.toThrow(
          'exactly one authorized USB device',
        );
        expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
        expect(proxy.state).toBe('created');
      }
    });

  it.each([
    {
      details: 'product:synthetic model:synthetic transport_id:2',
      serial: '192.0.2.10:5555',
    },
    {
      details: 'usb:synthetic product:synthetic model:synthetic transport_id:3',
      serial: 'adb-synthetic._adb-tls-connect._tcp',
    },
    {
      details: 'product:synthetic model:synthetic transport_id:4',
      serial: 'synthetic-device',
    },
  ])('rejects non-USB ADB transport $serial', async ({ details, serial }) => {
    const adb = directAdb();
    adb.devices = [{ details, serial, state: 'device' }];
    const proxy = new FakeProxy();
    const controller = new SyntheticGateCReverseController(proxy, adb);

    await expect(controller.arm()).rejects.toThrow(
      'exactly one authorized USB device',
    );
    expect(proxy.state).toBe('created');
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
  });

  it('rejects a missing or unexpected direct mapping before the proxy starts', async () => {
    for (const host of [undefined, 'tcp:3999']) {
      const adb = directAdb();
      if (host === undefined) {
        adb.mappings.delete('tcp:3000');
      } else {
        adb.mappings.set('tcp:3000', host);
      }
      const proxy = new FakeProxy();
      const controller = new SyntheticGateCReverseController(proxy, adb);

      await expect(controller.arm()).rejects.toThrow(
        'mapping is unavailable or unexpected',
      );
      expect(proxy.state).toBe('created');
      expect(adb.mappings.get('tcp:3000')).toBe(host);
    }
  });

  it('rejects an unexpected mapping without overwriting it during restore', async () => {
    const adb = directAdb();
    const proxy = new FakeProxy();
    const events: SyntheticGateCReverseSafeEvent[] = [];
    const controller = new SyntheticGateCReverseController(
      proxy,
      adb,
      (event) => events.push(event),
    );
    await controller.arm();
    proxy.state = 'blocked';
    adb.mappings.set('tcp:3000', 'tcp:3999');

    await expect(controller.restore()).rejects.toThrow(
      'Synthetic Gate-C transport restore failed',
    );
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3999');
    expect(events.at(-1)).toBe('gate_c_transport_restore_failed');
    expect(adb.commands.some((command) => command.includes('--remove-all'))).toBe(false);
  });

  it('retries direct restoration during cleanup after a transient restore command failure',
    async () => {
      const adb = directAdb();
      const proxy = new FakeProxy();
      const controller = new SyntheticGateCReverseController(proxy, adb);
      await controller.arm();
      proxy.state = 'blocked';
      adb.failOnce = (arguments_) => (
        arguments_.join(' ') === '-s synthetic-device reverse tcp:3000 tcp:3000'
      );

      await expect(controller.restore()).rejects.toThrow(
        'Synthetic Gate-C transport restore failed',
      );
      expect(adb.mappings.has('tcp:3000')).toBe(false);
      await expect(controller.close()).resolves.toBeUndefined();
      expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
      expect(proxy.state).toBe('closed');
    });

  it('serializes concurrent restore and close calls without repeating the ADB swap', async () => {
    const adb = directAdb();
    const proxy = new FakeProxy();
    let releaseClose: (() => void) | null = null;
    let reportCloseStarted: (() => void) | null = null;
    const closeStarted = new Promise<void>((resolve) => {
      reportCloseStarted = resolve;
    });
    proxy.closeBarrier = new Promise<void>((resolve) => {
      releaseClose = resolve;
    });
    proxy.onCloseStarted = () => reportCloseStarted?.();
    const events: SyntheticGateCReverseSafeEvent[] = [];
    const controller = new SyntheticGateCReverseController(
      proxy,
      adb,
      (event) => events.push(event),
    );
    await controller.arm();
    proxy.state = 'blocked';

    const firstRestore = controller.restore();
    await closeStarted;
    const duplicateRestore = controller.restore();
    const concurrentClose = controller.close();
    (releaseClose as (() => void) | null)?.();

    await expect(firstRestore).resolves.toBe(true);
    await expect(duplicateRestore).resolves.toBe(true);
    await expect(concurrentClose).resolves.toBeUndefined();
    const apiRemovals = adb.commands.filter((command) => (
      command.join(' ') === '-s synthetic-device reverse --remove tcp:3000'
    ));
    expect(apiRemovals).toHaveLength(2);
    expect(events.filter((event) => event === 'gate_c_transport_restored')).toHaveLength(1);
    expect(events).not.toContain('gate_c_transport_restore_failed');
  });

  it('supports exact emergency restore and is idempotent once direct', () => {
    const adb = directAdb();
    adb.mappings.set('tcp:3000', 'tcp:3001');

    expect(restoreSyntheticGateCTransport(adb)).toBe('restored');
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
    expect(restoreSyntheticGateCTransport(adb)).toBe('already_direct');
    expect(adb.commands.some((command) => command.includes('--remove-all'))).toBe(false);
  });

  it('recovers the exact missing API mapping left between owned remove and add commands', () => {
    const adb = directAdb();
    adb.mappings.delete('tcp:3000');

    expect(restoreSyntheticGateCTransport(adb)).toBe('restored');
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
    expect(adb.mappings.get('tcp:54321')).toBe('tcp:54321');
  });

  it('rejects emergency restore for unknown ownership and leaves the mapping unchanged', () => {
    const adb = directAdb();
    adb.mappings.set('tcp:3000', 'tcp:3111');

    expect(() => restoreSyntheticGateCTransport(adb)).toThrow(
      'unexpected mapping',
    );
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3111');
  });

  it('isolates throwing safe-event observers from arm and cleanup', async () => {
    const adb = directAdb();
    const proxy = new FakeProxy();
    const controller = new SyntheticGateCReverseController(proxy, adb, () => {
      throw new Error('synthetic observer failure');
    });

    await expect(controller.arm()).resolves.toBeUndefined();
    proxy.state = 'blocked';
    await expect(controller.restore()).resolves.toBe(true);
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
  });
});

class FakeProxy implements SyntheticGateCResponseDropProxyControl {
  closeBarrier: Promise<void> | null = null;
  onCloseStarted: (() => void) | null = null;
  state: SyntheticGateCResponseDropState = 'created';

  async start(): Promise<void> {
    if (this.state !== 'created') {
      throw new Error('already started');
    }
    this.state = 'armed';
  }

  async close(): Promise<void> {
    this.onCloseStarted?.();
    await this.closeBarrier;
    this.state = 'closed';
  }

  getListenPort(): number {
    return 3_001;
  }

  getState(): SyntheticGateCResponseDropState {
    return this.state;
  }
}

class FakeAdb implements SyntheticGateCAdbCommandRunner {
  readonly serial = 'synthetic-device';
  devices: Array<{ details?: string; serial: string; state: string }> = [
    { details: 'usb:synthetic transport_id:1', serial: this.serial, state: 'device' },
  ];
  readonly mappings = new Map<string, string>();
  readonly commands: string[][] = [];
  failOnce: ((arguments_: readonly string[]) => boolean) | null = null;

  run(arguments_: readonly string[]): string {
    const command = [...arguments_];
    this.commands.push(command);
    if (this.failOnce?.(arguments_)) {
      this.failOnce = null;
      throw new Error('synthetic command failure');
    }
    if (
      arguments_.length === 2
      && arguments_[0] === 'devices'
      && arguments_[1] === '-l'
    ) {
      return [
        'List of devices attached',
        ...this.devices.map(
          (device) => `${device.serial}\t${device.state} ${device.details ?? ''}`.trim(),
        ),
        '',
      ].join('\n');
    }
    const prefix = arguments_.slice(0, 3);
    if (
      prefix[0] !== '-s'
      || prefix[1] !== this.serial
      || prefix[2] !== 'reverse'
    ) {
      throw new Error('unexpected synthetic command');
    }
    if (arguments_[3] === '--list') {
      return [
        ...[...this.mappings.entries()].map(
          ([device, host]) => `${this.serial} ${device} ${host}`,
        ),
        '',
      ].join('\n');
    }
    if (arguments_[3] === '--remove' && arguments_[4] !== undefined) {
      this.mappings.delete(arguments_[4]);
      return '';
    }
    if (arguments_[3] !== undefined && arguments_[4] !== undefined) {
      this.mappings.set(arguments_[3], arguments_[4]);
      return '';
    }
    throw new Error('unexpected synthetic command');
  }
}

function directAdb(): FakeAdb {
  const adb = new FakeAdb();
  adb.mappings.set('tcp:54321', 'tcp:54321');
  adb.mappings.set('tcp:3000', 'tcp:3000');
  return adb;
}
