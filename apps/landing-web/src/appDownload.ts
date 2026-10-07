export interface AppLinks { readonly ios: string; readonly android: string }
interface Device { readonly userAgent: string; readonly platform: string; readonly maxTouchPoints: number }

export function validateAppLinks(links: AppLinks): void {
  for (const [platform, value] of Object.entries(links)) {
    if (value === '') continue;
    const url = new URL(value);
    const hosts = platform === 'ios' ? ['apps.apple.com', 'testflight.apple.com'] : ['play.google.com'];
    if (value !== value.trim() || url.protocol !== 'https:' || !hosts.includes(url.hostname)
      || url.username || url.password || url.port) throw new Error(`Invalid ${platform} app destination`);
  }
}

export function renderAppDownload(root: HTMLElement, links: AppLinks, device: Device, redirect: (url: string) => void): void {
  validateAppLinks(links);
  // User-controlled URL/query/fragment never participates in destination selection.
  const platform = /iPhone|iPad|iPod/i.test(device.userAgent)
    || device.platform === 'MacIntel' && device.maxTouchPoints > 1 ? 'ios'
    : /Android/i.test(device.userAgent) ? 'android' : null;
  root.replaceChildren();
  const available = platform ? [[platform, links[platform]]] : Object.entries(links);
  const actions = document.createElement('div');
  actions.className = 'app-actions';
  for (const [key, value] of available) {
    if (!value) continue;
    const link = document.createElement('a');
    link.className = 'app-button';
    link.href = value;
    link.rel = 'noreferrer';
    link.textContent = key === 'ios' ? 'App Store' : 'Google Play';
    actions.append(link);
  }
  if (available.some(([, value]) => !value)) {
    const message = document.createElement('p');
    message.textContent = 'Die App erhalten Sie von Ihrer Verwaltung.';
    root.append(message);
  }
  root.append(actions);
  if (platform && links[platform]) redirect(links[platform]);
}
