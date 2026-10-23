import type { Body, Reply, Reading, Http } from './measure.js';
import type { Person } from './dataset.js';
const quantile=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)]??0;

export async function measureCases(http:Http,cases:Reading[],actorFor:(role:Reading['role'])=>Person|'operator',
  profile:string,smoke:boolean,save:(path:string,value:unknown)=>Promise<void>,results:unknown[]=[],fixtures:Record<string,unknown>={}) {
  for (const item of cases) {
    const actor=actorFor(item.role);
    let body=item.body;
    let largest:Reply|undefined, largestBody=body;
    const seen=new Set<string>();
    let pages=0;
    // Walk actual cursors first, then measure the largest response. Never manufacture a full-list response.
    do {
      const response=await http.request(item.path,body,actor,item.accept);
      pages++;
      if (!largest || response.bytes>largest.bytes) { largest=response;largestBody=body; }
      if (!item.paginated || response.status!==200 || !body || smoke) break;
      const parsed=JSON.parse(response.text);
      const cursor=parsed.nextCursor??parsed.page?.nextCursor;
      if (!cursor) break;
      if (seen.has(cursor)) throw new Error(`Repeated cursor on ${item.name}`);
      seen.add(cursor); body={...body,cursor};
    } while(true);
    const samples:Reply[]=[];
    for (let i=0;i<(smoke?1:20);i++) samples.push(await http.request(item.path,largestBody,actor,item.accept));
    const invalid=samples.find(sample=>[400,401,404,405,429].includes(sample.status));
    if (invalid) throw new Error(`Invalid measurement request ${item.role}/${item.name}: ${invalid.status} ${invalid.text}`);
    const statuses=Object.fromEntries([...new Set(samples.map(s=>s.status))].map(status=>[status,samples.filter(s=>s.status===status).length]));
    const record={...item,body:largestBody,pages,samples:samples.map(({text,headers,...sample})=>sample),statuses,
      p50:quantile(samples.map(s=>s.milliseconds),.5),p95:quantile(samples.map(s=>s.milliseconds),.95),
      maxBytes:Math.max(...samples.map(s=>s.bytes)),errorBodies:samples.filter(s=>s.status!==200).map(s=>s.text)};
    results.push(record);
    fixtures[`${item.role}/${item.name}`]={request:largestBody,path:item.path,accept:item.accept,response:largest};
    await save(`${profile}/reads.json`,results);
    await save(`${profile}/largest-responses.json`,fixtures);
    console.log(`${profile}: ${item.role}/${item.name}: ${record.p95.toFixed(1)} ms, ${record.maxBytes} bytes, ${JSON.stringify(statuses)}`);
  }
  return {results,fixtures};
}
