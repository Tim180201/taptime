// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { renderContact } from '../src/contact';

test('empty address leaves an honest placeholder and no request button', () => {
  const box = document.createElement('div');
  renderContact(box, '');
  expect(box.textContent).toBe('E-Mail-Adresse folgt');
  expect(box.querySelector('a')).toBeNull();
});
test('configured address is text and a mailto link, with the approved purpose sentence', () => {
  const box = document.createElement('div');
  renderContact(box, 'pilot@example.invalid');
  expect(box.querySelector('a')?.getAttribute('href')).toBe('mailto:pilot@example.invalid');
  expect(box.textContent).toContain('Wir verwenden Ihre Angaben nur, um Ihre Anfrage zu beantworten.');
  renderContact(box, '');
  expect(box.querySelector('a')).toBeNull();
});
