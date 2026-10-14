import Svg, { Circle, Path } from 'react-native-svg';
import { brandColor, brandGeometry } from '../../../../shared/brandGeometry';

export function BrandMark({ size = 32 }: { readonly size?: number }) {
  const geometry = brandGeometry(size);
  return <Svg width={size} height={size} viewBox={geometry.viewBox} fill="none"
    accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {geometry.paths.map(path => <Path key={path.d} d={path.d} stroke={brandColor(path.color)}
      strokeWidth={path.width} opacity={path.opacity} strokeLinecap="round" strokeLinejoin="round" />)}
    <Circle cx={geometry.dot.cx} cy={geometry.dot.cy} r={geometry.dot.r} fill={brandColor(geometry.dot.color)} />
  </Svg>;
}
