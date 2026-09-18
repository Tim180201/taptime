import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TAG_URI } from '../../src/nfc/tagAddress';

const manager = vi.hoisted(() => ({
  connect: vi.fn(), getTag: vi.fn(), cancelTechnologyRequest: vi.fn(),
  ndefHandler: { getNdefStatus: vi.fn(), writeNdefMessage: vi.fn(), makeReadOnly: vi.fn() },
  ndefFormatableHandlerAndroid: { formatNdef: vi.fn() },
}));
vi.mock('react-native-nfc-manager', () => ({
  default: manager,
  NfcTech: { Ndef: 'Ndef', NdefFormatable: 'NdefFormatable' },
  NdefStatus: { NotSupported: 1, ReadWrite: 2, ReadOnly: 3 },
  // Use the installed library's real codec, not a parallel mock encoder.
  Ndef: createRequire(import.meta.url)('react-native-nfc-manager/ndef-lib'),
}));
import { RnNfcTagWriter } from '../../src/administration/RnNfcTagWriter';
const Ndef = createRequire(import.meta.url)('react-native-nfc-manager/ndef-lib');
const packageName = 'com.taptime.test.variant';
const payload = 'nfc:uid:v1:04A1B2C3';
const tag = { id: '04A1B2C3', techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.Ndef'] };

beforeEach(() => {
  vi.resetAllMocks();
  manager.connect.mockResolvedValue(undefined);
  manager.getTag.mockResolvedValue(tag);
  manager.cancelTechnologyRequest.mockResolvedValue(undefined);
  manager.ndefHandler.getNdefStatus.mockResolvedValue({ status: 2, capacity: 256 });
  manager.ndefHandler.writeNdefMessage.mockResolvedValue(undefined);
  manager.ndefFormatableHandlerAndroid.formatNdef.mockResolvedValue(undefined);
});

function writtenUri(bytes: number[]): string {
  const records = Ndef.decodeMessage(bytes);
  expect(records).toHaveLength(2);
  expect(Ndef.isType(records[1], Ndef.TNF_EXTERNAL_TYPE, 'android.com:pkg')).toBe(true);
  expect(Ndef.util.bytesToString(records[1].payload)).toBe(packageName);
  expect(Ndef.isType(records[0], Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)).toBe(true);
  return Ndef.uri.decodePayload(records[0].payload);
}

describe('RnNfcTagWriter', () => {
  it('reuses the captured tag, writes URI then AAR idempotently and releases the native handle', async () => {
    const writer = new RnNfcTagWriter(packageName);
    await expect(writer.write(payload, TAG_URI)).resolves.toEqual({ status: 'written' });
    expect(manager.connect).toHaveBeenCalledWith(['Ndef', 'NdefFormatable']);
    expect(writtenUri(manager.ndefHandler.writeNdefMessage.mock.calls[0]![0])).toBe(TAG_URI);
    await writer.write(payload, TAG_URI);
    expect(manager.ndefHandler.writeNdefMessage.mock.calls[1]).toEqual(manager.ndefHandler.writeNdefMessage.mock.calls[0]);
    expect(manager.ndefHandler.makeReadOnly).not.toHaveBeenCalled();
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledTimes(2);
    expect(manager.cancelTechnologyRequest).toHaveBeenLastCalledWith({ delayMsAndroid: 0, throwOnError: true });
  });

  it('formats an NDEF-formatable tag without locking it', async () => {
    manager.getTag.mockResolvedValue({ ...tag, techTypes: ['android.nfc.tech.NfcA', 'android.nfc.tech.NdefFormatable'] });
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'written' });
    const [bytes, options] = manager.ndefFormatableHandlerAndroid.formatNdef.mock.calls[0]!;
    expect(writtenUri(bytes)).toBe(TAG_URI);
    expect(options).toEqual({ readOnly: false });
    expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
    expect(manager.ndefHandler.makeReadOnly).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'different tag', value: { ...tag, id: 'AABB' }, reason: 'tag_changed' },
    { name: 'missing UID', value: { ...tag, id: undefined }, reason: 'tag_changed' },
    { name: 'no NDEF support', value: { ...tag, techTypes: ['android.nfc.tech.NfcA'] }, reason: 'ndef_not_supported' },
  ])('does not write $name', async ({ value, reason }) => {
    manager.getTag.mockResolvedValue(value);
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'failed', reason });
    expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
    expect(manager.ndefFormatableHandlerAndroid.formatNdef).not.toHaveBeenCalled();
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });

  it.each([
    { status: 3, capacity: 256, reason: 'read_only' },
    { status: 1, capacity: 0, reason: 'ndef_not_supported' },
    { status: 2, capacity: 1, reason: 'capacity_exceeded' },
  ])('reports $reason and closes without writing', async ({ status, capacity, reason }) => {
    manager.ndefHandler.getNdefStatus.mockResolvedValue({ status, capacity });
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'failed', reason });
    expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });

  it.each([undefined, null, '', '   '])('does not touch a tag without a package name (%s)', async (missing) => {
    await expect(new RnNfcTagWriter(missing).write(payload, TAG_URI)).resolves.toEqual({ status: 'failed', reason: 'write_failed' });
    expect(manager.connect).not.toHaveBeenCalled();
    expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
    expect(manager.ndefFormatableHandlerAndroid.formatNdef).not.toHaveBeenCalled();
  });

  it('checks capacity against URI plus AAR, not just the URI', async () => {
    const uriSize = Ndef.encodeMessage([Ndef.uriRecord(TAG_URI)]).length;
    const totalSize = Ndef.encodeMessage([Ndef.uriRecord(TAG_URI), Ndef.androidApplicationRecord(packageName)]).length;
    expect(totalSize).toBeGreaterThan(uriSize);
    manager.ndefHandler.getNdefStatus.mockResolvedValueOnce({ status: 2, capacity: uriSize });
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'failed', reason: 'capacity_exceeded' });
    expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
    manager.ndefHandler.getNdefStatus.mockResolvedValueOnce({ status: 2, capacity: totalSize });
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'written' });
    expect(writtenUri(manager.ndefHandler.writeNdefMessage.mock.calls[0]![0])).toBe(TAG_URI);
  });

  it('does not mistake a resolved connect for successful writing', async () => {
    manager.ndefHandler.writeNdefMessage.mockRejectedValue(new Error('not connected'));
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'failed', reason: 'write_failed' });
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });

  it('reports native connect, formatting and cleanup errors safely', async () => {
    manager.connect.mockRejectedValueOnce(new Error('connect failure'));
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'failed', reason: 'write_failed' });
    manager.getTag.mockResolvedValueOnce({ ...tag, techTypes: ['android.nfc.tech.NdefFormatable'] });
    manager.ndefFormatableHandlerAndroid.formatNdef.mockRejectedValueOnce(new Error('format failure'));
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'failed', reason: 'write_failed' });
    manager.cancelTechnologyRequest.mockRejectedValueOnce(new Error('cleanup failure'));
    await expect(new RnNfcTagWriter(packageName).write(payload, TAG_URI)).resolves.toEqual({ status: 'failed', reason: 'write_failed' });
  });

  it('does not write after cancellation during connect and drains before reuse', async () => {
    let connect!: () => void;
    manager.connect.mockImplementationOnce(() => new Promise<void>((resolve) => { connect = resolve; }));
    const writer = new RnNfcTagWriter(packageName);
    const pending = writer.write(payload, TAG_URI);
    const cancellation = writer.cancel();
    await expect(writer.write(payload, TAG_URI)).resolves.toMatchObject({ status: 'failed' });
    connect();
    await cancellation;
    await expect(pending).resolves.toEqual({ status: 'failed', reason: 'cancelled' });
    expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
    await expect(writer.write(payload, TAG_URI)).resolves.toEqual({ status: 'written' });
  });

  it('withholds success after cancellation during native writing', async () => {
    let finishWrite!: () => void;
    manager.ndefHandler.writeNdefMessage.mockImplementationOnce(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    const writer = new RnNfcTagWriter(packageName);
    const pending = writer.write(payload, TAG_URI);
    await vi.waitFor(() => expect(manager.ndefHandler.writeNdefMessage).toHaveBeenCalledOnce());
    const cancellation = writer.cancel();
    finishWrite();
    await cancellation;
    await expect(pending).resolves.toEqual({ status: 'failed', reason: 'cancelled' });
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
});
