import { useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { mobileTokens } from './tokens';
import { resolveControlVisualState } from './controlState';

export function AppText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.bodyText, style]} />;
}

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
  loading = false,
  ...props
}: PressableProps & {
  readonly title: string;
  readonly tone?: 'primary' | 'secondary' | 'quiet';
  readonly loading?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const disabled = Boolean(props.disabled || loading);
  return <Pressable
    {...props}
    accessibilityRole={props.accessibilityRole ?? 'button'}
    accessibilityState={{
      ...props.accessibilityState,
      busy: loading,
      disabled,
    }}
    disabled={disabled}
    focusable={props.focusable ?? !disabled}
    onBlur={(event) => {
      setFocused(false);
      props.onBlur?.(event);
    }}
    onFocus={(event) => {
      setFocused(true);
      props.onFocus?.(event);
    }}
    onHoverIn={(event) => {
      setHovered(true);
      props.onHoverIn?.(event);
    }}
    onHoverOut={(event) => {
      setHovered(false);
      props.onHoverOut?.(event);
    }}
    style={({ pressed }) => {
      const visualState = resolveControlVisualState({
        hovered,
        focused,
        pressed,
        disabled,
        loading,
      });
      return [
        styles.action,
        tone === 'primary' ? styles.primary : tone === 'secondary'
          ? styles.secondary : styles.quiet,
        styles[visualState],
        typeof props.style === 'function' ? props.style({ pressed }) : props.style,
      ];
    }}
  >
    {loading
      ? <ActivityIndicator color={tone === 'primary'
          ? mobileTokens.color.onAccent : mobileTokens.color.accent} />
      : <Text style={tone === 'primary' ? styles.primaryLabel : styles.secondaryLabel}>
          {title}
        </Text>}
  </Pressable>;
}

export function TextField({ style, editable = true, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return <TextInput
    {...props}
    editable={editable}
    placeholderTextColor={props.placeholderTextColor ?? mobileTokens.color.textMuted}
    selectionColor={props.selectionColor ?? mobileTokens.color.accent}
    onBlur={(event) => {
      setFocused(false);
      props.onBlur?.(event);
    }}
    onFocus={(event) => {
      setFocused(true);
      props.onFocus?.(event);
    }}
    style={[
      styles.textField,
      focused && styles.fieldFocused,
      !editable && styles.disabled,
      style,
    ]}
  />;
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
  bodyText: {
    color: mobileTokens.color.text,
    fontSize: 16,
    lineHeight: 24,
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
    borderColor: mobileTokens.color.transparent,
    borderWidth: 1,
  },
  primary: { backgroundColor: mobileTokens.color.accent },
  secondary: {
    backgroundColor: mobileTokens.color.surfaceRaised,
    borderColor: mobileTokens.color.textMuted,
  },
  quiet: { backgroundColor: mobileTokens.color.transparent },
  idle: {},
  hovered: { borderColor: mobileTokens.color.callToAction },
  focused: {
    outlineColor: mobileTokens.color.focus,
    outlineOffset: 0,
    outlineStyle: 'solid',
    outlineWidth: 3,
  },
  pressed: {
    borderColor: mobileTokens.color.callToAction,
    transform: [{ scale: 0.98 }],
  },
  disabled: { opacity: 0.48 },
  loading: { opacity: 0.8 },
  primaryLabel: { color: mobileTokens.color.onAccent, fontSize: 16, fontWeight: '700' },
  secondaryLabel: { color: mobileTokens.color.ink, fontSize: 16, fontWeight: '700' },
  textField: {
    minHeight: mobileTokens.touchMinimum,
    backgroundColor: mobileTokens.color.surfaceRaised,
    borderColor: mobileTokens.color.textMuted,
    borderWidth: 1,
    borderRadius: mobileTokens.radius.control,
    color: mobileTokens.color.text,
    fontSize: 16,
    paddingHorizontal: mobileTokens.spacing.md,
  },
  fieldFocused: {
    outlineColor: mobileTokens.color.focus,
    outlineOffset: 0,
    outlineStyle: 'solid',
    outlineWidth: 3,
  },
});
