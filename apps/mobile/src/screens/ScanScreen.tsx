import { useMemo, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { buildScanDemoPipeline, DEMO_KNOWN_PAYLOAD, type CallerContext } from '@taptime/core';
import { RnNfcScanAdapter } from '../nfc/RnNfcScanAdapter';

interface ScanScreenProps {
  caller: CallerContext;
}

// DT-016: the primary scan trigger is now real NFC tag detection (RnNfcScanAdapter, Android
// only - NFC_Capability_Model.md's iOS question remains open, not decided here). The manual
// text input from DT-012 is retained as an optional fallback/debug affordance. Both paths
// await the same pipeline.scan(payload, caller) - no business logic
// here (ADR-0007 Platform Boundaries).
export function ScanScreen({ caller }: ScanScreenProps) {
  const [payload, setPayload] = useState(DEMO_KNOWN_PAYLOAD);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [nfcStatus, setNfcStatus] = useState('Tap "Scan NFC Tag" to begin.');
  const [isWaitingForTag, setIsWaitingForTag] = useState(false);

  const pipeline = useMemo(
    () => buildScanDemoPipeline((line) => setOutputLines((previous) => [...previous, line])),
    [],
  );
  const nfcAdapter = useMemo(() => new RnNfcScanAdapter(), []);

  async function handleNfcScan(): Promise<void> {
    setIsWaitingForTag(true);
    try {
      const capability = await nfcAdapter.checkCapability();
      if (capability === 'not_supported') {
        setNfcStatus('NFC is not available on this device.');
        return;
      }
      if (capability === 'disabled') {
        setNfcStatus('NFC is disabled. Please enable it in your device settings.');
        return;
      }

      setNfcStatus('Hold a tag near the device…');
      const result = await nfcAdapter.waitForNextTag();
      if (result.status === 'unreadable') {
        setNfcStatus('Could not read the NFC tag. Please try again.');
        return;
      }

      setNfcStatus(`Tag read: ${result.payload}`);
      await pipeline.scan(result.payload, caller);
    } finally {
      setIsWaitingForTag(false);
    }
  }

  async function handleManualScan(): Promise<void> {
    await pipeline.scan(payload, caller);
  }

  async function handleSynchronize(): Promise<void> {
    await pipeline.synchronizePending('success');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTim.e — Scan</Text>

      <Text style={styles.status} testID="nfc-status">
        {nfcStatus}
      </Text>
      <Button
        title={isWaitingForTag ? 'Waiting for tag…' : 'Scan NFC Tag'}
        onPress={handleNfcScan}
        disabled={isWaitingForTag}
        testID="nfc-scan-button"
      />

      <Text style={styles.fallbackLabel}>Manual fallback (debug)</Text>
      <TextInput
        style={styles.input}
        value={payload}
        onChangeText={setPayload}
        placeholder="Scanned tag payload"
        autoCapitalize="none"
        testID="scan-payload-input"
      />
      <View style={styles.buttonRow}>
        <Button title="Scan (manual)" onPress={handleManualScan} testID="scan-button" />
        <Button title="Synchronize" onPress={handleSynchronize} testID="synchronize-button" />
      </View>
      <ScrollView style={styles.output} testID="scan-output">
        {outputLines.map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  status: {
    marginBottom: 8,
    color: '#444',
  },
  fallbackLabel: {
    marginTop: 20,
    marginBottom: 4,
    fontSize: 12,
    color: '#888',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  output: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
  },
});
