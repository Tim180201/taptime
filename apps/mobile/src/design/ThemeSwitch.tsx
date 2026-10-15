import { View } from 'react-native';
import { AppText, TouchTarget } from './primitives';
import { useMobileTheme } from './useMobileTheme';

export function ThemeSwitch() {
  const { tokens, preference, setPreference } = useMobileTheme();
  return <View accessibilityRole="radiogroup" accessibilityLabel="Erscheinungsbild" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
    {([['light', 'Hell'], ['dark', 'Dunkel'], ['automatic', 'Automatisch']] as const).map(([value, label]) =>
      <TouchTarget key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: preference === value }}
        onPress={() => setPreference(value)} style={{ justifyContent: 'center', paddingHorizontal: 12, borderRadius: tokens.radius.control,
          backgroundColor: preference === value ? tokens.color.surfaceRaised : tokens.color.transparent }}>
        <AppText style={{ color: preference === value ? tokens.color.accent : tokens.color.textMuted }}>{label}</AppText>
      </TouchTarget>)}
  </View>;
}
