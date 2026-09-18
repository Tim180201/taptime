import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ActionButton as Button, AppText as Text, TextField as TextInput } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

export function DemoLoginScreen({
  signIn,
}: {
  readonly signIn: (code: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="Demo sign-in code"
        autoCapitalize="none"
      />
      <Button title="Demo sign in" onPress={async () => setError(await signIn(code))} />
      {error === null ? null : <Text style={styles.error}>Demo sign-in rejected: {error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, padding: 20, backgroundColor: mobileTokens.color.ground },
  input: {},
  error: { color: mobileTokens.color.notice, marginTop: 12 },
});
