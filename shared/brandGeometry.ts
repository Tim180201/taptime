import mark from './brand/mark.json';

export const brandColors = mark.colors;
export function brandGeometry(size: number) {
  return size < mark.useCompactBelowPx ? mark.compact : mark.full;
}
export function brandColor(color: string): string {
  return mark.colors[color as keyof typeof mark.colors];
}
