import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SignInResult } from '../auth/contracts';

interface LoginScreenProps {
  readonly signIn: (email: string, password: string) => Promise<SignInResult>;
  readonly disabled: boolean;
}

export function LoginScreen({ signIn, disabled }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn(): Promise<void> {
    if (submitInFlight.current || disabled) {
      return;
    }
    submitInFlight.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await signIn(email, password);
      if (result.status === 'invalid_credentials') {
        setMessage('E-Mail-Adresse oder Passwort ist nicht gültig.');
      } else if (result.status === 'authority_rejected') {
        setMessage('Für dieses Konto ist kein aktiver TapTim.e-Zugang verfügbar.');
      } else if (result.status === 'context_unavailable') {
        setMessage('Der Sitzungskontext ist vorübergehend nicht verfügbar.');
      } else if (result.status === 'infrastructure_error') {
        setMessage('Die Anmeldung ist derzeit nicht verfügbar.');
      }
    } catch {
      setMessage('Die Anmeldung ist derzeit nicht verfügbar.');
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTim.e — Anmeldung</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="E-Mail-Adresse"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        testID="email-input"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Passwort"
        autoCapitalize="none"
        autoComplete="current-password"
        secureTextEntry
        testID="password-input"
      />
      <Button
        title={submitting ? 'Anmeldung läuft …' : 'Anmelden'}
        onPress={handleSignIn}
        disabled={disabled || submitting}
        testID="sign-in-button"
      />
      {message !== null ? <Text style={styles.error}>{message}</Text> : null}
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
  error: {
    marginTop: 12,
    color: '#b00020',
  },
});
