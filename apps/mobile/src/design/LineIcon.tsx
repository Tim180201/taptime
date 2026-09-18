/**
 * Lucide 0.577.0 SVG outlines (ISC; Feather-derived portions MIT).
 * https://github.com/lucide-icons/lucide/tree/0.577.0/icons
 * Copyright Lucide Contributors 2026; Cole Bemis 2013–2026 (Feather).
 * Full notices: ./LUCIDE-LICENSE. Circles/rects converted to equivalent paths;
 * stroke width adapted to the Taptura 1.75 px raster. Labels live at call sites.
 */
import Svg, { Path } from 'react-native-svg';
import { mobileTokens } from './tokens';

const paths = {
  capture: ['M6 8.32a7.43 7.43 0 0 1 0 7.36', 'M9.46 6.21a11.76 11.76 0 0 1 0 11.58', 'M12.91 4.1a15.91 15.91 0 0 1 .01 15.8', 'M16.37 2a20.16 20.16 0 0 1 0 20'], // nfc
  manual: ['M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z', 'm15 5 4 4'], // pencil
  times: ['M8 2v4', 'M16 2v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z', 'M3 10h18', 'M8 14h.01', 'M12 14h.01', 'M16 14h.01', 'M8 18h.01', 'M12 18h.01', 'M16 18h.01'], // calendar-days
  employees: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M16 3.128a4 4 0 0 1 0 7.744', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0'], // users
  setup: ['M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z', 'M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193', 'M10 6.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0'], // tags
  back: ['m12 19-7-7 7-7', 'M19 12H5'], // arrow-left
  check: ['M20 6 9 17l-5-5'], // check
  pending: ['M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0', 'M12 6v6l4 2'], // clock
  person: ['M7 8a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M20 21a8 8 0 0 0-16 0'], // user-round
  arrow: ['M5 12h14', 'm12 5 7 7-7 7'], // arrow-right
} as const;
export type IconName = keyof typeof paths;

export function LineIcon({ name, size = 24, color = mobileTokens.color.textMuted }: {
  readonly name: IconName; readonly size?: number; readonly color?: string;
}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    color={color} stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" accessible={false}
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {paths[name].map((d) => <Path key={d} d={d} />)}
  </Svg>;
}
