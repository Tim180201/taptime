import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import mark from '../../../../shared/brand/mark.json';

vi.mock('react-native-svg', () => ({
  default: ({ children, accessible, accessibilityElementsHidden, importantForAccessibility, ...props }: any) => createElement('svg', { ...props, 'aria-hidden': accessibilityElementsHidden, 'data-accessible': accessible, 'data-importance': importantForAccessibility }, children),
  Path: (props: any) => createElement('path', props),
  Circle: (props: any) => createElement('circle', props),
}));

it.each([28, 47, 48, 96])('T120 native mark at %s px renders only the source geometry and is decorative', async size => {
  const { BrandMark } = await import('../../src/design/BrandMark');
  const html = renderToStaticMarkup(createElement(BrandMark, { size }));
  const source = size < mark.useCompactBelowPx ? mark.compact : mark.full;
  expect([...html.matchAll(/ d="([^"]+)"/g)].map(match => match[1])).toEqual(source.paths.map(path => path.d));
  expect(html).toContain(`viewBox="${source.viewBox}"`);
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('data-accessible="false"');
  expect(html).toContain('data-importance="no-hide-descendants"');
  for (const color of [mark.colors.mint, mark.colors.lime]) expect(html).toContain(color);
  expect(html).toContain(`<circle cx="${source.dot.cx}" cy="${source.dot.cy}" r="${source.dot.r}"`);
});
