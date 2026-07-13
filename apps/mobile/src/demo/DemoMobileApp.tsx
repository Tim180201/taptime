import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  FakeAuthenticationGateway,
  SessionService,
  toCallerContext,
  type CallerContext,
} from '@taptime/core';
import { DemoLoginScreen } from './DemoLoginScreen';
import { DemoScanScreen } from './DemoScanScreen';

/** Explicit development-only preservation of the pre-C1 fake/demo flow. */
export function DemoMobileApp() {
  const [caller, setCaller] = useState<CallerContext | null>(null);
  const sessionService = useMemo(() => new SessionService(new FakeAuthenticationGateway()), []);

  async function signIn(signInCode: string): Promise<string | null> {
    const result = await sessionService.signIn({ signInCode });
    if (result.status === 'authenticated') {
      setCaller(toCallerContext(result));
      return null;
    }
    return result.reason;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.banner}>DEMO MODE — KEINE PRODUKTIVE AUTHENTIFIZIERUNG</Text>
      {caller === null ? <DemoLoginScreen signIn={signIn} /> : <DemoScanScreen caller={caller} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    paddingTop: 48,
    paddingBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: '#8b0000',
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
});
