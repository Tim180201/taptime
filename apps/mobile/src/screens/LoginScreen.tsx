import { APP_NAME } from '../../../../shared/product';
import { OutcomeNotice } from '../design/OutcomeNotice';
import { useRequiredForm, RequiredTextField } from '../design/RequiredField';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { SignInResult } from '../auth/contracts';
import { AppBuildIdentity } from '../design/AppBuildIdentity';
import { ActionButton, AppText as Text, Screen } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

interface LoginScreenProps {
  readonly unavailable?: boolean;
  readonly signIn: (email: string, password: string) => Promise<SignInResult>;
  readonly signInForEmployeeEnrollment: (email: string, password: string) => Promise<SignInResult>;
  readonly disabled: boolean;
  readonly requestPasswordReset: (email: string) => Promise<'requested' | 'unavailable'>;
}

export function LoginScreen({ signIn, signInForEmployeeEnrollment, requestPasswordReset, disabled, unavailable = false }: LoginScreenProps) {
  const form = useRequiredForm();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitInFlight = useRef(false);
  const [messageIsError,setMessageIsError]=useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignIn(employeeEnrollmentIntent = false): Promise<void> {
    if (submitInFlight.current || disabled || !form.validate()) {
      return;
    }
    submitInFlight.current = true;
    setSubmitting(true);
    setMessage(null);
    setMessageIsError(true);
    try {
      const result = await (employeeEnrollmentIntent
        ? signInForEmployeeEnrollment(email, password)
        : signIn(email, password));
      if (result.status === 'invalid_credentials') {
        setMessage('E-Mail-Adresse oder Passwort ist nicht gültig.');
      } else if (result.status === 'authority_rejected') {
        setMessage('Dein Konto hat derzeit keinen aktiven Zugang zu diesem Betrieb.');
      } else if (result.status === 'context_unavailable') {
        setMessage('Dein Zugang konnte gerade nicht geladen werden. Versuche es erneut.');
      } else if (result.status === 'infrastructure_error') {
        setMessage('Anmeldung gerade nicht möglich. Prüfe die Verbindung und versuche es erneut.');
      }
    } catch {
      setMessage('Anmeldung gerade nicht möglich. Prüfe die Verbindung und versuche es erneut.');
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  }

  async function handlePasswordReset(): Promise<void> {
    if (submitInFlight.current || disabled || !form.validate("email")) return;
    submitInFlight.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await requestPasswordReset(email);
      setMessageIsError(result !== 'requested');
      setMessage(result === 'requested'
        ? 'Wir haben dir eine E-Mail geschickt. Öffne den Link und setze dein neues Passwort auf der Webseite. Melde dich dann hier an.'
        : 'Wiederherstellung ist derzeit nicht erreichbar.');
    } catch {setMessageIsError(true);setMessage('Wiederherstellung ist derzeit nicht erreichbar.');}
    finally {submitInFlight.current=false;setSubmitting(false);}
  }

  return (
    <Screen title={`${APP_NAME} — Anmeldung`}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {unavailable ? <><Text>Anmeldung gerade nicht möglich. Prüfe die Verbindung und versuche es erneut.</Text>
        <Text style={{fontSize: 12}}>Code S5</Text></> : null}
      <Text>E-Mail-Adresse</Text>
      <RequiredTextField form={form} scope="email" error={email.trim().length < 3 ? "Bitte E-Mail-Adresse eingeben." : null}
        accessibilityLabel="E-Mail-Adresse"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="E-Mail-Adresse"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        testID="email-input"
      />
      <Text>Passwort</Text>
      <RequiredTextField form={form} error={!password ? "Bitte Passwort eingeben." : null}
        accessibilityLabel="Passwort"
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
        <Text>Einladung erhalten? Öffne zuerst den Link aus deiner E-Mail und lege dort dein Passwort fest. Melde dich danach hier an.</Text>
        <ActionButton
          title="Mit Einladung beitreten"
          tone="secondary"
          onPress={() => handleSignIn(true)}
          disabled={disabled || submitting}
          testID="employee-enrollment-sign-in-button"
        />
      </View>
      <ActionButton title="Passwort vergessen" tone="quiet" onPress={handlePasswordReset}
        disabled={disabled || submitting}
        testID="password-reset-button" />
      <OutcomeNotice message={message} error={messageIsError}/>
      <AppBuildIdentity style={styles.buildIdentity} />
    </ScrollView></Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 16,
    backgroundColor: mobileTokens.color.ground,
  },
  input: {
    marginBottom: 0,
  },
  error: {
    marginTop: mobileTokens.spacing.sm,
    color: mobileTokens.color.notice,
  },
  enrollmentAction: {},
  buildIdentity: { marginTop: 'auto', paddingVertical: mobileTokens.spacing.lg },
});
