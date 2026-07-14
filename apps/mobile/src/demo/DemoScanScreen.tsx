import { useMemo, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { buildScanDemoPipeline, DEMO_KNOWN_PAYLOAD, type CallerContext } from '@taptime/core';
import { RnNfcScanAdapter } from '../nfc/RnNfcScanAdapter';

export function DemoScanScreen({ caller }: { readonly caller: CallerContext }) {
  const [payload, setPayload] = useState(DEMO_KNOWN_PAYLOAD);
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState('Ready for explicit development demo scan.');
  const pipeline = useMemo(
    () => buildScanDemoPipeline((line) => setLines((previous) => [...previous, line])),
    [],
  );
  const nfc = useMemo(() => new RnNfcScanAdapter(), []);

  async function scanNfc(): Promise<void> {
    const capability = await nfc.checkCapability();
    if (capability !== 'ready') {
      setStatus(`NFC ${capability}.`);
      return;
    }
    setStatus('Waiting for demo tag …');
    const result = await nfc.scan();
    if (result.status !== 'captured') {
      setStatus('Demo tag unreadable.');
      return;
    }
    setStatus(`Demo tag read: ${result.payload}`);
    await pipeline.scan(result.payload, caller);
  }

  return (
    <View style={styles.container}>
      <Text>{status}</Text>
      <Button title="Scan NFC demo tag" onPress={scanNfc} />
      <TextInput style={styles.input} value={payload} onChangeText={setPayload} />
      <Button title="Run manual demo scan" onPress={() => pipeline.scan(payload, caller)} />
      <Button title="Synchronize demo queue" onPress={() => pipeline.synchronizePending('success')} />
      <ScrollView>{lines.map((line, index) => <Text key={index}>{line}</Text>)}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 10, padding: 16, backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8 },
});
