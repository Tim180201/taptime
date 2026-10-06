import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import ts from 'typescript';
import {expect,it} from 'vitest';
const root=resolve(import.meta.dirname,'../../..');
const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(dir,entry.name)):/\.(tsx?|html)$/.test(entry.name)?[join(dir,entry.name)]:[]);
it('D-124 to D-127: no retired terms in application strings or accessibility labels',()=>{
 const paths=['apps/mobile/src','apps/admin-web/src','apps/operator-web/src'].flatMap(dir=>files(join(root,dir)));
 paths.push(...['apps/mobile/app.json','apps/landing-web/index.html','apps/landing-web/tag.html','docs/T-047-Einladungsvorlage.md','docs/T-094b-Ruecksetzvorlage.md'].map(p=>join(root,p)));
 const failures:string[]=[];
 const retired=/Bitte die Verwaltung, (?:die Erfassung|den Scan) zu prüfen|wird von deiner Verwaltung geprüft|Die Verwaltung prüft (?:deine|diese) Erfassung|noch eine Prüfung offen|Heimatstandort|Erfassungsart|Korrekturstand|Herkunft|Beschäftigt\w*|Abgleich|Prüfungen|Prüfung erforderlich|NFC-Tags?|\bTags\b/u;
 for(const path of paths){
  const source=readFileSync(path,'utf8');
  const check=(text:string)=>{const calendar=/^(Guten Tag\.|Arbeitszeiten an diesem Tag|Keine Arbeitszeiten an diesem Tag\.|Für diesen Tag zählt keine Arbeitszeit\.|Dieser Tag liegt außerhalb des vollständig geladenen Zeitraums\.|(?:Deine|Ihre) Stunden je Tag|Zuordnung nach dem Tag, an dem der Eintrag beginnt\.|Ausgewählter Tag|· Liegt „bis“ vor oder gleich „von“, endet die Zeit am nächsten Tag\. Pausen bitte als Lücke zwischen zwei Einträgen lassen\.)$/.test(text.trim());if(retired.test(text)||/\bTag\b/.test(text)&&!calendar)failures.push(`${path.slice(root.length+1)}: ${text.trim().slice(0,160)}`);};
  if(path.endsWith('.html')||path.endsWith('.md')||path.endsWith('.json')){check(source);continue;}
  const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
  const visit=(node:ts.Node)=>{if(ts.isStringLiteralLike(node)||ts.isJsxText(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node))check(node.text);ts.forEachChild(node,visit);};visit(ast);
 }
 expect(failures).toEqual([]);
});
