import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '../design/primitives';
import { mobileTokens } from '../design/tokens';
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
    <SafeAreaView style={styles.container}>
      <Text style={styles.banner}>DEMO MODE — KEINE PRODUKTIVE AUTHENTIFIZIERUNG</Text>
      {caller === null ? <DemoLoginScreen signIn={signIn} /> : <DemoScanScreen caller={caller} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: mobileTokens.color.ground },
  banner: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: mobileTokens.color.surface,
    color: mobileTokens.color.notice,
    fontWeight: '800',
    textAlign: 'center',
  },
});
