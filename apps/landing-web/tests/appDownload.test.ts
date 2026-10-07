// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renderAppDownload } from '../src/appDownload';

const targets = { ios: 'https://testflight.apple.com/join/Synthetic', android: 'https://play.google.com/apps/testing/com.example.synthetic' };
afterEach(() => window.history.replaceState(null, '', '/'));
function render(userAgent: string, links = targets, platform = '', maxTouchPoints = 0) {
  const root = document.createElement('div');
  const redirect = vi.fn();
  renderAppDownload(root, links, { userAgent, platform, maxTouchPoints }, redirect);
  return { root, redirect };
}
it.each(['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'])('opens the configured iOS destination for %s', userAgent => {
  expect(render(userAgent).redirect).toHaveBeenCalledExactlyOnceWith(targets.ios);
});
it('recognizes iPadOS desktop identification without mistaking a Mac for an iPad', () => {
  expect(render('Mozilla/5.0 (Macintosh; Intel Mac OS X)', targets, 'MacIntel', 5).redirect).toHaveBeenCalledWith(targets.ios);
  expect(render('Mozilla/5.0 (Macintosh; Intel Mac OS X)', targets, 'MacIntel', 0).redirect).not.toHaveBeenCalled();
});
it('opens the configured Android destination', () => {
  expect(render('Mozilla/5.0 (Linux; Android 15)').redirect).toHaveBeenCalledExactlyOnceWith(targets.android);
});
it('offers both stores on desktop', () => {
  const { root, redirect } = render('Mozilla/5.0 (Windows NT 10.0)');
  expect(redirect).not.toHaveBeenCalled();
  expect([...root.querySelectorAll('a')].map(a => [a.textContent, a.href])).toEqual([
    ['App Store', targets.ios], ['Google Play', targets.android],
  ]);
});
it.each(['iPhone', 'Android', 'Windows'])('keeps an empty destination honest: %s', agent => {
  const { root, redirect } = render(agent, { ios: '', android: '' });
  expect(redirect).not.toHaveBeenCalled();
  expect(root.textContent).toContain('Die App erhalten Sie von Ihrer Verwaltung.');
  expect(root.querySelector('a')).toBeNull();
});
it('never redirects an iPhone to the Android fallback when its own destination is empty', () => {
  const { root, redirect } = render('iPhone', { ...targets, ios: '' });
  expect(redirect).not.toHaveBeenCalled();
  expect(root.textContent).toContain('Die App erhalten Sie von Ihrer Verwaltung.');
});
it('ignores redirect parameters and fragments supplied by the visitor', () => {
  window.history.replaceState(null, '', '/app?ios=https://foreign.invalid&redirect=https://foreign.invalid#https://foreign.invalid');
  const { root, redirect } = render('iPhone');
  expect(redirect).toHaveBeenCalledExactlyOnceWith(targets.ios);
  expect(root.innerHTML).not.toContain('foreign.invalid');
});
it.each(['javascript:alert(1)', '//foreign.invalid', 'https://testflight.apple.com.foreign.invalid/a', 'https://x:test@testflight.apple.com/a'])('rejects a malformed destination in the configuration: %s', ios => {
  expect(() => render('iPhone', { ...targets, ios })).toThrow();
});
