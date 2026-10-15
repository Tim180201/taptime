import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('T122b landing uses neutral headlines and the shared control radius',()=>{
 const css=readFileSync(new URL('../../landing-web/src/style.css',import.meta.url),'utf8');
 expect(css).toMatch(/\.headline \.l2\s*\{[^}]*color:\s*var\(--color-text\)/);
 expect(css).toMatch(/\.btn\s*\{[^}]*border-radius:\s*9px/);
 const html=readFileSync(new URL('../../landing-web/index.html',import.meta.url),'utf8');
 expect(html).toMatch(/<footer>[\s\S]*id="theme-control"[\s\S]*<\/footer>/);
});
