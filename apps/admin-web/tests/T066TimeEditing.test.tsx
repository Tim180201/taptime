// @vitest-environment jsdom
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import { afterEach,expect,it,vi } from 'vitest';
import { TimeCalendar } from '../src/TimeCalendar';
import { TimeEditingProvider } from '../src/TimeEditingControls';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import type { AdminWebCapability,AdminWebState } from '../src/contracts';
import type { SafeOwnTimeRecord } from '@taptime/mobile-work-contract';
const own='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const record:SafeOwnTimeRecord={calendar:{asOf:"2026-09-21T12:00:00.000Z",workDurationSeconds:3600,breakDurationSeconds:0,breakIntervals:[]},timeRecordId:other,source:'recovered',targetType:'customer',targetDisplayName:'Werkstatt',status:'stopped',startedAt:'2026-09-21T08:00:00.000Z',stoppedAt:'2026-09-21T09:00:00.000Z',startedVia:null,stoppedVia:null,details:{origin:'backfilled',baseRowVersion:0,effectiveRevisionNumber:2,comment:'Vor Ort',changed:true,change:{at:'2026-09-21T10:00:00.000Z',reason:'Berichtigt',actor:'administration'},overlapsAnotherRecord:true}};
const page={activeRecord:null,records:[record],nextCursor:null,windowStartedAt:'2026-09-01T00:00:00.000Z',windowEndedAt:'2026-09-21T12:00:00.000Z'};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function show(role:'employee'|'administrator'|'standortleitung',target=own,entry=record,scoped=true) {
 const save=vi.fn(async()=>({status:'committed' as const,timeRecordId:other,idempotentRetry:false}));
 const state={role,membershipId:own,availableSections:scoped?['time_records','review_items']:[],timeEditBusy:false,workTargets:{status:'ready',value:[{targetType:'customer',targetId:own,displayName:'Werkstatt'}]}} as Pick<Extract<AdminWebState,{status:'ready'}>,'role'|'membershipId'|'timeEditBusy'|'workTargets'|'availableSections'>;
 const capability={saveTimeEdit:save,loadWorkTargets:vi.fn(async()=>{}),loadBackfillTargets:vi.fn(async()=>({status:"ready",targets:[{targetType:"customer",targetId:other,displayName:"Zielperson C2"}]}))} as unknown as AdminWebCapability;
 const view=render(<TimeEditingProvider state={state} administration={capability} targetMembershipId={target}><TimeCalendar value={{...page,activeRecord:entry.status==='started'?entry:null,records:entry.status==='stopped'?[entry]:[]}} month="2026-09" onMonthChange={()=>{}} onRefresh={()=>{}}/></TimeEditingProvider>);
 return {save,...view};
}
it('lets an employee save a backfill, keeps rejected inputs, and cancels',async()=>{
 const {save}=show('employee');fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));
 fireEvent.change(screen.getByLabelText('Kunde oder Projekt'),{target:{value:`customer:${own}`}});
 fireEvent.change(screen.getByLabelText('Kommentar (optional)'),{target:{value:'Vergessen'}});
 save.mockResolvedValueOnce({status:'overlap'} as never);fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await screen.findByText(/überschneidet sich mit einem anderen Eintrag/);
 expect(screen.getByLabelText('Kommentar (optional)')).toHaveValue('Vergessen');
 fireEvent.click(screen.getByRole('button',{name:'Speichern'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));
 expect(save).toHaveBeenLastCalledWith(expect.objectContaining({kind:'backfill',targetMembershipId:own,comment:'Vergessen',reason:null}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Speichern'})).not.toBeInTheDocument());
 fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));fireEvent.click(screen.getByRole('button',{name:'Abbrechen'}));expect(screen.queryByLabelText('Datum')).not.toBeInTheDocument();
});
it.each(['employee','administrator','standortleitung'] as const)('%s comments only their own entry',async role=>{
 const {save}=show(role);fireEvent.click(screen.getByRole('button',{name:'Kommentar schreiben'}));fireEvent.change(screen.getByLabelText('Kommentar'),{target:{value:'Meine Notiz'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({kind:'comment',comment:'Meine Notiz'})));
 cleanup();show(role,other);expect(screen.queryByRole('button',{name:'Kommentar schreiben'})).not.toBeInTheDocument();
});
it('administrator corrects completed time with the original versions and sees the running hint',async()=>{
 const {save}=show('administrator',other);fireEvent.click(screen.getByRole('button',{name:'Ändern'}));fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Prüfung'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({kind:'correct',record,reason:'Prüfung'})));
 cleanup();show('administrator',own,{...record,status:'started',stoppedAt:null});expect(screen.queryByRole('button',{name:'Ändern'})).not.toBeInTheDocument();expect(screen.getByText('Läuft noch — erst beenden, dann ändern')).toBeInTheDocument();
});
it.each(['administrator','standortleitung'] as const)('%s backfills another person with reason',async role=>{
 const {save}=show(role,other);fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));await screen.findByRole('option',{name:'Zielperson C2'});fireEvent.change(screen.getByLabelText('Kunde oder Projekt'),{target:{value:`customer:${other}`}});fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Tag vergessen'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({kind:'backfill',targetMembershipId:other,reason:'Tag vergessen',comment:null})));
 cleanup();show('standortleitung',other,record,false);for(const name of ['Zeit hinzufügen','Ändern','Kommentar schreiben']) expect(screen.queryByRole('button',{name})).not.toBeInTheDocument();
});
it.each([['nfc','gescannt'],['manual','manuell'],['backfilled','nachgetragen'],['recovered','wiederhergestellt']] as const)('shows %s provenance and correction/comment/overlap details', (origin,label)=>{
 show('employee',own,{...record,details:{...record.details!,origin}});expect(screen.getByText(new RegExp(label))).toBeInTheDocument();expect(screen.getByText(/Geändert.*Berichtigt/)).toBeInTheDocument();expect(screen.getByText('überschneidet sich')).toBeInTheDocument();expect(screen.getByText('Kommentar: Vor Ort')).toBeInTheDocument();
});
it('keeps writes visibly disabled offline',()=>{
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);show('employee');expect(screen.getByRole('button',{name:'Zeit hinzufügen'})).toBeDisabled();expect(screen.getByRole('button',{name:'Kommentar schreiben'})).toBeDisabled();expect(screen.getAllByText(/Nur online möglich/).length).toBeGreaterThan(0);
});
it.each(['employee','administrator','standortleitung'] as const)('has no axe violations in the open %s backfill form',async role=>{
 show(role);fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));expect((await axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});
