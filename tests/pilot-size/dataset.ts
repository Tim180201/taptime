import { ServerCanonicalLifecycleIngestionCoordinator } from '../../apps/backend-lifecycle/src/ServerCanonicalLifecycleIngestionCoordinator.js';
import { TimeSupplementCoordinator } from '../../apps/backend-time-review/src/TimeSupplementCoordinator.js';
import { TimeReviewCoordinator } from '../../apps/backend-time-review/src/TimeReviewCoordinator.js';
import { AdminWriteSessionCoordinator } from '../../apps/backend-administration/src/AdminWriteSessionCoordinator.js';
import { id, iso, requireStatus, save, type Environment } from './support.js';
import { SupabaseJwtAccessTokenVerifier } from '@taptime/backend-identity';
import type { LifecycleIngestionCommand } from '../../apps/backend-lifecycle/src/types.js';
import type { MembershipId } from '../../packages/core/src/index.js';

export const organization = id('organization');
export const locations = Array.from({ length:5 }, (_, i) => id(`location-${i}`));
export const people = Array.from({ length:210 }, (_, i) => ({ index:i, user:id(`user-${i}`), member:id(`member-${i}`),
  location:i < 6 ? (i === 0 ? 0 : i-1) : (i-6)%5,
  role:i === 0 ? 'administrator' : i < 6 ? 'standortleitung' : 'employee', former:i >= 200,
}));
export type Person = typeof people[number];
export const customers = Array.from({ length:510 }, (_, i) => ({ id:id(`customer-${i}`), location:i%5, archived:i>=500 }));
export const projects = Array.from({ length:20 }, (_, i) => ({ id:id(`project-${i}`), location:i%5, archived:i>=10 }));
export const workCards = customers.slice(0,495).map((customer,i) => ({ tag:id(`card-${i}`), assignment:id(`assignment-${i}`), customer }));
export const breakCards = locations.map((_,i) => ({ tag:id(`break-card-${i}`), assignment:id(`break-assignment-${i}`) }));

export async function seedMasters(env: Environment, firstDate: string) {
  const { db } = env;
  // Same master-data fixture pattern as T117SearchPostgres/T127ArchivePostgres.
  // No time/event/decision/revision/receipt rows are inserted by this tool.
  await db.query('INSERT INTO taptime_server.organizations(id,name,created_at) VALUES($1,$2,$3)', [organization,'SYNTHETISCH Betrieb 099',firstDate]);
  for (const [i, location] of locations.entries()) await db.query(
    'INSERT INTO taptime_server.locations(id,organization_id,display_name,created_at) VALUES($1,$2,$3,$4)',
    [location,organization,`SYNTHETISCH Standort ${i+1}`,firstDate]);
  for (const person of people) {
    await db.query('INSERT INTO taptime_server.users(id,created_at) VALUES($1,$2)', [person.user,firstDate]);
    await db.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject,created_at) VALUES($1,$2,$3,$4,$5)',
      [id(`binding-${person.index}`),person.user,env.issuer,person.user,firstDate]);
    await db.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name,created_at) VALUES($1,$2,$3,$4,$5,$6)',
      [person.member,organization,person.user,person.role,`SYNTHETISCH Person ${String(person.index+1).padStart(3,'0')}`,firstDate]);
    await db.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id,assigned_at) VALUES($1,$2,$3,$4,$5)',
      [id(`home-${person.index}`),organization,person.member,locations[person.location],firstDate]);
    if (person.role === 'standortleitung') await db.query('INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id,granted_at) VALUES($1,$2,$3,$4,$5)',
      [id(`management-${person.index}`),organization,person.member,locations[person.location],firstDate]);
  }
  for (const [kind, targets] of [['customer',customers],['project',projects]] as const) for (const [i,target] of targets.entries()) {
    await db.query(`INSERT INTO taptime_server.${kind==='customer'?'customers':'projects'}(id,organization_id,display_name,active,created_at${kind==='customer'?',activated_at':''}) VALUES($1,$2,$3,true,$4${kind==='customer'?',$4':''})`,
      [target.id,organization,`SYNTHETISCH ${kind==='customer'?'Kunde':'Projekt'} ${String(i+1).padStart(3,'0')}`,firstDate]);
    await db.query('INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id,assigned_at) VALUES($1,$2,$3,$4,$5,$6)',
      [id(`target-location-${kind}-${i}`),organization,kind,target.id,locations[target.location],firstDate]);
  }
  const cards: (typeof workCards[number] | typeof breakCards[number])[] = [...workCards,...breakCards];
  for (const [i,card] of cards.entries()) {
    await db.query('INSERT INTO taptime_server.nfc_tags(id,organization_id,display_name,payload_value,created_at) VALUES($1,$2,$3,$4,$5)',
      [card.tag,organization,`SYNTHETISCH Karte ${i+1}`,`nfc:uid:v1:${String(i+1).padStart(14,'0')}`,firstDate]);
    await db.query(`INSERT INTO taptime_server.nfc_assignments(id,organization_id,nfc_tag_id,assignment_type,target_type,target_customer_id,active,valid_from)
      VALUES($1,$2,$3,$4,$5,$6,true,$7)`, [card.assignment,organization,card.tag,'customer' in card?'work':'break',
      'customer' in card?'customer':null,'customer' in card?card.customer.id:null,firstDate]);
  }
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [organization]);
  await db.query('INSERT INTO taptime_server.platform_operators(id,issuer,subject) VALUES($1,$2,$3)', [id('operator'),env.issuer,id('operator-subject')]);
}

