import { createContext, useContext, useMemo } from 'react';
import { mobileThemes, type MobileTheme, type MobileTokens, type ThemePreference } from './tokens';

export interface MobileThemeValue {
  readonly theme: MobileTheme;
  readonly tokens: MobileTokens;
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
}
export const MobileThemeContext = createContext<MobileThemeValue>({
  theme: 'dark', tokens: mobileThemes.dark, preference: 'automatic', setPreference: () => {},
});
export function useMobileTheme() { return useContext(MobileThemeContext); }
export function useMobileTokens() { return useMobileTheme().tokens; }
export function useThemedStyles<T>(createStyles: (tokens: MobileTokens) => T): T {
  const tokens = useMobileTokens();
  return useMemo(() => createStyles(tokens), [createStyles, tokens]);
}