it('explicitly negotiates details, validates them strictly and keeps v3/v4 selectable',async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>Response.json(page));const api=new AdminWebApiClient(fetcher);
 expect(await api.ownTime('token',{expectedMembershipId:own,cursor:null,limit:20})).toMatchObject({status:'succeeded'});
 expect(fetcher.mock.calls[0]![1]?.headers).toMatchObject({Accept:'application/vnd.taptime.time-calendar.v2+json'});
 fetcher.mockResolvedValueOnce(Response.json({...page,records:[{...record,details:{...record.details,secret:'hidden'}}]}));
 expect(await api.ownTime('token',{expectedMembershipId:own,cursor:null,limit:20})).toEqual({status:'invalid_response'});
 for(const version of [3,4] as const){fetcher.mockResolvedValueOnce(new Response('csv',{headers:{'content-type':'text/csv','content-disposition':`attachment; filename="taptime-time-entries_v${version}_20260901T000000Z_20261001T000000Z.csv"`}}));expect(await api.exportTimeEntries('token',own,page.windowStartedAt,page.windowEndedAt,version)).toMatchObject({status:'succeeded'});expect(fetcher.mock.lastCall?.[0]).toBe(`/v${version}/time-entries/export`);}
});

it.each(['comment','correct'] as const)('has no axe violations in the open %s form',async kind=>{
 show(kind==='comment'?'employee':'administrator');fireEvent.click(screen.getByRole('button',{name:kind==='comment'?'Kommentar schreiben':'Ändern'}));expect((await axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});
it('keeps Berlin DST gaps invalid and overnight dates explicit',async()=>{
 const {save}=show('employee');fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));fireEvent.change(screen.getByLabelText('Kunde oder Projekt'),{target:{value:`customer:${own}`}});
 fireEvent.change(screen.getByLabelText('Datum'),{target:{value:'2026-03-29'}});fireEvent.change(screen.getByLabelText('Von'),{target:{value:'02:30'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));expect(screen.getAllByRole('alert').every(node=>node.textContent?.includes('Zeitumstellung'))).toBe(true);expect(save).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Datum'),{target:{value:'2026-09-20'}});fireEvent.change(screen.getByLabelText('Von'),{target:{value:'22:00'}});fireEvent.change(screen.getByLabelText('Bis'),{target:{value:'06:00'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({startedAt:'2026-09-20T20:00:00.000Z',stoppedAt:'2026-09-21T04:00:00.000Z'})));
});
it('posts a closed supplemental command, maps overlap and rejects extra request fields',async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>Response.json({status:'overlap'},{status:422}));const api=new AdminWebApiClient(fetcher);
 const request={expectedMembershipId:own,targetMembershipId:own,commandId:other,targetType:'customer',targetId:own,startedAt:record.startedAt,stoppedAt:record.stoppedAt,reason:null,comment:'Notiz'};
 expect(await api.supplementTime('token','backfill',request)).toEqual({status:'succeeded',value:{status:'overlap'}});
 expect(fetcher.mock.lastCall?.[0]).toBe('/v1/time-records/backfill');expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual(request);
 expect(await api.supplementTime('token','backfill',{...request,role:'administrator'})).toEqual({status:'invalid_response'});expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(['administrator','standortleitung'] as const)('T-069 %s stops another person and waits for archival',async role=>{
 vi.useFakeTimers();
 try {
  const {save}=show(role,other,{...record,status:'started',stoppedAt:null,details:{...record.details!,baseRowVersion:2}});
  fireEvent.click(screen.getByRole('button',{name:'Beenden'}));
  expect(screen.queryByLabelText('Von')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Bis'),{target:{value:'2026-09-21T14:00'}});
  fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Vergessen'}});
  save.mockResolvedValueOnce({status:'end_before_break'} as never);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Zeit beenden'}));});
  expect(screen.getByRole('alert')).toHaveTextContent('Die Endzeit liegt vor einer erfassten Pause');
  const pending={status:'committed',timeRecordId:other,idempotentRetry:false,requiredWalFile:'000000010000000000000002',offsiteArchived:false};
  save.mockResolvedValueOnce(pending as never).mockResolvedValueOnce({...pending,idempotentRetry:true,offsiteArchived:true} as never);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Zeit beenden'}));});
  expect(screen.getByRole('status')).toHaveTextContent('Wird gesichert …');expect(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/)).toBeDisabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
  expect(save.mock.calls.at(-1)).toEqual(save.mock.calls.at(-2));
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({kind:'stop',targetMembershipId:other,stoppedAt:'2026-09-21T12:00:00.000Z',reason:'Vergessen'}));
  expect(screen.queryByRole('form',{name:'Zeit beenden'})).not.toBeInTheDocument();
 } finally {vi.useRealTimers();}
});
it('D-078 limits archive polling to three minutes and cancels it when the form unmounts',async()=>{
 vi.useFakeTimers();
 try {
  const {save,unmount}=show('administrator',other,{...record,status:'started',stoppedAt:null});
  fireEvent.click(screen.getByRole('button',{name:'Beenden'}));fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Vergessen'}});
  save.mockResolvedValue({status:'committed',timeRecordId:other,idempotentRetry:true,requiredWalFile:'000000010000000000000002',offsiteArchived:false} as never);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Zeit beenden'}));});
  await act(async()=>{await vi.advanceTimersByTimeAsync(180000);});
  expect(screen.getByRole('status')).toHaveTextContent('Noch nicht extern gesichert — bitte später prüfen');
  const count=save.mock.calls.length;await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});expect(save).toHaveBeenCalledTimes(count);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Erneut prüfen'}));});unmount();
  const after=save.mock.calls.length;await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});expect(save).toHaveBeenCalledTimes(after);
 } finally {vi.useRealTimers();}
});
it('T-069 shows the administration mark to the employee and keeps offline stopping disabled',()=>{
 show('employee',own,{...record,stoppedVia:'administration',details:{...record.details!,administrationStop:{at:'2026-09-21T10:00:00.000Z',reason:'Stopp vergessen'}}});
 expect(screen.getByText(/Von der Verwaltung beendet.*Stopp vergessen/)).toBeInTheDocument();
 cleanup();vi.spyOn(navigator,'onLine','get').mockReturnValue(false);show('administrator',other,{...record,status:'started',stoppedAt:null});
 expect(screen.getByRole('button',{name:'Beenden'})).toBeDisabled();expect(screen.getByText(/um die Zeit zu beenden/)).toBeInTheDocument();
});
it('T-069 stop form has no axe violations',async()=>{
 show('administrator',other,{...record,status:'started',stoppedAt:null});fireEvent.click(screen.getByRole('button',{name:'Beenden'}));
 expect((await axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});
it('T-069 validates archive metadata and details v2 representation at the HTTP boundary',async()=>{
 const pending={status:'committed',timeRecordId:other,idempotentRetry:false,requiredWalFile:'000000010000000000000002',offsiteArchived:false};
 const fetcher=vi.fn<typeof fetch>(async()=>Response.json(pending));const api=new AdminWebApiClient(fetcher);
 const request={expectedMembershipId:own,targetMembershipId:other,timeRecordId:other,expectedRowVersion:1,commandId:own,stoppedAt:record.stoppedAt,reason:'Vergessen'};
 expect(await api.stopTime('token',request)).toEqual({status:'succeeded',value:pending});expect(fetcher.mock.lastCall?.[0]).toBe('/v1/time-records/stop');
 fetcher.mockResolvedValueOnce(Response.json({status:'conflict'},{status:409}));expect(await api.stopTime('token',request)).toEqual({status:'succeeded',value:{status:'conflict'}});
 fetcher.mockResolvedValueOnce(Response.json({status:'committed',timeRecordId:other,idempotentRetry:false}));expect(await api.stopTime('token',request)).toEqual({status:'invalid_response'});
 const current={...page,records:[{...record,stoppedVia:'administration',details:{...record.details!,administrationStop:{at:'2026-09-21T10:00:00.000Z',reason:'Vergessen'}}}]};
 fetcher.mockResolvedValueOnce(Response.json(current));expect(await api.ownTime('token',{expectedMembershipId:own,cursor:null,limit:20})).toMatchObject({status:'succeeded',value:current});
});

it('T-062 manager stops own running time and keeps boundary rejection visible',async()=>{
 const {save}=show('standortleitung',own,{...record,status:'started',stoppedAt:null});
 fireEvent.click(screen.getByRole('button',{name:'Beenden'}));fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Vergessen'}});
 save.mockResolvedValueOnce({status:'authority_rejected'} as never);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Zeit beenden'}));});
 expect(save).toHaveBeenCalledWith(expect.objectContaining({kind:'stop',targetMembershipId:own}));
 expect(screen.getByRole('alert')).toHaveTextContent('Die Berechtigung zum Beenden fehlt.');
 expect(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/)).toHaveValue('Vergessen');
});

it.each(['administrator','standortleitung'] as const)('D-092 %s uses the target person choices, not the actor choices',async role=>{
 const {save}=show(role,other);fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));
 await screen.findByRole('option',{name:'Zielperson C2'});expect(screen.queryByRole('option',{name:'Werkstatt'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Kunde oder Projekt'),{target:{value:`customer:${other}`}});fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Zielperson'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({kind:'backfill',targetMembershipId:other,target:expect.objectContaining({targetId:other})})));
});

