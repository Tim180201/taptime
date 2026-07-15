import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EmployeeEnrollmentResult, MobileSessionState } from '../auth/contracts';

export function EmployeeEnrollmentScreen({
  notice,
  redeem,
  signOut,
}: {
  readonly notice: Extract<MobileSessionState, { status: 'enrollment_only' }>['notice'];
  readonly redeem: (invitationSecret: string) => Promise<EmployeeEnrollmentResult>;
  readonly signOut: () => Promise<void>;
}) {
  const [invitationSecret, setInvitationSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef(false);

  async function submit(): Promise<void> {
    if (submission.current || invitationSecret.length === 0) return;
    submission.current = true;
    setSubmitting(true);
    const submittedSecret = invitationSecret;
    setInvitationSecret('');
    try {
      await redeem(submittedSecret);
    } finally {
      submission.current = false;
      setSubmitting(false);
    }
  }

  const message = notice === 'enrollment_unavailable'
    ? 'Diese Einladung ist nicht verfügbar. Bitte gib eine andere Einladung ein.'
    : notice === 'invalid_request'
      ? 'Das Einladungsgeheimnis hat kein gültiges Format.'
      : notice === 'request_failed'
        ? 'Die Einladung konnte vorübergehend nicht geprüft werden. Du kannst es erneut versuchen.'
        : null;
  return <View style={styles.container}>
    <Text style={styles.title}>Als Beschäftigter beitreten</Text>
    <Text style={styles.description}>
      Du bist sicher beim Anmeldedienst angemeldet, hast aber noch keinen TapTim.e-Zugang.
    </Text>
    <TextInput
      value={invitationSecret}
      onChangeText={setInvitationSecret}
      placeholder="Einladungsgeheimnis"
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry
      style={styles.input}
      testID="employee-invitation-input"
    />
    <Button
      title={submitting ? 'Einladung wird geprüft …' : 'Einladung sicher einlösen'}
      onPress={submit}
      disabled={submitting || invitationSecret.length === 0}
      testID="redeem-employee-invitation-button"
    />
    {message === null ? null : <Text style={styles.message}>{message}</Text>}
    <View style={styles.signOut}><Button title="Abmelden" onPress={signOut} /></View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  description: { marginBottom: 20, color: '#334' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 12 },
  message: { marginTop: 14, color: '#8a3b00' },
  signOut: { marginTop: 18 },
});
