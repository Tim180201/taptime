import NfcManager, { NfcEvents, type TagEvent } from 'react-native-nfc-manager';
import { createNfcPayload, type NfcScanCaptureResult, type NfcScanPort } from '@taptime/core';

// NFC_Capability_Model.md Required Failure States ("NFC not available on device", "NFC
// disabled") - narrowly-scoped capability states, not a business rejection reason.
// AssignmentResolver/AssignmentValidator remain the only owners of business meaning
// (Development Sprint 011 Plan, Section 6).
export type NfcCapabilityState = 'ready' | 'not_supported' | 'disabled';

export function normalizeTag(tag: TagEvent): NfcScanCaptureResult {
  if (typeof tag.id !== 'string' || tag.id.trim().length === 0) {
    return { status: 'unreadable' };
  }

  return { status: 'captured', payload: createNfcPayload(tag.id) };
}

// DT-016. Real, hardware-backed implementation of the existing NfcScanPort contract
// (packages/core/src/ports/NfcScanPort.ts, unmodified - its own comment anticipated exactly
// this adapter). NFC tag detection is inherently asynchronous (a physical tap can happen at
// any time), but the port's scan() method is synchronous - this adapter bridges the two
// exactly the way CliNfcScanAdapter already does for CLI input: an async listener
// (waitForNextTag) buffers the latest normalized result, and scan() synchronously returns
// whatever is currently buffered.
//
// Captures a technical fact (a tag was read, or could not be) - it never decides business
// meaning (NFC_Capability_Model.md: "creating a raw scan event... passing the scan event to
// the business layer"; ADR-0007 Domain Platform boundary). Android only this sprint; iOS
// remains an explicitly open product question (NFC_Capability_Model.md), not decided here.
export class RnNfcScanAdapter implements NfcScanPort {
  private latestResult: NfcScanCaptureResult = { status: 'unreadable' };
  private started = false;

  async checkCapability(): Promise<NfcCapabilityState> {
    const supported = await NfcManager.isSupported();
    if (!supported) {
      return 'not_supported';
    }

    await this.ensureStarted();
    const enabled = await NfcManager.isEnabled();
    return enabled ? 'ready' : 'disabled';
  }

  async waitForNextTag(): Promise<NfcScanCaptureResult> {
    await this.ensureStarted();

    return new Promise((resolve) => {
      const finish = (result: NfcScanCaptureResult): void => {
        this.latestResult = result;
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        void NfcManager.unregisterTagEvent().catch(() => undefined);
        resolve(result);
      };

      NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
        finish(normalizeTag(tag));
      });

      void NfcManager.registerTagEvent().catch(() => {
        finish({ status: 'unreadable' });
      });
    });
  }

  scan(): NfcScanCaptureResult {
    return this.latestResult;
  }

  private async ensureStarted(): Promise<void> {
    if (this.started) {
      return;
    }

    await NfcManager.start();
    this.started = true;
  }
}