it('D-092 sends both memberships to the dedicated endpoint and rejects extra target data',async()=>{
 const page={status:'ready',targets:[{targetType:'customer',targetId:other,displayName:'C2'}],nextCursor:null};
 const fetcher=vi.fn<typeof fetch>(async()=>Response.json(page));const api=new AdminWebApiClient(fetcher);
 const request={expectedMembershipId:own,targetMembershipId:other,limit:50,cursor:null};
 expect(await api.backfillTargets('token',request)).toEqual({status:'succeeded',value:{targets:page.targets,nextCursor:null}});
 expect(fetcher.mock.lastCall?.[0]).toBe('/v1/administration/time-records/backfill-targets/query');expect(JSON.parse(String(fetcher.mock.lastCall?.[1]?.body))).toEqual(request);
 fetcher.mockResolvedValueOnce(Response.json({...page,targets:[{...page.targets[0],private:'hidden'}]}));
 expect(await api.backfillTargets('token',request)).toEqual({status:'invalid_response'});
});

it('T079 displays minutes and preserves exact unchanged correction instants',async()=>{
 const precise={...record,startedAt:'2026-09-21T08:00:37.123Z',stoppedAt:'2026-09-21T09:00:48.987Z'};
 const {save}=show('administrator',other,precise);fireEvent.click(screen.getByRole('button',{name:'Ändern'}));
 expect(screen.getByLabelText('Von')).toHaveValue('2026-09-21T10:00');
 expect(screen.getByLabelText('Bis')).toHaveValue('2026-09-21T11:00');
 expect(screen.getByLabelText('Von')).toHaveAttribute('step','60');
 fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Nur Grund'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({startedAt:precise.startedAt,stoppedAt:precise.stoppedAt})));
});
it.each(['2026-10-25T02:30','2027-03-28T02:30'])('T079 rejects an edited DST minute %s and retains the input',async value=>{
 const {save}=show('administrator',other);fireEvent.click(screen.getByRole('button',{name:'Ändern'}));
 fireEvent.change(screen.getByLabelText('Von'),{target:{value}});fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Prüfung'}});
 fireEvent.click(screen.getByRole('button',{name:'Speichern'}));expect(save).not.toHaveBeenCalled();expect(screen.getAllByRole('alert').every(node=>node.textContent?.includes('Zeitumstellung'))).toBe(true);expect(screen.getByLabelText('Von')).toHaveValue(value);
});

