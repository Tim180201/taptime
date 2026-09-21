// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import { afterEach,expect,it,vi } from 'vitest';
import { TimeCalendar } from '../src/TimeCalendar';
import { TimeEditingProvider } from '../src/TimeEditingControls';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import type { AdminWebCapability,AdminWebState } from '../src/contracts';
import type { SafeOwnTimeRecord } from '@taptime/mobile-work-contract';
const own='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const record:SafeOwnTimeRecord={timeRecordId:other,source:'recovered',targetType:'customer',targetDisplayName:'Werkstatt',status:'stopped',startedAt:'2026-09-21T08:00:00.000Z',stoppedAt:'2026-09-21T09:00:00.000Z',startedVia:null,stoppedVia:null,details:{origin:'backfilled',baseRowVersion:0,effectiveRevisionNumber:2,comment:'Vor Ort',changed:true,change:{at:'2026-09-21T10:00:00.000Z',reason:'Berichtigt',actor:'administration'},overlapsAnotherRecord:true}};
const page={activeRecord:null,records:[record],nextCursor:null,windowStartedAt:'2026-09-01T00:00:00.000Z',windowEndedAt:'2026-09-21T12:00:00.000Z'};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function show(role:'employee'|'administrator'|'standortleitung',target=own,entry=record) {
 const save=vi.fn(async()=>({status:'committed' as const,timeRecordId:other,idempotentRetry:false}));
 const state={role,membershipId:own,timeEditBusy:false,workTargets:{status:'ready',value:[{targetType:'customer',targetId:own,displayName:'Werkstatt'}]}} as Pick<Extract<AdminWebState,{status:'ready'}>,'role'|'membershipId'|'timeEditBusy'|'workTargets'>;
 const capability={saveTimeEdit:save,loadWorkTargets:vi.fn(async()=>{})} as unknown as AdminWebCapability;
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
it.each(['employee','administrator'] as const)('%s comments only their own entry',async role=>{
 const {save}=show(role);fireEvent.click(screen.getByRole('button',{name:'Kommentar schreiben'}));fireEvent.change(screen.getByLabelText('Kommentar'),{target:{value:'Meine Notiz'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({kind:'comment',comment:'Meine Notiz'})));
 cleanup();show(role,other);expect(screen.queryByRole('button',{name:'Kommentar schreiben'})).not.toBeInTheDocument();
});
it('administrator corrects completed time with the original versions and sees the running hint',async()=>{
 const {save}=show('administrator',other);fireEvent.click(screen.getByRole('button',{name:'Ändern'}));fireEvent.change(screen.getByLabelText('Grund'),{target:{value:'Prüfung'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({kind:'correct',record,reason:'Prüfung'})));
 cleanup();show('administrator',other,{...record,status:'started',stoppedAt:null});expect(screen.queryByRole('button',{name:'Ändern'})).not.toBeInTheDocument();expect(screen.getByText('Läuft noch — erst beenden, dann ändern')).toBeInTheDocument();
});
it('administrator backfills another person with reason, while managers only read',async()=>{
 const {save}=show('administrator',other);fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));fireEvent.change(screen.getByLabelText('Kunde oder Projekt'),{target:{value:`customer:${own}`}});fireEvent.change(screen.getByLabelText('Grund'),{target:{value:'Tag vergessen'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({kind:'backfill',targetMembershipId:other,reason:'Tag vergessen',comment:null})));
 cleanup();show('standortleitung',other);for(const name of ['Zeit hinzufügen','Ändern','Kommentar schreiben']) expect(screen.queryByRole('button',{name})).not.toBeInTheDocument();
});
it.each([['nfc','gescannt'],['manual','manuell'],['backfilled','nachgetragen'],['recovered','wiederhergestellt']] as const)('shows %s provenance and correction/comment/overlap details', (origin,label)=>{
 show('employee',own,{...record,details:{...record.details!,origin}});expect(screen.getByText(new RegExp(label))).toBeInTheDocument();expect(screen.getByText(/Geändert.*Berichtigt/)).toBeInTheDocument();expect(screen.getByText('überschneidet sich')).toBeInTheDocument();expect(screen.getByText('Kommentar: Vor Ort')).toBeInTheDocument();
});
it('keeps writes visibly disabled offline',()=>{
 vi.spyOn(navigator,'onLine','get').mockReturnValue(false);show('employee');expect(screen.getByRole('button',{name:'Zeit hinzufügen'})).toBeDisabled();expect(screen.getByRole('button',{name:'Kommentar schreiben'})).toBeDisabled();expect(screen.getAllByText(/Nur online möglich/).length).toBeGreaterThan(0);
});
it.each(['employee','administrator'] as const)('has no axe violations in the open %s backfill form',async role=>{
 show(role);fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));expect((await axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});
it('explicitly negotiates details, validates them strictly and keeps v3/v4 selectable',async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>Response.json(page));const api=new AdminWebApiClient(fetcher);
 expect(await api.ownTime('token',{expectedMembershipId:own,cursor:null,limit:20})).toMatchObject({status:'succeeded'});
 expect(fetcher.mock.calls[0]![1]?.headers).toMatchObject({Accept:'application/vnd.taptime.time-details.v2+json'});
 fetcher.mockResolvedValueOnce(Response.json({...page,records:[{...record,details:{...record.details,secret:'hidden'}}]}));
 expect(await api.ownTime('token',{expectedMembershipId:own,cursor:null,limit:20})).toEqual({status:'invalid_response'});
 for(const version of [3,4] as const){fetcher.mockResolvedValueOnce(new Response('csv',{headers:{'content-type':'text/csv','content-disposition':`attachment; filename="taptime-time-entries_v${version}_20260901T000000Z_20261001T000000Z.csv"`}}));expect(await api.exportTimeEntries('token',own,page.windowStartedAt,page.windowEndedAt,version)).toMatchObject({status:'succeeded'});expect(fetcher.mock.lastCall?.[0]).toBe(`/v${version}/time-entries/export`);}
});

it.each(['comment','correct'] as const)('has no axe violations in the open %s form',async kind=>{
 show(kind==='comment'?'employee':'administrator');fireEvent.click(screen.getByRole('button',{name:kind==='comment'?'Kommentar schreiben':'Ändern'}));expect((await axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});
it('keeps Berlin DST gaps invalid and overnight dates explicit',async()=>{
 const {save}=show('employee');fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));fireEvent.change(screen.getByLabelText('Kunde oder Projekt'),{target:{value:`customer:${own}`}});
 fireEvent.change(screen.getByLabelText('Datum'),{target:{value:'2026-03-29'}});fireEvent.change(screen.getByLabelText('Von'),{target:{value:'02:30'}});fireEvent.click(screen.getByRole('button',{name:'Speichern'}));expect(screen.getByRole('alert')).toHaveTextContent('Zeitumstellung');expect(save).not.toHaveBeenCalled();
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
