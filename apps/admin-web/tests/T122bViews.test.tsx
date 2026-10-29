// @vitest-environment jsdom
import {afterEach,beforeAll,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {App} from '../src/App';
import ReviewsView from '../src/views/ReviewsView';
import TimeRecordsView from '../src/views/TimeRecordsView';
import EmployeesView from '../src/views/EmployeesView';
import {TimeEditingProvider,AddTimeControl,TimeRecordControls} from '../src/TimeEditingControls';
import {defaultRoute} from '../src/navigation';
import {stateSearch} from './searchFixtures';
import type {AdminWebCapability,AdminWebState,ReviewDayState,SafeReviewItem} from '../src/contracts';
type Ready=Extract<AdminWebState,{status:'ready'}>;
const org={id:'30000000-0000-4000-8000-000000000001',name:'Beispielbetrieb'};
const target={targetType:'customer' as const,targetId:'40000000-0000-4000-8000-000000000001',displayName:'Werkstatt'};
export function state(overrides:Partial<Ready>={}):Ready{return {status:'ready',membershipId:'70000000-0000-4000-8000-000000000001',role:'administrator',projection:{organization:org,customers:[],nfcTags:[],nextCursor:null,customersComplete:true,nfcTagsComplete:true},employeeProjection:{organization:org,employeeMemberships:[],nextCursor:null},availableSections:['employees','setup','manual_capture','own_time','review_items','time_export'],managementScope:{kind:'organization'},selectedLocation:null,locationsEnabled:false,assignableLocations:[],creating:false,creatingEmployee:false,invitation:null,reassignmentIntent:null,reassigning:false,locationSetup:{locations:[],memberships:[],workTargets:[],activationGaps:[]},locationSetupBusy:false,timeRecords:[],timeRecordsNextCursor:null,reviewItems:[],reviewItemsNextCursor:null,sections:{setup:{status:'ready'},employees:{status:'ready'},timeRecords:{status:'ready'},reviewItems:{status:'ready'}},timeWindow:{fromInclusive:'2026-10-01T00:00:00.000Z',toExclusive:'2026-10-15T00:00:00.000Z'},timeReviewBusy:false,correctionIntent:null,adjudicationIntent:null,notice:null,completedAction:null,workTargets:{status:'ready',value:[target]},calendar:{status:'ready',targetMembershipId:null,month:'2026-10',value:{activeRecord:null,records:[],nextCursor:null,windowStartedAt:'2026-10-01T00:00:00.000Z',windowEndedAt:'2026-10-15T00:00:00.000Z'}},manual:{busy:false,pending:false,message:null},...overrides} as Ready;}
function capability(s:Ready){return {getState:()=>s,subscribe:()=>()=>{},selectLocation:vi.fn(async()=>{}),refresh:vi.fn(async()=>{}),signOut:vi.fn(),refreshLocationSetup:vi.fn(),refreshManagedPeople:vi.fn(),loadOwnTime:vi.fn(),loadWorkTargets:vi.fn(),captureManual:vi.fn(),querySearch:stateSearch(()=>s),createCustomer:vi.fn(async()=>{}),dismissInvitation:vi.fn()} as unknown as AdminWebCapability;}

afterEach(()=>{cleanup();window.history.replaceState(null,'','/');vi.useRealTimers();});
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
const item:SafeReviewItem={reviewItemId:'review',employeeMembershipId:'member',source:'offline_v2',employeeDisplayName:'Alex Berger',targetType:'customer',targetDisplayName:'Werkstatt',triggerType:'nfc',occurredAt:'2026-07-20T09:00:00.000Z',reviewReason:'future_reason',deviceSequence:1,predecessorBlocked:false};
it.each([20,100])('T135: loads %i cases in batches of at most twenty, without a read per person',async count=>{
 const items=Array.from({length:count},(_,index)=>({...item,reviewItemId:`review-${index}`,employeeMembershipId:`member-${index}`,employeeDisplayName:`Person ${index}`}));
 let s=state({reviewItems:items});
 const ready=(id:string)=>({reviewItemId:id,status:'ready' as const,value:{records:[],activeRecord:null,nextCursor:null,windowStartedAt:'2026-07-19T22:00:00.000Z',windowEndedAt:'2026-07-20T22:00:00.000Z'}});
 const single=vi.fn(async(id:string)=>{s={...s,reviewDay:ready(id)};});
 const batch=vi.fn(async(ids:readonly string[])=>Object.fromEntries(ids.map(id=>[id,ready(id)])));
 render(<ReviewsView state={s} administration={{...capability(s),getState:()=>s,loadReviewDay:single,loadReviewDays:batch} as AdminWebCapability}/>);
 await waitFor(()=>expect(screen.getAllByText('Keine Arbeitszeiten an diesem Tag.')).toHaveLength(count));
 // Network work follows the batch boundary, not the number of people in the page.
 expect(single.mock.calls.length+batch.mock.calls.length).toBeLessThanOrEqual(Math.ceil(count/20));
 expect(single).not.toHaveBeenCalled();
 expect(batch.mock.calls.flatMap(([ids])=>ids)).toEqual(items.map(row=>row.reviewItemId));
 expect(batch.mock.calls.every(([ids])=>ids.length<=20)).toBe(true);
});
it.each(['offline_v2','offline_skip','break'] as const)('T135: closes %s with a note when day times are unreadable',source=>{
 const row={...item,...(source==='break'?{targetType:'break' as const}:{source})};
 const s=state({reviewItems:[row],reviewDay:{reviewItemId:row.reviewItemId,status:'unavailable',value:null,message:'Die Tageszeiten konnten nicht vollständig geladen werden. Bitte versuchen Sie es erneut.'}});
 const prepareAdjudication=vi.fn();
 render(<ReviewsView state={s} administration={{...capability(s),prepareAdjudication}}/>);
 fireEvent.click(screen.getByRole('button',{name:'So lassen'}));
 expect(screen.getByText(/Tageszeiten konnten nicht vollständig geladen werden/)).toBeVisible();
 fireEvent.change(screen.getByRole('textbox',{name:'Begründung'}),{target:{value:'Mit der Person geklärt.'}});
 const prepare=screen.getByRole('button',{name:'Änderung prüfen'});
 expect(prepare).toBeEnabled();fireEvent.click(prepare);
 expect(prepareAdjudication).toHaveBeenCalledWith(row.reviewItemId,'no_time_record_change',null,null,null,'Mit der Person geklärt.');
});
it('T135: appending cases loads only new days and retry reloads only the failed case',async()=>{
 const first={...item,reviewItemId:'first'},second={...item,reviewItemId:'second'};
 let s=state({reviewItems:[first]});
 const ready=(id:string)=>({reviewItemId:id,status:'ready' as const,value:{records:[],activeRecord:null,nextCursor:null,windowStartedAt:'2026-07-19T22:00:00.000Z',windowEndedAt:'2026-07-20T22:00:00.000Z'}});
 const batch=vi.fn<NonNullable<AdminWebCapability['loadReviewDays']>>(async ids=>Object.fromEntries(ids.map(id=>[id,ready(id)])))
  .mockResolvedValueOnce({first:{reviewItemId:'first',status:'unavailable',value:null,message:'Tageszeiten fehlen.'}});
 const cap={...capability(s),getState:()=>s,loadReviewDays:batch};
 const view=render(<ReviewsView state={s} administration={cap}/>);
 await screen.findByText('Tageszeiten fehlen.');
 s={...s,reviewItems:[first,second]};view.rerender(<ReviewsView state={s} administration={cap}/>);
 await screen.findByText('Keine Arbeitszeiten an diesem Tag.');
 expect(batch.mock.calls.map(([ids])=>ids)).toEqual([['first'],['second']]);
 fireEvent.click(screen.getByRole('button',{name:'Tageszeiten erneut laden'}));
 await waitFor(()=>expect(screen.getAllByText('Keine Arbeitszeiten an diesem Tag.')).toHaveLength(2));
 expect(batch.mock.calls.map(([ids])=>ids)).toEqual([['first'],['second'],['first']]);
});
it('renders human cases and unknown-only support code, with outcomes and no repeated decision select',()=>{
 const s=state({reviewItems:[item],reviewDay:{reviewItemId:'review',status:'ready',value:{records:[],activeRecord:null,nextCursor:null,windowStartedAt:'2026-07-19T22:00:00Z',windowEndedAt:'2026-07-20T22:00:00Z'}}});
 const cap=capability(s);const view=render(<ReviewsView state={s} administration={cap}/>);
 expect(screen.getByText(/Alex Berger hat am 20.07.2026 um 11:00 erfasst/)).toBeVisible();
 expect(screen.getByText('Für Rückfragen: future_reason')).toHaveClass('review-support');
 fireEvent.click(screen.getByRole('button',{name:'So lassen'}));
 expect(screen.queryByRole('combobox',{name:'Entscheidung'})).toBeNull();
 expect(screen.getByRole('button',{name:'So lassen'})).toHaveClass('primary-action');
 expect(screen.getByRole('button',{name:'Ende nachtragen'})).toHaveClass('secondary');
 view.rerender(<ReviewsView state={{...s,reviewItems:[{...item,reviewReason:'http_400'}]}} administration={cap}/>);
 expect(screen.queryByText(/Für Rückfragen/)).toBeNull();
});
it('employees have one header, a month and no duplicate activity tile',async()=>{
 const s=state();render(<EmployeesView state={s} administration={capability(s)} navigate={vi.fn()}/>);
 expect(screen.getByRole('heading',{level:1,name:'Mitarbeiter'})).toBeVisible();
 expect(screen.queryByRole('article',{name:'Gerade aktiv'})).toBeNull();
 expect(within(screen.getByRole('banner')).getByRole('button',{name:'+ Mitarbeiter einladen'})).toBeVisible();
});
it('payroll has a selected month, honest file name, outcomes links and no correction form',()=>{
 const s=state({availableSections:['time_records','time_export','review_items'],reviewItems:[item]});
 render(<TimeRecordsView state={s} administration={capability(s)} route={defaultRoute('lohnexport')} navigate={vi.fn()}/>);
 expect(screen.getByRole('button',{name:/^Monat: /})).toBeVisible();
 expect(screen.getByText(/^Monatsübersicht \(CSV\):/)).toBeVisible();
 fireEvent.change(screen.getByLabelText('Datei'),{target:{value:'4'}});
 expect(screen.getByText('Einzelzeiten (CSV): alle Einträge des Monats, unabhängig von den Filtern.')).toBeVisible();
 expect(screen.getByRole('button',{name:'CSV herunterladen'})).toBeVisible();
 expect(screen.queryByText('Abgeschlossene Arbeitszeit korrigieren')).toBeNull();
 expect(screen.getByRole('link',{name:/offener Fall/})).toHaveAttribute('href','/pruefungen');
});
it('backfill uses one searchable list, no duplicate select',async()=>{
 const s=state(),cap={...capability(s),saveTimeEdit:vi.fn()};
 render(<TimeEditingProvider state={s} administration={cap}><AddTimeControl day="2026-10-15"/></TimeEditingProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));
 await screen.findByRole('button',{name:'Werkstatt'});
 expect(screen.queryByRole('combobox',{name:'Kunde oder Projekt'})).toBeNull();
 expect(screen.getByRole('searchbox')).toBeVisible();
 expect(screen.queryByText(/Liegt „bis“/)).toBeNull();
 fireEvent.change(screen.getByLabelText('Bis'),{target:{value:'07:00'}});
 expect(screen.getByText('Endet am 16.10.2026.')).toBeVisible();
});
it('discards a batch that finishes after the location changes, even if the case IDs stay equal',async()=>{
 let finish!:(value:Readonly<Record<string,ReviewDayState>>)=>void;
 let s=state({reviewItems:[item]});
 const load=vi.fn<NonNullable<AdminWebCapability['loadReviewDays']>>()
  .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({});
 const cap={...capability(s),getState:()=>s,loadReviewDays:load};
 const view=render(<ReviewsView state={s} administration={cap}/>);
 s={...s,selectedLocation:{id:'other',name:'Süd'}};view.rerender(<ReviewsView state={s} administration={cap}/>);
 finish({review:{reviewItemId:'review',status:'ready',value:{records:[],activeRecord:null,nextCursor:null,windowStartedAt:'2026-07-19T22:00:00.000Z',windowEndedAt:'2026-07-20T22:00:00.000Z'}}});
 await screen.findByRole('button',{name:'Tageszeiten erneut laden'});
 expect(screen.queryByText('Keine Arbeitszeiten an diesem Tag.')).toBeNull();expect(load).toHaveBeenCalledTimes(2);
});
it.each(['Zeit ändern','Ende nachtragen'])('T135: %s still requires day times and rejects a direct form submission',label=>{
 const s=state({reviewItems:[item]}),prepareAdjudication=vi.fn();
 render(<ReviewsView state={s} administration={{...capability(s),prepareAdjudication}}/>);
 fireEvent.click(screen.getByRole('button',{name:label}));
 const button=screen.getByRole('button',{name:'Änderung prüfen'});
 expect(button).toBeDisabled();fireEvent.submit(button.closest('form')!);expect(prepareAdjudication).not.toHaveBeenCalled();
});
it('T135: a note-only decision warns while day times are still loading',()=>{
 const s=state({reviewItems:[item]});render(<ReviewsView state={s} administration={capability(s)}/>);
 fireEvent.click(screen.getByRole('button',{name:'So lassen'}));
 expect(screen.getByRole('note')).toHaveTextContent('Die Tageszeiten fehlen.');
 expect(screen.getByRole('button',{name:'Änderung prüfen'})).toBeEnabled();
});
it('exports only the selected complete month, with format choice independent of display filters',()=>{
 const month='2026-10',route={...defaultRoute('lohnexport'),month,status:'laufend' as const,captureType:'gescannt' as const};
 let s=state({availableSections:['time_records','time_export']});
 const exportTimeRecords=vi.fn(),cap={...capability(s),exportTimeRecords};
 const view=render(<TimeRecordsView state={s} administration={cap} route={route} navigate={vi.fn()}/>);
 expect(screen.getByRole('button',{name:'CSV herunterladen'})).toBeDisabled();
 s={...s,timeWindow:{fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-31T23:00:00.000Z'}};
 view.rerender(<TimeRecordsView state={s} administration={cap} route={route} navigate={vi.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'CSV herunterladen'}));expect(exportTimeRecords).toHaveBeenLastCalledWith(5);
 fireEvent.change(screen.getByLabelText('Datei'),{target:{value:'4'}});
 fireEvent.click(screen.getByRole('button',{name:'CSV herunterladen'}));expect(exportTimeRecords).toHaveBeenLastCalledWith(4);
 fireEvent.change(screen.getByLabelText('Datei'),{target:{value:'3'}});
 fireEvent.click(screen.getByRole('button',{name:'CSV herunterladen'}));expect(exportTimeRecords).toHaveBeenLastCalledWith(3);
 view.rerender(<TimeRecordsView state={s} administration={cap} route={{...route,month:'2026-11'}} navigate={vi.fn()}/>);
 expect(screen.getByRole('button',{name:'CSV herunterladen'})).toBeDisabled();
});

it('PO: payroll filter groups have visible labels before their choices',()=>{
 const s=state({availableSections:['time_records','time_export'],timeWindow:{fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-31T23:00:00.000Z'}});
 render(<TimeRecordsView state={s} administration={capability(s)} route={{...defaultRoute('lohnexport'),month:'2026-10'}} navigate={vi.fn()}/>);
 for(const label of ['Status','Erfasst mit']){
  const group=screen.getByRole('group',{name:label}),caption=within(group).getByText(label);
  expect(caption).toBeVisible();expect(caption).toHaveClass('filter-group-label');
  expect(caption.compareDocumentPosition(within(group).getByRole('button',{name:'Alle'}))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 }
});
it('PO: header fields keep hidden labels and the export format explains its value',()=>{
 const s=state({availableSections:['time_records','time_export']});
 render(<TimeRecordsView state={s} administration={capability(s)} route={defaultRoute('lohnexport')} navigate={vi.fn()}/>);
 expect(screen.getByRole('button',{name:/^Monat: /})).toHaveAttribute('aria-haspopup','dialog');
 expect(screen.getByLabelText('Datei').closest('label')?.querySelector('.sr-only')).toHaveTextContent('Datei');
 expect(within(screen.getByLabelText('Datei')).getAllByRole('option').map(option=>option.textContent)).toEqual(['Monatsübersicht','Einzelzeiten · Standard','Einzelzeiten · Früheres Format']);
});
