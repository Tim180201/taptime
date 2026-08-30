const raster = Object.freeze({
  ground: '#0E1512',
  surface: '#141C19',
  surfaceRaised: '#1A2320',
  line: '#24302C',
  text: '#F2F5F4',
  textMuted: '#97A5A0',
  accent: '#7EE0C0',
  onAccent: '#0E1512',
  callToAction: '#C9F24D',
  notice: '#E0A44C',
  focus: '#7EE0C0',
});

export const mobileTokens = Object.freeze({
  color: Object.freeze({
    ...raster,
    canvas: raster.ground,
    surfaceMuted: raster.surfaceRaised,
    ink: raster.text,
    inkMuted: raster.textMuted,
    primary: raster.accent,
    primaryPressed: raster.callToAction,
    border: raster.line,
    success: raster.accent,
    warning: raster.notice,
    danger: raster.notice,
    transparent: 'transparent',
  }),
  radius: Object.freeze({ card: 12, control: 10, pill: 999 }),
  spacing: Object.freeze({ xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }),
  touchMinimum: 44,
});

export type MobileColorToken = keyof typeof mobileTokens.color;
