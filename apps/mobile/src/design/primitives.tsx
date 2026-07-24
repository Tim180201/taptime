import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { mobileTokens } from './tokens';

export function Screen({
  title,
  eyebrow,
  children,
}: PropsWithChildren<{ readonly title: string; readonly eyebrow?: string }>) {
  return <View style={styles.screen}>
    <View style={styles.heading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    </View>
    {children}
  </View>;
}

export function Card({
  children,
  style,
  accessibilityLabel,
}: PropsWithChildren<{
  readonly style?: ViewStyle;
  readonly accessibilityLabel?: string;
}>) {
  return <View style={[styles.card, style]} accessibilityLabel={accessibilityLabel}>
    {children}
  </View>;
}

export function ActionButton({
  title,
  tone = 'primary',
  ...props
}: PressableProps & {
  readonly title: string;
  readonly tone?: 'primary' | 'secondary' | 'quiet';
}) {
  return <Pressable
    accessibilityRole="button"
    {...props}
    style={({ pressed }) => [
      styles.action,
      tone === 'primary' ? styles.primary : tone === 'secondary'
        ? styles.secondary : styles.quiet,
      pressed && styles.pressed,
      props.disabled && styles.disabled,
    ]}
  >
    <Text style={tone === 'primary' ? styles.primaryLabel : styles.secondaryLabel}>
      {title}
    </Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mobileTokens.color.canvas,
    paddingHorizontal: mobileTokens.spacing.md,
    paddingTop: 56,
    gap: mobileTokens.spacing.md,
  },
  heading: { gap: mobileTokens.spacing.xs },
  eyebrow: {
    color: mobileTokens.color.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: mobileTokens.color.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  card: {
    backgroundColor: mobileTokens.color.surface,
    borderColor: mobileTokens.color.border,
    borderWidth: 1,
    borderRadius: mobileTokens.radius.card,
    padding: mobileTokens.spacing.md,
    gap: mobileTokens.spacing.sm,
  },
  action: {
    minHeight: mobileTokens.touchMinimum,
    borderRadius: mobileTokens.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: mobileTokens.spacing.md,
  },
  primary: { backgroundColor: mobileTokens.color.primary },
  secondary: {
    backgroundColor: mobileTokens.color.surface,
    borderColor: mobileTokens.color.border,
    borderWidth: 1,
  },
  quiet: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  primaryLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryLabel: { color: mobileTokens.color.ink, fontSize: 16, fontWeight: '700' },
});
