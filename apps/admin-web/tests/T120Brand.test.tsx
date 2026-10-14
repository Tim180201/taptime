import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import mark from '../../../shared/brand/mark.json';

it.each([28, 47, 48, 96])('T120 web mark at %s px uses the source geometry and is decorative', async size => {
  const { BrandMark } = await import('../../../shared/BrandMark');
  const html = renderToStaticMarkup(createElement(BrandMark, { size }));
  const source = size < mark.useCompactBelowPx ? mark.compact : mark.full;
  expect([...html.matchAll(/ d="([^"]+)"/g)].map(match => match[1])).toEqual(source.paths.map(path => path.d));
  expect(html).toContain('aria-hidden="true"'); expect(html).toContain('focusable="false"');
  for (const color of [mark.colors.mint, mark.colors.lime]) expect(html).toContain(color);
  expect(html).toContain(`<circle cx="${source.dot.cx}" cy="${source.dot.cy}" r="${source.dot.r}"`);
});
