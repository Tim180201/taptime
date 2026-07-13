import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

export function DemoLoginScreen({
  signIn,
}: {
  readonly signIn: (code: string) => Promise<string | null>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="Demo sign-in code"
        autoCapitalize="none"
      />
      <Button title="Demo sign in" onPress={async () => setError(await signIn(code))} />
      {error === null ? null : <Text style={styles.error}>Demo sign-in rejected: {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 12 },
  error: { color: '#b00020', marginTop: 12 },
});
