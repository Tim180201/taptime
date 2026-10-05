import { useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, findNodeHandle, View, type TextInput, type TextInputProps } from 'react-native';
import { mobileTokens } from './tokens';
import { AppText, TextField } from './primitives';

type Entry = { error: string | null; focus: () => void; scope?: string };
export function useRequiredForm() {
  const entries = useRef(new Map<object, Entry>());
  const [submitted, setSubmitted] = useState(false);
  const [scope, setScope] = useState<string>();
  const [focusRequest, setFocusRequest] = useState<{ entry: Entry } | null>(null);
  useLayoutEffect(() => {
    if (!focusRequest) return;
    focusRequest.entry.focus();
    AccessibilityInfo.announceForAccessibility?.(focusRequest.entry.error!);
  }, [focusRequest]);
  return { entries: entries.current, submitted, scope, reset: () => { setSubmitted(false); setFocusRequest(null); }, validate: (only?: string) => {
    setSubmitted(true);
    setScope(only);
    const first = [...entries.current.values()].find(entry => entry.error && (!only || entry.scope === only));
    setFocusRequest(first ? { entry: first } : null);
    return !first;
  } };
}
type Form = ReturnType<typeof useRequiredForm>;
export function RequiredField({ form, error, focus, scope, children }: PropsWithChildren<{ form: Form; error: string | null; focus?: () => void; scope?: string }>) {
  const key = useRef({});
  const view = useRef<View>(null);
  useLayoutEffect(() => {
    form.entries.set(key.current, { error, scope, focus: focus ?? (() => {
      const node = findNodeHandle?.(view.current);
      if (node != null) AccessibilityInfo.setAccessibilityFocus?.(node);
      view.current?.focus?.();
    }) });
  }, [form.entries, error, focus, scope]);
  useLayoutEffect(() => () => { form.entries.delete(key.current); }, [form.entries]);
  const message = form.submitted && (!form.scope || form.scope === scope) ? error : null;
  return <View style={message ? { borderWidth: 1, borderColor: mobileTokens.color.error, borderRadius: 10, padding: 4, gap: 4 } : { gap: 4 }}>
    {children}
    {message ? <View ref={view} accessible={!focus} focusable={!focus} accessibilityLabel={message}>
      <AppText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: mobileTokens.color.error }}>{message}</AppText>
    </View> : null}
  </View>;
}
export function RequiredTextField({ form, error, scope, ...props }: TextInputProps & { form: Form; error: string | null; scope?: string }) {
  const input = useRef<TextInput>(null);
  const message = form.submitted && (!form.scope || form.scope === scope) ? error : null;
  return <RequiredField form={form} error={error} scope={scope} focus={() => input.current?.focus()}>
    <TextField {...props} ref={input} accessibilityHint={message ?? props.accessibilityHint} />
  </RequiredField>;
}
