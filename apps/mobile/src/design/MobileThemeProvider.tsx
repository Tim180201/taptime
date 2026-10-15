import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { mobileThemes, type ThemePreference } from './tokens';
import { MobileThemeContext } from './useMobileTheme';

const storageKey = 'taptime.theme';
export function MobileThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setChoice] = useState<ThemePreference>('automatic');
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let current = true;
    const initialRevision = revision.current;
    void SecureStore.getItemAsync(storageKey).then(value => {
      if (current && initialRevision === revision.current) setChoice(value === 'light' || value === 'dark' ? value : 'automatic');
    }).catch(() => {
      if (current && initialRevision === revision.current) setChoice('automatic');
    });
    return () => { current = false; };
  }, []);
  const setPreference = useCallback((next: ThemePreference) => {
    const choiceRevision = ++revision.current;
    setChoice(next);
    // Preserve the last choice even when SecureStore completes writes out of order.
    writes.current = writes.current.then(async () => {
      try {
        if (next === 'automatic') await SecureStore.deleteItemAsync(storageKey);
        else await SecureStore.setItemAsync(storageKey, next);
      } catch {
        if (choiceRevision === revision.current) setChoice('automatic');
      }
    });
  }, []);
  const theme = preference === 'automatic' ? system === 'dark' ? 'dark' : 'light' : preference;
  const value = useMemo(() => ({ theme, tokens: mobileThemes[theme], preference, setPreference }), [theme, preference, setPreference]);
  return <MobileThemeContext.Provider value={value}>{children}</MobileThemeContext.Provider>;
}