export async function generate(env: Environment, profile: 'expected'|'peak', smoke: boolean) {
  const now = (await env.db.query('SELECT clock_timestamp() AS now')).rows[0].now as Date;
  const reference = process.env.TAPTIME_PILOT_AS_OF ?? now.toISOString().slice(0,10);
  if (!/^\d{4}-\d\d-\d\d$/.test(reference) || Date.parse(reference) > now.getTime()) throw new Error('Invalid/future AS_OF');
  const first = new Date(reference+'T00:00:00Z'); first.setUTCDate(1); first.setUTCMonth(first.getUTCMonth()-3);
  const mastersAt = iso(first.getTime()-86400_000);
  await seedMasters(env, mastersAt);
  const dates: string[] = [];
  for (let day=first.getTime();day<Date.parse(reference);day+=86400_000) {
    const weekday = new Date(day).getUTCDay();
    if (profile==='expected' ? [1,3,5].includes(weekday) : weekday>0 && weekday<6) dates.push(iso(day).slice(0,10));
  }
  const usedDates = smoke ? dates.slice(-1) : dates;
  const verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({ issuer:env.issuer,
    jwksUrl:new URL(`${env.issuer}/.well-known/jwks.json`),allowedAlgorithms:['RS256'] });
  const tokens = new Map(await Promise.all(people.map(async person => [person.user,await env.token(person.user)] as const)));
  const administratorToken = tokens.get(people[0]!.user)!;
  const administration = new AdminWriteSessionCoordinator(env.seedPool('administration'),verifier);
  for (const [index,customer] of customers.entries()) if (!customer.archived) requireStatus(
    await administration.setCustomerQuota({ accessToken:administratorToken,expectedMembershipId:people[0]!.member,
      commandId:id(`quota-${index}`),customerId:customer.id,minutes:600+(index%5)*600 }), 'succeeded','quota');
  for (const person of people) {
    const available = customers.filter(c=>!c.archived && c.location===person.location);
    for (let index=0;index<3+person.index%13;index++) requireStatus(await administration.changeTargetAssignment({
      accessToken:administratorToken,expectedMembershipId:people[0]!.member,commandId:id(`assigned-${person.index}-${index}`),
      membershipId:person.member,targetType:'customer',targetId:available[(person.index+index)%available.length]!.id,assigned:true,
    }),'succeeded','target assignment');
  }
  // Historical data uses the actual canonical coordinator with a local durability boundary.
  // There is no archive service in this benchmark; archive latency is explicitly excluded.
  const lifecycle = new ServerCanonicalLifecycleIngestionCoordinator(env.seedPool('lifecycle'),verifier,
    { requireOffsiteArchive:async()=>({ requiredWalFile:'000000010000000000000001',offsiteArchived:true }) });
  const supplement = new TimeSupplementCoordinator(env.seedPool('timeReviewWrite'),verifier);
  const correctionPool = env.seedPool('timeReviewWrite');
  const corrections = new TimeReviewCoordinator(correctionPool,correctionPool,verifier);
  const count = { entries:0, events:0, backfills:0, corrections:0, review:0 };
  const started = performance.now();
  const command = (person: Person, card: typeof workCards[number]|typeof breakCards[number], at: string, label: string): LifecycleIngestionCommand => ({
    accessToken:tokens.get(person.user)!, requestedOrganizationId:organization as LifecycleIngestionCommand['requestedOrganizationId'],
    workEvent:{ id:id(`event-${label}`), assignmentId:card.assignment, nfcTagId:card.tag, occurredAt:at,
      ...('customer' in card?{ target:{targetType:'customer',targetId:card.customer.id} }:{ subject:{type:'break'} }) } as LifecycleIngestionCommand['workEvent'],
    receipt:{ id:id(`receipt-${label}`),attemptNumber:1 },
  });
  const emit = async (person: Person, card: typeof workCards[number]|typeof breakCards[number], at: string, label: string, expected: string) => {
    const result = requireStatus(await lifecycle.ingest(command(person,card,at,label),person.member as MembershipId),'synchronized',label);
    if (result.status !== 'synchronized' || result.decision.status !== expected) throw new Error(`${label}: ${JSON.stringify(result)}`);
    count.events++; return result;
  };
  // Concurrency is only across people; each person's event history remains chronological.
  let nextPerson = 0;
  await Promise.all(Array.from({length:8},async()=>{
    for (;;) {
      const person = people[nextPerson++]; if (!person) break;
      const cards = workCards.filter(card=>card.customer.location===person.location);
      for (const [dayIndex,day] of usedDates.entries()) {
        if (person.former && day.slice(0,7) > iso(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,1))).slice(0,7)) continue;
        for (let unit=0;unit<(profile==='expected'?4:6);unit++) {
          const label = `${profile}-${person.index}-${day}-${unit}`;
          const start = Date.parse(day+'T06:00:00Z')+unit*75*60_000;
          const stop = start+60*60_000;
          const card = cards[(person.index*7+dayIndex*3+unit)%cards.length]!;
          if (unit>0 && (person.index+dayIndex*7+unit)%50===0) {
            requireStatus(await supplement.execute(administratorToken,'backfill',{
              expectedMembershipId:people[0]!.member,targetMembershipId:person.member,commandId:id(`backfill-${label}`),
              targetType:'customer',targetId:card.customer.id,startedAt:iso(start),stoppedAt:iso(stop),
              reason:'SYNTHETISCH Nachtrag',comment:null,
            }),'committed',label); count.backfills++;
          } else {
            await emit(person,card,iso(start),label+'-start','time_entry_started');
            if (unit===0) {
              await emit(person,breakCards[person.location]!,iso(start+25*60_000),label+'-pause','break_started');
              await emit(person,breakCards[person.location]!,iso(start+35*60_000),label+'-resume','break_stopped');
            }
            const result = await emit(person,card,iso(stop),label+'-stop','time_entry_stopped');
            if (unit>0 && (person.index+dayIndex*3+unit)%100===0 && 'timeEntryId' in result.decision) {
              const entry = (await env.db.query('SELECT row_version FROM taptime_server.time_entries WHERE id=$1',[result.decision.timeEntryId])).rows[0];
              requireStatus(await corrections.correctTimeRecord({ accessToken:administratorToken,request:{
                expectedMembershipId:people[0]!.member,commandId:id(`correction-${label}`),timeRecordId:result.decision.timeEntryId,
                expectedBaseRowVersion:Number(entry.row_version),expectedRevisionNumber:0,startedAt:iso(start+60_000),stoppedAt:iso(stop),
                reason:'SYNTHETISCH Korrektur mit Grund',
              }}),'committed',label); count.corrections++;
            }
          }
          count.entries++;
        }
      }
      if (!person.former && person.index%10===0) {
        const at=iso(Date.parse(reference)-12*3600_000);
        const result=await lifecycle.ingestDeferred(command(person,cards[0]!,at,`${profile}-review-${person.index}`),person.member as MembershipId);
        requireStatus(result,'deferred','review'); count.review++;
      }
      if (person.index%10===0) {
        console.log(`${profile}: seeded person ${person.index+1}/${people.length}; ${count.entries} entries`);
        await save(`${profile}/generation-progress.json`,{...count,elapsedSeconds:(performance.now()-started)/1000});
      }
    }
  }));
  // Give projects and archived targets real history through the same backfill path.
  const historicalTargets=[...projects.map(target=>({...target,type:'project' as const})),
    ...customers.filter(target=>target.archived).map(target=>({...target,type:'customer' as const}))];
  for (const [index,target] of historicalTargets.entries()) {
    const at=Date.parse(usedDates[0]+'T00:00:00Z')+Math.floor(index/5)*45*60_000;
    requireStatus(await supplement.execute(administratorToken,'backfill',{
      expectedMembershipId:people[0]!.member,targetMembershipId:people[6+target.location]!.member,
      commandId:id(`${profile}-historical-target-${index}`),targetType:target.type,targetId:target.id,
      startedAt:iso(at),stoppedAt:iso(at+20*60_000),reason:'SYNTHETISCH Projekthistorie und Archiv',comment:null,
    }),'committed','historical target');count.entries++;count.backfills++;
  }
  // Existing fixture lifecycle pattern for departed master data; original time evidence is unchanged.
  const departed = iso(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+2,1)-1);
  await env.db.query('UPDATE taptime_server.memberships SET revoked_at=$2,row_version=row_version+1 WHERE id=ANY($1::uuid[])', [people.filter(p=>p.former).map(p=>p.member),departed]);
  for (const [kind,targets] of [['customers',customers],['projects',projects]] as const) {
    await env.db.query(`UPDATE taptime_server.${kind} SET active=false,deactivated_at=$2,row_version=row_version+1 WHERE id=ANY($1::uuid[])`,
      [targets.filter(t=>t.archived).map(t=>t.id),now]);
  }
  return {reference,firstDate:iso(first),days:usedDates,profile,smoke,...count,elapsedSeconds:(performance.now()-started)/1000};
}
