import Constants from 'expo-constants';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { presentBuildIdentity } from '../runtime/buildIdentity';
import { mobileTokens } from './tokens';

export function AppBuildIdentity({ style }: { readonly style?: StyleProp<TextStyle> }) {
  const extra = Constants.expoConfig?.extra;
  const build = isRecord(extra) && isRecord(extra.taptimeBuild)
    ? extra.taptimeBuild
    : null;
  const presentation = presentBuildIdentity(build?.sourceCommit);
  return <Text
    accessibilityLabel={presentation.accessibilityLabel}
    style={[styles.text, style]}
    testID="app-build-identity"
  >
    {presentation.text}
  </Text>;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

const styles = StyleSheet.create({
  text: {
    color: mobileTokens.color.inkMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
