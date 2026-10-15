export type ThemePreference = 'light' | 'dark' | 'automatic';
export const THEME_STORAGE_KEY = 'taptime-theme';
const eventName = 'taptime-theme-change';
const preference = (value: string | null): ThemePreference => value === 'light' || value === 'dark' ? value : 'automatic';
export function readTheme(): ThemePreference {
  try { return preference(window.localStorage.getItem(THEME_STORAGE_KEY)); }
  catch { return 'automatic'; }
}
function applyTheme(theme: ThemePreference) {
  if (theme === 'automatic') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}
export function setTheme(theme: ThemePreference) {
  try {
    if (theme === 'automatic') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch { theme = 'automatic'; }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent<ThemePreference>(eventName, {detail: theme}));
}
export function watchTheme(listener: (theme: ThemePreference) => void) {
  const update = (theme: ThemePreference) => { applyTheme(theme); listener(theme); };
  const local = (event: Event) => update((event as CustomEvent<ThemePreference>).detail);
  const storage = (event: StorageEvent) => { if (event.key === THEME_STORAGE_KEY || event.key === null) update(readTheme()); };
  update(readTheme());
  window.addEventListener(eventName, local);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(eventName, local); window.removeEventListener('storage', storage); };
}
/** Used by the static landing pages; the React clients use the same preference lifecycle. */
export function mountThemeSwitch(container: HTMLElement) {
  container.classList.add('theme-switch');
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Farbschema');
  const choices = [['light', 'Hell'], ['dark', 'Dunkel'], ['automatic', 'Automatisch']] as const;
  const buttons = choices.map(([theme, label]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => setTheme(theme));
    container.append(button);
    return {theme, button};
  });
  return watchTheme(theme => buttons.forEach(item => item.button.setAttribute('aria-pressed', String(item.theme === theme))));
}
