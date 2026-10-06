import { OutcomeNotice } from '../design/OutcomeNotice';
import { useRequiredForm, RequiredTextField } from '../design/RequiredField';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { EmployeeEnrollmentResult, MobileSessionState } from '../auth/contracts';
import { ActionButton, AppText as Text, Screen } from '../design/primitives';
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
  const form = useRequiredForm();
  const [invitationSecret, setInvitationSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submission = useRef(false);

  async function submit(): Promise<void> {
    if (submission.current || !form.validate()) return;
    submission.current = true;
    setSubmitting(true);
    const submittedSecret = invitationSecret;
    try {
      const result=await redeem(submittedSecret);
      if(result.status==='enrolled')setInvitationSecret('');
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
        ? 'Die Einladung konnte gerade nicht geprüft werden. Versuche es erneut; deine Eingabe bleibt erhalten.'
        : null;
  return <Screen title="Als Beschäftigter beitreten"><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.description}>
      Du bist sicher beim Anmeldedienst angemeldet, hast aber noch keinen Taptura-Zugang.
    </Text>
    <Text>Einladungsgeheimnis</Text>
    <RequiredTextField form={form} error={!invitationSecret.trim() ? "Bitte Einladungsgeheimnis eingeben." : null}
      accessibilityLabel="Einladungsgeheimnis"
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
      disabled={submitting}
      loading={submitting}
      testID="redeem-employee-invitation-button"
    />
    <OutcomeNotice message={submitting ? null : message} error/>
    <View style={styles.signOut}><ActionButton title="Abmelden" tone="quiet" onPress={signOut} /></View>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 16,
    backgroundColor: mobileTokens.color.ground,
  },
  description: { color: mobileTokens.color.textMuted, fontSize: 13 },
  input: {},
  message: { marginTop: mobileTokens.spacing.sm, color: mobileTokens.color.notice },
  signOut: { marginTop: mobileTokens.spacing.md },
});
