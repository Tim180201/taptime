import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './primitives';
import { mobileTokens } from './tokens';

const minimumScale = 0.8;
const maximumFontMultiplier = 1.3;

export function TabLabel({ label, active }: { readonly label: string; readonly active: boolean }) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const fit = availableWidth > 0 && naturalWidth > 0
    ? Math.max(minimumScale, Math.min(1, availableWidth / naturalWidth)) : 1;

  return <View style={styles.container} testID={`tab-label-${label}`}
    onLayout={({ nativeEvent }) => setAvailableWidth(nativeEvent.layout.width)}>
    <AppText numberOfLines={1} adjustsFontSizeToFit={false} minimumFontScale={minimumScale}
      maxFontSizeMultiplier={maximumFontMultiplier}
      style={[styles.label, active && styles.active, {
        fontSize: styles.label.fontSize * fit, lineHeight: styles.label.lineHeight * fit,
      }]}>{label}</AppText>
    {/* Fabric does not enforce minimumFontScale. Measure the unshrunk text and
        apply the bounded factor ourselves on both native platforms. */}
    <View style={styles.measurement} pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <AppText testID={`tab-measure-${label}`} maxFontSizeMultiplier={maximumFontMultiplier}
        style={[styles.label, { width: styles.label.fontSize * maximumFontMultiplier * Array.from(label).length }]}
        onTextLayout={({ nativeEvent }) => setNaturalWidth(Math.max(0, ...nativeEvent.lines.map(line => line.width)))}>
        {label}
      </AppText>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch', minWidth: 0, overflow: 'hidden' },
  label: { color: mobileTokens.color.textMuted, fontSize: 11, lineHeight: 16,
    fontWeight: '600', alignSelf: 'stretch', textAlign: 'center' },
  active: { color: mobileTokens.color.accent },
  measurement: { position: 'absolute', left: 0, top: 0, opacity: 0 },
});
