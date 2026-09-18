import { View, type ViewStyle } from 'react-native';
import { mobileTokens } from './tokens';

export type IconName = 'employees' | 'capture' | 'manual' | 'times' | 'setup' | 'back' | 'check' | 'pending';

/** Small code-native line icons; text labels provide their accessible meaning. */
export function LineIcon({ name, size = 24, color = mobileTokens.color.textMuted }: {
  readonly name: IconName; readonly size?: number; readonly color?: string;
}) {
  const line = (style: ViewStyle, key: string) => <View key={key} style={[
    { position: 'absolute', borderColor: color, borderWidth: 1.6 }, style,
  ]} />;
  let parts;
  switch (name) {
    case 'employees': parts = <>{line({ width: 8, height: 8, borderRadius: 8, left: 8, top: 1 }, 'head')}
      {line({ width: 18, height: 10, borderTopLeftRadius: 12, borderTopRightRadius: 12, left: 3, top: 13 }, 'people')}</>; break;
    case 'capture':
      parts = <>{[18, 12, 6].map((width) => line({ width, height: width,
        left: (24 - width) / 2, top: 2 + (18 - width) / 2,
        borderRadius: width, borderBottomColor: mobileTokens.color.transparent,
        borderLeftColor: mobileTokens.color.transparent, borderRightColor: mobileTokens.color.transparent,
      }, String(width)))}{line({ width: 0, height: 13, top: 10, left: 11 }, 'stem')}</>;
      break;
    case 'manual': parts = <>{line({ width: 7, height: 18, left: 9, top: 2,
      transform: [{ rotate: '40deg' }], borderRadius: 2 }, 'pen')}</>; break;
    case 'times': parts = <>{line({ width: 19, height: 18, left: 2, top: 4, borderRadius: 3 }, 'calendar')}
      {line({ width: 17, height: 0, left: 3, top: 9 }, 'rule')}
      {[7, 15].map((left) => line({ width: 0, height: 5, left, top: 1 }, String(left)))}
      {line({ width: 3, height: 3, left: 7, top: 13, backgroundColor: color }, 'day')}</>; break;
    case 'setup': parts = <>{line({ width: 16, height: 12, top: 6, left: 4,
      borderRadius: 3, transform: [{ rotate: '-40deg' }] }, 'tag')}
      {line({ width: 3, height: 3, borderRadius: 3, left: 15, top: 7 }, 'hole')}</>; break;
    case 'back': parts = <>{line({ width: 10, height: 10, top: 7, left: 4,
      borderTopWidth: 0, borderRightWidth: 0, transform: [{ rotate: '45deg' }] }, 'head')}
      {line({ width: 17, height: 0, left: 4, top: 12 }, 'shaft')}</>; break;
    case 'check': parts = line({ width: 9, height: 16, left: 8, top: 2,
      borderTopWidth: 0, borderLeftWidth: 0, transform: [{ rotate: '45deg' }] }, 'check'); break;
    case 'pending': parts = <>{line({ width: 20, height: 20, borderRadius: 20, left: 2, top: 2 }, 'clock')}
      {line({ width: 0, height: 6, top: 6, left: 12 }, 'minute')}
      {line({ width: 5, height: 0, top: 12, left: 12 }, 'hour')}</>; break;
  }
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 24, height: 24, transform: [{ scale: size / 24 }] }}>{parts}</View>
  </View>;
}
