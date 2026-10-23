import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { observeSql } from './sql-observer.ts';

test('a timed-out query remains in the SQL ranking with its tenant context',async()=>{
  const original=Client.prototype.query;
  const sql='WITH page AS MATERIALIZED (SELECT taptime_server.synthetic_slow($1)) SELECT * FROM page';
  const saved=new Map(),replayed=[];
  Client.prototype.query=function(text){return text===sql?Promise.reject(new Error('Query read timeout')):Promise.resolve({rows:[]});};
  const observer=observeSql(async(path,value)=>{saved.set(path,value);});
  try {
    observer.enable();
    const client=new Client(); // No connect call and no database access.
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id',$1,true)",['synthetic-user']);
    await client.query('SET LOCAL ROLE taptime_synthetic_reader');
    await assert.rejects(client.query(sql,['synthetic-parameter']),/Query read timeout/);
    observer.disable();
    await observer.explain({db:{connect:async()=>({
      query:async(text,values)=>{replayed.push([text,values]);return {rows:text.startsWith('EXPLAIN')?[{'QUERY PLAN':[{'Execution Time':1}]}]:[]};},release(){},
    })}},'synthetic');
    const plans=saved.get('synthetic/slow-queries.json');
    assert.equal(plans.length,1);
    assert.equal(plans[0].text,sql);
    assert.match(plans[0].queryError,/Query read timeout/);
    assert.deepEqual(plans[0].values,['synthetic-parameter']);
    assert(replayed.some(([text])=>text==='SET LOCAL ROLE taptime_synthetic_reader'));
    assert(replayed.some(([text,values])=>text.startsWith('EXPLAIN (ANALYZE, BUFFERS')&&values[0]==='synthetic-parameter'));
  }finally{observer.restore();Client.prototype.query=original;}
});
