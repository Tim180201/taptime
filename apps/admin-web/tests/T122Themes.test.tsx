// @vitest-environment jsdom
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ThemeSwitch} from '../src/ThemeSwitch';

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();document.documentElement.removeAttribute('data-theme');});
beforeEach(()=>localStorage.clear());
it.each(['light','dark'])('system %s uses automatic mode without a document override', scheme=>{
  vi.stubGlobal('matchMedia',vi.fn((query:string)=>({matches:query.includes(scheme),addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  render(<ThemeSwitch/>);
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  expect(screen.getByRole('button',{name:'Automatisch'}).getAttribute('aria-pressed')).toBe('true');
});
it('switches immediately, remembers the browser choice and removes it for automatic',()=>{
  const view=render(<ThemeSwitch/>);
  fireEvent.click(screen.getByRole('button',{name:'Hell'}));
  expect(document.documentElement.dataset.theme).toBe('light');
  view.unmount();render(<ThemeSwitch/>);
  expect(screen.getByRole('button',{name:'Hell'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Dunkel'}));expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.click(screen.getByRole('button',{name:'Automatisch'}));expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});
it.each(['getItem','setItem','removeItem'] as const)('storage failure in %s falls back to automatic', method=>{
  if(method==='removeItem')localStorage.setItem('taptime-theme','light');
  vi.spyOn(Storage.prototype,method).mockImplementation(()=>{throw new Error('storage disabled');});
  render(<ThemeSwitch/>);
  if(method==='setItem')fireEvent.click(screen.getByRole('button',{name:'Hell'}));
  if(method==='removeItem')fireEvent.click(screen.getByRole('button',{name:'Automatisch'}));
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  expect(screen.getByRole('button',{name:'Automatisch'}).getAttribute('aria-pressed')).toBe('true');
});

const root=resolve(import.meta.dirname,'../../..');
const spec=readFileSync(resolve(root,'ADO/01_Architecture/Web_Entwurf_v2/README.md'),'utf8');
const palettes:Record<string,Record<string,string>>={dark:{},light:{}};
for(const row of spec.split('\n')){
 const m=row.match(/^\| `([^`]+)`[^|]*\|[^|]*`(#[0-9a-f]{6})`[^|]*\|[^|]*`(#[0-9a-f]{6})`/i);
 if(m){palettes.dark[m[1]]=m[2];palettes.light[m[1]]=m[3];}
}
const textMinimum=Number(spec.match(/Text auf Fläche, mindestens ([\d,]+)/)![1].replace(',','.'));
const graphicMinimum=Number(spec.match(/Fläche ohne Text, mindestens ([\d,]+)/)![1].replace(',','.'));
const pairs:Array<[string,string,number]>=[];
for(const bg of ['ground','surface','surface-raised'])for(const fg of ['text','text-muted','accent','notice','error'])pairs.push([fg,bg,textMinimum]);
for(const bg of ['action','notice','error'])pairs.push(['on-action',bg,textMinimum]);
pairs.push(['on-running','running',textMinimum]);
for(const bg of ['surface','surface-raised'])for(const fg of ['accent','notice','error','text-muted'])pairs.push([fg,bg,graphicMinimum]);
function luminance(hex:string){const [r,g,b]=hex.slice(1).match(/../g)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;}
function variables(css:string,theme:string){
 const rule=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(m=>m[1].includes(`[data-theme="${theme}"]`));
 expect(rule,`explicit ${theme} palette`).toBeDefined();
 return Object.fromEntries([...rule![2].matchAll(/--color-([\w-]+):\s*(#[\da-f]{6})/gi)].map(m=>[m[1],m[2].toUpperCase()]));
}
for(const app of ['admin-web','operator-web','landing-web'])it(`${app}: specified tokens and contrast pairs in both CSS themes`,()=>{
 const css=readFileSync(resolve(root,`apps/${app}/src/${app==='landing-web'?'style':'styles'}.css`),'utf8');
 for(const theme of ['dark','light']){
  const colors=variables(css,theme);
  for(const [name,value]of Object.entries(palettes[theme])){
   // T-122c changes the administration band only; the other web apps are outside its scope.
   if(app!=='admin-web'&&(name==='band'||name==='band-line'))continue;
   expect(colors[name],`${theme}/${name}`).toBe(value);
  }
  const themePairs=[...pairs,['band-text','band',textMinimum],['band-text-muted','band',textMinimum]] as typeof pairs;
  for(const [fg,bg,min]of themePairs){
   expect(colors[fg],fg).toBeDefined();expect(colors[bg],bg).toBeDefined();
   const a=luminance(colors[fg]),b=luminance(colors[bg]);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05),`${theme}: ${fg}/${bg}`).toBeGreaterThanOrEqual(min);
  }
 }
 expect(css).toContain('prefers-color-scheme: light');
});
for(const app of ['admin-web','operator-web','landing-web'])it(`${app}: hex colours occur only in variable declarations`,()=>{
 const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):/\.(css|tsx?|html)$/.test(e.name)?[resolve(dir,e.name)]:[]);
 const html=readdirSync(resolve(root,`apps/${app}`)).filter(name=>name.endsWith('.html')).map(name=>resolve(root,`apps/${app}`,name));
 const publicCss=app==='landing-web'?[resolve(root,'apps/landing-web/public/tag-assets/tag.css')]:[];
 for(const file of [...walk(resolve(root,`apps/${app}/src`)),...html,...publicCss]){
  const content=readFileSync(file,'utf8').replace(/--[\w-]+\s*:[^;{}]+;/g,'');
  expect(content.match(/#[0-9a-f]{3,8}\b/gi),file).toBeNull();
 }
});