it.each(['employee','administrator','standortleitung'] as const)('T-088 %s confirms a required reason, preserves errors and closes after success',async role=>{
 const {save}=show(role);fireEvent.click(screen.getByRole('button',{name:'Zeiteintrag löschen'}));
 fireEvent.click(screen.getByRole('button',{name:'Löschen'}));expect(save).not.toHaveBeenCalled();
 expect(screen.getByRole('alert')).toHaveTextContent('Wählen Sie einen Grund');
 fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'other'}});
 fireEvent.click(screen.getByRole('button',{name:'Löschen'}));expect(save).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Kurze Begründung'),{target:{value:'Doppelt nachgetragen'}});
 save.mockResolvedValueOnce({status:'review_open'} as never);fireEvent.click(screen.getByRole('button',{name:'Löschen'}));
 await screen.findByText(/unter „Zeiten prüfen“ geklärt/);expect(screen.getByLabelText('Kurze Begründung')).toHaveValue('Doppelt nachgetragen');
 fireEvent.click(screen.getByRole('button',{name:'Löschen'}));
 await waitFor(()=>expect(save).toHaveBeenLastCalledWith(expect.objectContaining({kind:'void',reasonCode:'other',reasonText:'Doppelt nachgetragen'})));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Löschen'})).not.toBeInTheDocument());
});
it('T-088 hides cancellation for running or unauthorized entries and reports offline without sending',async()=>{
 show('employee',own,{...record,status:'started',stoppedAt:null});expect(screen.queryByRole('button',{name:'Zeiteintrag löschen'})).not.toBeInTheDocument();cleanup();
 show('employee',other);expect(screen.queryByRole('button',{name:'Zeiteintrag löschen'})).not.toBeInTheDocument();cleanup();
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);const {save}=show('employee');fireEvent.click(screen.getByRole('button',{name:'Zeiteintrag löschen'}));
 fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'misscan'}});fireEvent.click(screen.getByRole('button',{name:'Löschen'}));
 expect(save).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('Nur online');
 fireEvent.click(screen.getByRole('button',{name:'Abbrechen'}));expect(screen.queryByRole('button',{name:'Löschen'})).not.toBeInTheDocument();
});
it('T-088 historical rows carry who/when/why, no duration, and cannot be edited',async()=>{
 const state={role:'employee',membershipId:own,availableSections:[],workTargets:{status:'ready',value:[]}} as unknown as Extract<AdminWebState,{status:'ready'}>;
 const loadVoidedTime=vi.fn(async()=>({status:'ready',records:[{timeRecordId:other,targetDisplayName:'Gelöschter Kunde',startedAt:record.startedAt,stoppedAt:record.stoppedAt,voidedAt:'2026-09-21T10:00:00.000Z',actorDisplayName:'Testperson',reasonCode:'misscan',reasonText:null}]}));
 const capability={loadVoidedTime,loadWorkTargets:async()=>{}} as unknown as AdminWebCapability;
 render(<TimeEditingProvider state={state} administration={capability}><TimeCalendar value={{...page,records:[]}} month="2026-09" onMonthChange={()=>{}} onRefresh={()=>{}}/></TimeEditingProvider>);
 await screen.findByText(/Gelöscht am .* von Testperson · Fehlscan/);
 const row=screen.getByText('Gelöschter Kunde').closest('li')!;expect(row).not.toHaveTextContent(/Arbeitszeit|Pause|1:00|1 h/);expect(row.querySelector('button')).toBeNull();
 expect(loadVoidedTime).toHaveBeenCalledWith(own,'2026-09-20T22:00:00.000Z',page.windowEndedAt);
});
it('T-088 validates closed requests and preserves meaningful conflict responses',async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>Response.json({status:'already_voided'},{status:409})),api=new AdminWebApiClient(fetcher);
 const request={expectedMembershipId:own,commandId:other,timeRecordId:other,reasonCode:'duplicate',reasonText:null};
 expect(await api.voidTime('token',request)).toEqual({status:'succeeded',value:{status:'already_voided'}});
 expect(fetcher.mock.lastCall?.[0]).toBe('/v1/time-records/void');expect(await api.voidTime('token',{...request,role:'administrator'})).toEqual({status:'invalid_response'});
});

