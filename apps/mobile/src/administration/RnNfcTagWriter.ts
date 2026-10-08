import { createCanonicalNfcUidPayload } from '@taptime/core';
import NfcManager, { Ndef, NdefStatus, NfcTech } from 'react-native-nfc-manager';
import type { NfcTagWriter, TagWriteResult } from './NfcTagWriter';
import type { ConnectedTagSession } from '../nfc/IosNfcSession';

/** Android reuses the scanned tag; iOS is called inside the arbiter's connected tag action. */
export class RnNfcTagWriter implements NfcTagWriter {
  private flight: Promise<TagWriteResult> | null = null;
  private generation = 0;

  constructor(_packageName: string | null | undefined, private readonly platform = 'android') {}

  write(canonicalPayload: string, uri: string, session?: ConnectedTagSession): Promise<TagWriteResult> {
    if (this.flight !== null) return Promise.resolve({ status: 'failed', reason: 'write_failed' });
    const operation = this.platform === 'ios'
      ? this.performIosWrite(canonicalPayload, uri, this.generation, session)
      : this.performWrite(canonicalPayload, uri, this.generation);
    const flight = operation.finally(() => {
      if (this.flight === flight) this.flight = null;
    });
    this.flight = flight;
    return flight;
  }

  async cancel(): Promise<void> {
    this.generation += 1;
    // The iOS capture owner must be able to invalidate the session while native I/O waits.
    // Keep the writer flight occupied until the pending callback drains.
    if (this.platform === 'ios') return;
    // Let any already dispatched native I/O drain and its finally close the handle.
    // A later write cannot start before that cleanup completes.
    await this.flight;
  }

  private async performIosWrite(canonicalPayload: string, uri: string, generation: number, session?: ConnectedTagSession): Promise<TagWriteResult> {
    const cancelled = () => generation !== this.generation || session?.isOpen() === false;
    while (!cancelled()) {
      try {
        const tag = await NfcManager.getTag();
        if (cancelled()) return { status: 'failed', reason: 'cancelled' };
        if (typeof tag?.id !== 'string' || createCanonicalNfcUidPayload(tag.id) !== canonicalPayload) {
          return { status: 'failed', reason: 'tag_changed' };
        }
        if (hasExactUri(tag, uri)) return { status: 'written' };
        // Same bytes as Android, a single URI record; neither platform locks tags.
        const bytes = Ndef.encodeMessage([Ndef.uriRecord(uri)]);
        const status = await NfcManager.ndefHandler.getNdefStatus();
        if (cancelled()) return { status: 'failed', reason: 'cancelled' };
        if (status.status === NdefStatus.ReadOnly) return { status: 'failed', reason: 'read_only' };
        if (status.status !== NdefStatus.ReadWrite) return { status: 'failed', reason: 'ndef_not_supported' };
        if (status.capacity < bytes.length) return { status: 'failed', reason: 'capacity_exceeded' };
        session?.diagnose('write_started');
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        if (cancelled()) return { status: 'failed', reason: 'cancelled' };
        session?.diagnose('readback_started');
        const verified = hasExactUri(await NfcManager.ndefHandler.getNdefMessage(), uri);
        if (!verified) return { status: 'failed', reason: 'write_failed' };
        session?.diagnose('readback_verified');
        return cancelled() ? { status: 'failed', reason: 'cancelled' } : { status: 'written' };
      } catch (error) {
        if (!cancelled() && await session?.reconnect(error, canonicalPayload)) continue;
        return { status: 'failed', reason: cancelled() ? 'cancelled' : 'write_failed' };
      }
    }
    return { status: 'failed', reason: 'cancelled' };
  }

  private async performWrite(canonicalPayload: string, uri: string, generation: number): Promise<TagWriteResult> {
    const cancelled = (): boolean => generation !== this.generation;
    let result: TagWriteResult = { status: 'failed', reason: 'write_failed' };
    try {
      // requestTechnology waits for a NEW discovery. connect reuses the tag just scanned,
      // without installing another listener or requiring another tap (manager 3.17.2).
      await NfcManager.connect([NfcTech.Ndef, NfcTech.NdefFormatable]);
      if (cancelled()) return { status: 'failed', reason: 'cancelled' };
      const tag = await NfcManager.getTag();
      if (cancelled()) return { status: 'failed', reason: 'cancelled' };
      if (typeof tag?.id !== 'string' || createCanonicalNfcUidPayload(tag.id) !== canonicalPayload) {
        return { status: 'failed', reason: 'tag_changed' };
      }
      if (hasExactUri(tag, uri)) return { status: 'written' };
      const bytes = Ndef.encodeMessage([
        Ndef.uriRecord(uri),
      ]);
      if (tag.techTypes?.includes('android.nfc.tech.Ndef')) {
        const status = await NfcManager.ndefHandler.getNdefStatus();
        if (cancelled()) return { status: 'failed', reason: 'cancelled' };
        if (status.status === NdefStatus.ReadOnly) return { status: 'failed', reason: 'read_only' };
        if (status.status !== NdefStatus.ReadWrite) return { status: 'failed', reason: 'ndef_not_supported' };
        if (status.capacity < bytes.length) return { status: 'failed', reason: 'capacity_exceeded' };
        await NfcManager.ndefHandler.writeNdefMessage(bytes, { reconnectAfterWrite: true });
        if (cancelled()) return { status: 'failed', reason: 'cancelled' };
        if (!hasExactUri(await NfcManager.ndefHandler.getNdefMessage(), uri)) {
          return { status: 'failed', reason: 'write_failed' };
        }
      } else if (tag.techTypes?.includes('android.nfc.tech.NdefFormatable')) {
        await NfcManager.ndefFormatableHandlerAndroid.formatNdef(bytes, { readOnly: false });
      } else {
        return { status: 'failed', reason: 'ndef_not_supported' };
      }
      // connect() alone can resolve even if native connection failed. Only completed I/O
      // authorizes registration, and cancellation never authorizes it.
      result = cancelled() ? { status: 'failed', reason: 'cancelled' } : { status: 'written' };
    } catch {
      result = { status: 'failed', reason: cancelled() ? 'cancelled' : 'write_failed' };
    } finally {
      try {
        await NfcManager.cancelTechnologyRequest({ delayMsAndroid: 0, throwOnError: true });
      } catch {
        // A disconnect cannot undo a verified write (or successful formatting).
      }
    }
    return cancelled() ? { status: 'failed', reason: 'cancelled' } : result;
  }
}

function hasExactUri(tag: Awaited<ReturnType<typeof NfcManager.getTag>>, uri: string): boolean {
  const records = tag?.ndefMessage;
  if (records?.length !== 1) return false;
  const record = records[0]!;
  try {
    return Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_URI)
      && Ndef.uri.decodePayload(Uint8Array.from(record.payload)) === uri;
  } catch { return false; }
}
