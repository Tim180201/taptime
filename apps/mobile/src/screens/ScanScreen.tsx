import { useMemo, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { buildScanDemoPipeline, DEMO_KNOWN_PAYLOAD } from '@taptime/core';

// Placeholder scan trigger (DT-012): a text input + button, not real NFC hardware - none
// exists yet (Development Sprint 006 Plan, Section 7). Calls the existing DT-011 composition
// root unmodified; introduces no business logic of its own (ADR-0007 Platform Boundaries -
// the domain/Business Engine remain independent of React Native/Expo).
export function ScanScreen() {
  const [payload, setPayload] = useState(DEMO_KNOWN_PAYLOAD);
  const [outputLines, setOutputLines] = useState<string[]>([]);

  const pipeline = useMemo(
    () => buildScanDemoPipeline((line) => setOutputLines((previous) => [...previous, line])),
    [],
  );

  function handleScan(): void {
    pipeline.scan(payload);
  }

  function handleSynchronize(): void {
    pipeline.synchronizePending('success');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTim.e — Scan (placeholder trigger)</Text>
      <TextInput
        style={styles.input}
        value={payload}
        onChangeText={setPayload}
        placeholder="Scanned tag payload"
        autoCapitalize="none"
        testID="scan-payload-input"
      />
      <View style={styles.buttonRow}>
        <Button title="Scan" onPress={handleScan} testID="scan-button" />
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
