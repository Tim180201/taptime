import { Client, type Pool } from 'pg';

// Observes real node-pg SELECT/WITH calls, including rejected promises, with
// the SET LOCAL context needed for EXPLAIN.
export function observeSql(save: (path:string,value:unknown)=>Promise<void>) {
  const original=Client.prototype.query;
  const contexts=new WeakMap<object,{role?:string;settings:{text:string;values:unknown[]}[]}>();
  const queries=new Map<string,{text:string;values:unknown[];role?:string;settings:{text:string;values:unknown[]}[];ms:number;calls:number}>();
  let enabled=false;
  (Client.prototype as any).query=function(...args:any[]) {
    const text=typeof args[0]==='string'?args[0]:args[0]?.text;
    const values=(typeof args[0]==='string'?args[1]:args[0]?.values)??[];
    let context=contexts.get(this);
    if (/^BEGIN\b/.test(text??'')) { context={settings:[]}; contexts.set(this,context); }
    if (context && /^SET LOCAL ROLE /.test(text??'')) context.role=text;
    if (context && /set_config\('app\./.test(text??'')) context.settings.push({text,values:Array.isArray(values)?values:[]});
    const start=performance.now();
    const result=(original as any).apply(this,args);
    if (enabled && /^\s*(?:SELECT|WITH)\b/i.test(text??'') && !/set_config|pg_catalog\.transaction_timestamp|clock_timestamp/.test(text)
        && result?.then && typeof args.at(-1)!=='function') {
      const captured={text,values:Array.isArray(values)?values:[],role:context?.role,settings:[...(context?.settings??[])]};
      const record=(queryError?:string)=>{
        const ms=performance.now()-start,old=queries.get(text);
        queries.set(text,ms>(old?.ms??-1)?{...captured,ms,calls:(old?.calls??0)+1,...(queryError?{queryError}: {})}:{...old!,calls:old!.calls+1});
      };
      return result.then((value:unknown)=>{record();return value;},(error:unknown)=>{record(String(error));throw error;});
    }
    return result;
  };
  return { enable:()=>{enabled=true;},disable:()=>{enabled=false;}, restore:()=>{Client.prototype.query=original;},
    async explain(env:{db:Pool},profile:string,previous:any[]=[]) {
      enabled=false;
      const combined=new Map<string,any>();
      for(const query of [...previous,...queries.values()])if(query.ms>(combined.get(query.text)?.ms??-1))combined.set(query.text,query);
      const top=[...combined.values()].filter(q=>/taptime_server\./.test(q.text)).sort((a,b)=>b.ms-a.ms).slice(0,5);
      const plans=[];
      for (const query of top) {
        if(query.plan){plans.push(query);continue;}
        const client=await env.db.connect();
        try {
          await client.query('BEGIN');
          await client.query("SET LOCAL statement_timeout='60s'");
          for (const setting of query.settings) await client.query(setting.text,setting.values);
          if (query.role) await client.query(query.role);
          const plan=await client.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+query.text,query.values);
          plans.push({...query,plan:plan.rows});
        } catch(error) { plans.push({...query,error:String(error)}); }
        finally { await client.query('ROLLBACK');client.release(); }
      }
      await save(`${profile}/slow-queries.json`,plans); return plans;
    },
  };
}