it.each(['backfill','correct','stop','comment'] as const)('T101 %s shows missing fields before contacting the capability',async kind=>{
 const {save}=show('administrator',kind==='stop'?other:own,kind==='stop'?{...record,status:'started',stoppedAt:null}:record);
 fireEvent.click(screen.getByRole('button',{name:kind==='backfill'?'Zeit hinzufügen':kind==='correct'?'Ändern':kind==='stop'?'Beenden':'Kommentar schreiben'}));
 const button=screen.getByRole('button',{name:kind==='stop'?'Zeit beenden':'Speichern'}),form=button.closest('form')!;
 const fields=Array.from(form.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('[required]'));
 for(const field of fields)fireEvent.change(field,{target:{value:''}});fireEvent.click(button);expect(save).not.toHaveBeenCalled();expect(fields[0]).toHaveFocus();
 for(const field of fields){expect(field).toHaveAttribute('aria-invalid','true');expect(document.getElementById(field.getAttribute('aria-describedby')!.split(' ').at(-1)!)).toHaveAttribute('role','alert');}
 for(const field of fields){const value=field instanceof HTMLSelectElement?`customer:${own}`:field.type==='date'?'2026-09-20':field.type==='time'?'10:00':field.type==='datetime-local'?'2026-09-20T10:00':'Berichtigt';fireEvent.change(field,{target:{value}});}
 for(const field of fields)expect(field).not.toHaveAttribute('aria-invalid');
});

