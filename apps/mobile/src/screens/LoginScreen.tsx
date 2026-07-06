import { useMemo, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { SessionService, toCallerContext, FakeAuthenticationGateway, type CallerContext } from '@taptime/core';

interface LoginScreenProps {
  onSignedIn: (caller: CallerContext) => void;
}

// DT-014: minimal credential input + "Sign in" action calling the existing SessionService
// (DT-013), unmodified. Introduces no business/authentication logic of its own - it only
// calls SessionService.signIn() and toCallerContext(), then passes the result through
// (ADR-0007 Platform Boundaries). No password flow: Credentials is a single opaque
// signInCode, unchanged from Sprint 007.
export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [signInCode, setSignInCode] = useState('');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const sessionService = useMemo(() => new SessionService(new FakeAuthenticationGateway()), []);

  function handleSignIn(): void {
    const result = sessionService.signIn({ signInCode });

    if (result.status === 'authenticated') {
      setRejectionReason(null);
      onSignedIn(toCallerContext(result));
      return;
    }

    setRejectionReason(result.reason);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapTim.e — Sign in</Text>
      <TextInput
        style={styles.input}
        value={signInCode}
        onChangeText={setSignInCode}
        placeholder="Sign-in code"
        autoCapitalize="none"
        testID="sign-in-code-input"
      />
      <Button title="Sign in" onPress={handleSignIn} testID="sign-in-button" />
      {rejectionReason !== null ? (
        <Text style={styles.error} testID="sign-in-error">
          Sign-in rejected: {rejectionReason}
        </Text>
      ) : null}
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
