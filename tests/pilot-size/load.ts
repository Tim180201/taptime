import { setTimeout as delay } from 'node:timers/promises';
import { people, workCards, organization, type Person } from './dataset.js';
import type { OfflineCaptureLeasePageV3 } from '@taptime/offline-sync-contract';
import { TIME_DETAILS_ACCEPT_V3 } from '@taptime/mobile-work-contract';
import { Http, type Body, type Reply, quantile } from './measure.js';
import { id, iso, save } from './support.js';

export async function writeLoad(http:Http,profile:string,smoke:boolean) {
  const lockSamples:unknown[]=[];
  let sampling=true;
  const observer=(async()=>{
    while (sampling) {
      const rows=(await http.env.db.query(`SELECT pid,wait_event,clock_timestamp()-query_start AS waiting_for,
        cardinality(pg_blocking_pids(pid)) AS blockers FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock'`)).rows;
      if (rows.length) lockSamples.push({at:new Date().toISOString(),rows});
      await delay(25);
    }
  })();
  const offline:Reply[]=[],starts:Reply[]=[];
  const devices:{ person:Person;installationBinding:string;lease:OfflineCaptureLeasePageV3;
    item:Extract<OfflineCaptureLeasePageV3['items'][number],{itemType:'nfc_assignment';subjectType:'work'}> }[]=[];
  try {
    for (const person of people.slice(6,26)) {
      const installationBinding=Buffer.from(id(`installation-${person.index}`).replaceAll('-','').repeat(2),'hex').toString('base64url');
      const leaseReply=await http.request('/v3/offline-capture-leases',{
        commandId:id(`lease-${profile}-${person.index}`),installationBinding,lookupKey:Buffer.alloc(32,99).toString('base64url'),
      },person);
      if (leaseReply.status!==200) throw new Error(`Offline lease: ${leaseReply.text}`);
      const lease:OfflineCaptureLeasePageV3=JSON.parse(leaseReply.text).page;
      const item=lease.items.find((item):item is Extract<typeof item,{itemType:'nfc_assignment';subjectType:'work'}>=>item.itemType==='nfc_assignment' && item.subjectType==='work');
      if (!item) throw new Error('Lease has no work item');
      devices.push({person,installationBinding,lease,item});
    }
    const sync=async(sequence:number)=>Promise.all(devices.map(async({person,installationBinding,lease,item})=>{
      const occurredAt=iso(Date.now());
      const reply=await http.request('/v4/lifecycle-events/offline',{
        organizationId:organization,expectedMembershipId:person.member,leaseId:lease.leaseId,leaseItemId:item.itemId,
        installationBinding,deviceSequence:sequence,provenanceVersion:3,
        clock:{bootMarker:'synthetic-pilot-boot',monotonicAnchorMilliseconds:10000,
          monotonicDeltaMilliseconds:Date.parse(occurredAt)-Date.parse(lease.issuedAt),wallClockAnchor:lease.issuedAt,
          clockProofStatus:'verified_same_boot',clockProofVersion:1},
        receipt:{id:id(`${profile}-offline-receipt-${person.index}-${sequence}`),attemptNumber:1},
        workEvent:{id:id(`${profile}-offline-event-${person.index}-${sequence}`),occurredAt,subject:{type:'work'},
          target:{targetType:item.targetType,targetId:item.targetId},trigger:{type:'nfc',assignmentId:item.assignmentId,nfcTagId:item.nfcTagId}},
      },person,undefined,`198.19.0.${person.location+1}`);
      offline.push(reply);return reply;
    }));
    await sync(1);
    // Real elapsed time: do not forge a device clock or change the engine duplicate window.
    await delay(6100);
    await sync(2);
    await save(`${profile}/offline.json`,offline);
    const burstStart=performance.now();
    for (const person of people.filter(p=>!p.former)) {
      const scheduled=smoke?0:person.index*(600_000/200);
      await delay(Math.max(0,burstStart+scheduled-performance.now()));
      const card=workCards.find(c=>c.customer.location===person.location)!;
      const response=await http.request('/v1/lifecycle-events/manual',{
        expectedMembershipId:person.member,workEvent:{id:id(`${profile}-burst-${person.index}`),target:{targetType:'customer',targetId:card.customer.id}},
        receipt:{id:id(`${profile}-burst-receipt-${person.index}`),attemptNumber:1},
      },person,TIME_DETAILS_ACCEPT_V3,`198.19.1.${person.location+1}`);
      starts.push(response);
      if (person.index%10===0) {
        console.log(`${profile}: starts ${person.index+1}/200`);
        await save(`${profile}/load-progress.json`,{starts:starts.length,elapsedSeconds:(performance.now()-burstStart)/1000});
      }
    }
    const result={smoke,elapsedSeconds:(performance.now()-burstStart)/1000,starts,offline,lockSamples,
      startP95:quantile(starts.map(s=>s.milliseconds),.95),offlineP95:quantile(offline.map(s=>s.milliseconds),.95),
      lockSamplingMilliseconds:25};
    await save(`${profile}/load.json`,result);return result;
  } finally { sampling=false;await observer; }
}