it('T101 review: valid date is preserved when Von is missing',()=>{
 const {save}=show('employee');fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));fireEvent.change(screen.getByLabelText('Kunde oder Projekt'),{target:{value:`customer:${own}`}});const date=screen.getByLabelText('Datum'),clock=screen.getByLabelText('Von');fireEvent.change(clock,{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));expect(save).not.toHaveBeenCalled();expect(date).not.toHaveAttribute('aria-invalid');expect(clock).toHaveAttribute('aria-invalid','true');expect(clock).toHaveFocus();
});
it.each([
 ['2026-09-22T11:01','Höchstens 24 Stunden.'],
 ['2099-09-21T11:00','Das Ende liegt in der Zukunft.'],
])('T106: correction end %s is explained at the field before sending',async(end,message)=>{
 const {save}=show('administrator');
 fireEvent.click(screen.getByRole('button',{name:'Ändern'}));
 fireEvent.change(screen.getByLabelText('Bis'),{target:{value:end}});
 fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'Beleg geprüft'}});
 fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 expect(save).not.toHaveBeenCalled();
 expect(screen.getByText(message)).toBeInTheDocument();
 expect(screen.getByLabelText('Bis')).toHaveAttribute('aria-invalid','true');
});
it('T106: a control-only required reason is explained at the field',()=>{
 const {save}=show('administrator');fireEvent.click(screen.getByRole('button',{name:'Ändern'}));
 fireEvent.change(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/),{target:{value:'\u00a0\t\u0001'}});
 fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 expect(save).not.toHaveBeenCalled();expect(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/)).toHaveAttribute('aria-invalid','true');
});
it('T107 opens the existing administrative stop directly from the person status',async()=>{
 const {default:PersonView}=await import('../src/views/PersonView');
 const entry={...record,status:'started' as const,stoppedAt:null,stoppedVia:null};
 const state={status:'ready',role:'administrator',membershipId:own,availableSections:['time_records'],managedPeople:{status:'ready',value:{people:[{membershipId:other,displayName:'Erika Beispiel'}],nextCursor:null}},calendar:{status:'ready',targetMembershipId:other,month:'2026-09',value:{...page,activeRecord:entry}}} as unknown as Extract<AdminWebState,{status:'ready'}>;
 const administration={getState:()=>state,saveTimeEdit:vi.fn(),loadPersonTime:vi.fn(),loadWorkTargets:vi.fn()} as unknown as AdminWebCapability;
 render(<PersonView state={state} administration={administration} route={{area:'beschaeftigte',personId:other,month:'2026-09'} as never} navigate={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Zeit beenden'}));
 expect(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/)).toBeDefined();
 expect(screen.getByText(/Erika Beispiel · Werkstatt ·/)).toBeDefined();
});
it('T107 names the affected entry in the deletion sheet',async()=>{
 show('employee');fireEvent.click(screen.getByRole('button',{name:'Zeiteintrag löschen'}));
 expect(screen.getByText(/Sie selbst · Werkstatt ·.*21\.09\.2026.*10:00.*11:00/)).toBeDefined();
});
