const dark = Object.freeze({
  ground: '#0E1512', surface: '#141C19', surfaceRaised: '#1A2320', line: '#24302C',
  text: '#F2F5F4', textMuted: '#97A5A0', accent: '#7EE0C0', onAccent: '#0E1512',
  action: '#C9F24D', onAction: '#0E1512', running: '#C9F24D', onRunning: '#0E1512',
  notice: '#E0A44C', error: '#FF8F8F',
});
type Palette = { readonly [K in keyof typeof dark]: string };
const light: Palette = Object.freeze({
  ground: '#F3F7F5', surface: '#FFFFFF', surfaceRaised: '#EAF1ED', line: '#D6E1DB',
  text: '#101916', textMuted: '#5B6B64', accent: '#156F55', onAccent: '#FFFFFF',
  action: '#156F55', onAction: '#FFFFFF', running: '#9CC21A', onRunning: '#0E1512',
  notice: '#875506', error: '#AE3626',
});

function tokens(raster: Palette, scanDisc: string) {
  return Object.freeze({
    color: Object.freeze({
      ...raster,
      canvas: raster.ground, surfaceMuted: raster.surfaceRaised, ink: raster.text, inkMuted: raster.textMuted,
      primary: raster.accent, primaryPressed: raster.action, callToAction: raster.action, focus: raster.accent,
      border: raster.line, success: raster.accent, warning: raster.notice, danger: raster.notice,
      transparent: 'transparent',
      // The capture disc and its feedback keep their luminous colors in both themes.
      scanDisc, scanAccent: dark.accent, scanNotice: dark.notice, scanOnResult: dark.onAccent,
    }),
    radius: Object.freeze({ card: 12, control: 10, pill: 999 }),
    spacing: Object.freeze({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }),
    touchMinimum: 44,
    font: Object.freeze({ regular: 'Manrope_400Regular', semibold: 'Manrope_600SemiBold', bold: 'Manrope_800ExtraBold' }),
  });
}
export const mobileThemes = Object.freeze({ dark: tokens(dark, dark.surface), light: tokens(light, dark.ground) });
// Static dark palette for launch-screen colors and compatibility with raster tests.
export const mobileTokens = mobileThemes.dark;
export const mobileFont = mobileTokens.font;
export type MobileTokens = typeof mobileTokens;
export type MobileColorToken = keyof MobileTokens['color'];
export type MobileTheme = keyof typeof mobileThemes;
export type ThemePreference = MobileTheme | 'automatic';
