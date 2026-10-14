import { brandColor, brandGeometry } from './brandGeometry';

export function BrandMark({ size = 32, className }: { readonly size?: number; readonly className?: string }) {
  const geometry = brandGeometry(size);
  return <svg className={className} width={size} height={size} viewBox={geometry.viewBox}
    fill="none" aria-hidden="true" focusable="false">
    {geometry.paths.map(path => <path key={path.d} d={path.d} stroke={brandColor(path.color)}
      strokeWidth={path.width} opacity={path.opacity} strokeLinecap="round" strokeLinejoin="round" />)}
    <circle cx={geometry.dot.cx} cy={geometry.dot.cy} r={geometry.dot.r} fill={brandColor(geometry.dot.color)} />
  </svg>;
}
