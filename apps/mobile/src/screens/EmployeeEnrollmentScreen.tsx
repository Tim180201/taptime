import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { EmployeeEnrollmentResult, MobileSessionState } from '../auth/contracts';
import { ActionButton, AppText as Text, TextField } from '../design/primitives';
import { mobileTokens } from '../design/tokens';

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
    <TextField
      value={invitationSecret}
      onChangeText={setInvitationSecret}
      placeholder="Einladungsgeheimnis"
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry
      style={styles.input}
      testID="employee-invitation-input"
    />
    <ActionButton
      title={submitting ? 'Einladung wird geprüft …' : 'Einladung sicher einlösen'}
      onPress={submit}
      disabled={submitting || invitationSecret.length === 0}
      loading={submitting}
      testID="redeem-employee-invitation-button"
    />
    {message === null ? null : <Text style={styles.message}>{message}</Text>}
    <View style={styles.signOut}><ActionButton title="Abmelden" tone="quiet" onPress={signOut} /></View>
  </View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: mobileTokens.spacing.sm,
    paddingTop: 64,
    paddingHorizontal: mobileTokens.spacing.md,
    backgroundColor: mobileTokens.color.ground,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: mobileTokens.spacing.sm },
  description: { marginBottom: mobileTokens.spacing.md, color: mobileTokens.color.textMuted },
  input: { marginBottom: mobileTokens.spacing.xs },
  message: { marginTop: mobileTokens.spacing.sm, color: mobileTokens.color.notice },
  signOut: { marginTop: mobileTokens.spacing.md },
});
