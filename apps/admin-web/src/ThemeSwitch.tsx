import {useEffect, useState} from 'react';
import {readTheme, setTheme, watchTheme} from './theme';
import './theme-control.css';
export function ThemeSwitch() {
  const [theme, update] = useState(readTheme);
  useEffect(() => watchTheme(update), []);
  return <div className="theme-switch" role="group" aria-label="Farbschema">
    {([['light','Hell'],['dark','Dunkel'],['automatic','Automatisch']] as const).map(([value,label]) =>
      <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>{label}</button>)}
  </div>;
}
