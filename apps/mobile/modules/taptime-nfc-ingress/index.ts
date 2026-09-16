import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeNfcIngressCapture {
  readonly uid: readonly number[];
  readonly wallClockMilliseconds: number;
  readonly elapsedRealtimeMilliseconds: number;
}

export interface NativeNfcIngressCaptureEvidence {
  readonly bootMarker: string;
  readonly intentOrigin: 'process_start_intent' | 'activity_delivery_intent';
  readonly processStartElapsedRealtimeMilliseconds: number;
  readonly elapsedRealtimeMilliseconds: number;
}

interface NativeNfcIngressModule {
  hasPending(): boolean;
  readPendingEvidence(): NativeNfcIngressCaptureEvidence | null;
  consume(): NativeNfcIngressCapture | null;
  clear(): void;
  closeProcessStartIntentWindow(): void;
}

const nativeModule = requireOptionalNativeModule<NativeNfcIngressModule>('TapTimeNfcIngress');

export default {
  hasPending(): boolean {
    return nativeModule?.hasPending() ?? false;
  },
  readPendingEvidence(): NativeNfcIngressCaptureEvidence | null {
    const evidence = nativeModule?.readPendingEvidence() ?? null;
    if (evidence === null) return null;
    if (
      typeof evidence.bootMarker !== 'string'
      || evidence.bootMarker.length < 1
      || new TextEncoder().encode(evidence.bootMarker).length > 256
      || (
        evidence.intentOrigin !== 'process_start_intent'
        && evidence.intentOrigin !== 'activity_delivery_intent'
      )
      || !Number.isSafeInteger(evidence.processStartElapsedRealtimeMilliseconds)
      || evidence.processStartElapsedRealtimeMilliseconds < 0
      || !Number.isSafeInteger(evidence.elapsedRealtimeMilliseconds)
      || evidence.elapsedRealtimeMilliseconds < 0
      || evidence.processStartElapsedRealtimeMilliseconds
        > evidence.elapsedRealtimeMilliseconds
    ) {
      nativeModule?.clear();
      return null;
    }
    return Object.freeze({
      bootMarker: evidence.bootMarker,
      intentOrigin: evidence.intentOrigin,
      processStartElapsedRealtimeMilliseconds:
        evidence.processStartElapsedRealtimeMilliseconds,
      elapsedRealtimeMilliseconds: evidence.elapsedRealtimeMilliseconds,
    });
  },
  consume(): NativeNfcIngressCapture | null {
    const capture = nativeModule?.consume() ?? null;
    if (capture === null) return null;
    if (
      !Array.isArray(capture.uid)
      || capture.uid.length < 1
      || capture.uid.length > 32
      || capture.uid.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
      || !Number.isSafeInteger(capture.wallClockMilliseconds)
      || capture.wallClockMilliseconds < 0
      || !Number.isSafeInteger(capture.elapsedRealtimeMilliseconds)
      || capture.elapsedRealtimeMilliseconds < 0
    ) {
      nativeModule?.clear();
      throw new Error('Native NFC ingress evidence is invalid');
    }
    return Object.freeze({
      uid: Object.freeze([...capture.uid]),
      wallClockMilliseconds: capture.wallClockMilliseconds,
      elapsedRealtimeMilliseconds: capture.elapsedRealtimeMilliseconds,
    });
  },
  clear(): void {
    nativeModule?.clear();
  },
  closeProcessStartIntentWindow(): void {
    nativeModule?.closeProcessStartIntentWindow();
  },
} satisfies NativeNfcIngressModule;
