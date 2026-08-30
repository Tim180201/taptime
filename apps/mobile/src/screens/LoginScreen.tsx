import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SignInResult } from '../auth/contracts';
import { AppBuildIdentity } from '../design/AppBuildIdentity';
import { ActionButton, AppText as Text, TextField } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

interface LoginScreenProps {
  readonly signIn: (email: string, password: string) => Promise<SignInResult>;
  readonly signInForEmployeeEnrollment: (email: string, password: string) => Promise<SignInResult>;
  readonly disabled: boolean;
  readonly requestPasswordReset: (email: string) => Promise<'requested' | 'unavailable'>;
}

export function LoginScreen({ signIn, signInForEmployeeEnrollment, requestPasswordReset, disabled }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn(employeeEnrollmentIntent = false): Promise<void> {
    if (submitInFlight.current || disabled) {
      return;
    }
    submitInFlight.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await (employeeEnrollmentIntent
        ? signInForEmployeeEnrollment(email, password)
        : signIn(email, password));
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

  async function handlePasswordReset(): Promise<void> {
    if (submitInFlight.current || disabled || email.trim().length < 3) return;
    submitInFlight.current = true;
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setMessage(result === 'requested'
      ? 'Falls das Konto existiert, wurde eine Wiederherstellungs-E-Mail versendet.'
      : 'Wiederherstellung ist derzeit nicht erreichbar.');
    submitInFlight.current = false;
    setSubmitting(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTim.e — Anmeldung</Text>
      <TextField
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="E-Mail-Adresse"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        testID="email-input"
      />
      <TextField
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Passwort"
        autoCapitalize="none"
        autoComplete="current-password"
        secureTextEntry
        testID="password-input"
      />
      <ActionButton
        title={submitting ? 'Anmeldung läuft …' : 'Anmelden'}
        onPress={() => handleSignIn(false)}
        disabled={disabled || submitting}
        loading={submitting}
        testID="sign-in-button"
      />
      <View style={styles.enrollmentAction}>
        <ActionButton
          title="Mit Einladung beitreten"
          tone="secondary"
          onPress={() => handleSignIn(true)}
          disabled={disabled || submitting}
          testID="employee-enrollment-sign-in-button"
        />
      </View>
      <ActionButton title="Passwort vergessen" tone="quiet" onPress={handlePasswordReset}
        disabled={disabled || submitting || email.trim().length < 3}
        testID="password-reset-button" />
      {message !== null ? <Text style={styles.error}>{message}</Text> : null}
      <AppBuildIdentity style={styles.buildIdentity} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
    paddingHorizontal: mobileTokens.spacing.md,
    backgroundColor: mobileTokens.color.ground,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: mobileTokens.spacing.sm,
  },
  input: {
    marginBottom: mobileTokens.spacing.sm,
  },
  error: {
    marginTop: mobileTokens.spacing.sm,
    color: mobileTokens.color.notice,
  },
  enrollmentAction: { marginTop: mobileTokens.spacing.sm },
  buildIdentity: { marginTop: 'auto', paddingVertical: mobileTokens.spacing.lg },
});
