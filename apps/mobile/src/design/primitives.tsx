import { createContext, useContext, useState, type PropsWithChildren } from 'react';
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
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { mobileTokens } from './tokens';
import { resolveControlVisualState } from './controlState';

export const FontReadyContext = createContext(false);
export const EmbeddedScreenContext = createContext(false);

export function manropeStyle(weight: TextStyle['fontWeight']): TextStyle {
  const value = weight === 'bold' ? 800 : Number(weight ?? 400);
  return { fontFamily: value >= 700 ? mobileTokens.font.bold
    : value >= 500 ? mobileTokens.font.semibold : mobileTokens.font.regular, fontWeight: 'normal' };
}

export function AppText({ style, ...props }: TextProps) {
  const loaded = useContext(FontReadyContext);
  return <Text {...props} style={[styles.bodyText, style,
    loaded && manropeStyle(StyleSheet.flatten(style)?.fontWeight)]} />;
}

export function Screen({
  title,
  eyebrow,
  children,
}: PropsWithChildren<{ readonly title: string; readonly eyebrow?: string }>) {
  const embedded = useContext(EmbeddedScreenContext);
  return <View style={[styles.screen, embedded && { paddingTop: 8 }]}>
    {embedded ? null : <View style={styles.heading}>
      {eyebrow ? <AppText style={styles.eyebrow}>{eyebrow}</AppText> : null}
      <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
    </View>}
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

export function TouchTarget({ style, ...props }: PressableProps) {
  const [focused, setFocused] = useState(false);
  return <Pressable {...props}
    onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
    style={(state) => [typeof style === 'function' ? style(state) : style,
      focused && styles.focused, state.pressed && { opacity: 0.75 }]} />;
}

export function ActionButton({
  title,
  tone = 'primary',
  loading = false,
  ...props
}: PressableProps & {
  readonly title: string;
  readonly tone?: 'primary' | 'secondary' | 'quiet' | 'cta';
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
        tone === 'cta' ? styles.cta : tone === 'primary' ? styles.primary : tone === 'secondary'
          ? styles.secondary : styles.quiet,
        styles[visualState],
        typeof props.style === 'function' ? props.style({ pressed }) : props.style,
      ];
    }}
  >
    {loading
      ? <ActivityIndicator color={tone === 'primary' || tone === 'cta'
          ? mobileTokens.color.onAccent : mobileTokens.color.accent} />
      : <AppText style={tone === 'primary' || tone === 'cta' ? styles.primaryLabel : styles.secondaryLabel}>
          {title}
        </AppText>}
  </Pressable>;
}

export function TextField({ style, editable = true, ...props }: TextInputProps) {
  const loaded = useContext(FontReadyContext);
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
      loaded && manropeStyle(StyleSheet.flatten(style)?.fontWeight),
    ]}
  />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: mobileTokens.color.canvas,
    paddingHorizontal: 20,
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
    fontSize: 22,
    lineHeight: 28,
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
  cta: { backgroundColor: mobileTokens.color.callToAction },
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
