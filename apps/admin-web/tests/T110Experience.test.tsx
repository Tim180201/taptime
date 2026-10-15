import {stateSearch} from './searchFixtures';
// @vitest-environment jsdom
import { afterEach,beforeAll,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Overview, { nextSetupStep } from '../src/views/Overview';
import EmployeesView from '../src/views/EmployeesView';
import ReviewsView from '../src/views/ReviewsView';
import type { AdminWebCapability,AdminWebState,SafeReviewItem } from '../src/contracts';
import {defaultRoute} from '../src/navigation';
const id='12000000-0000-4000-8000-000000000001';
const member={id,displayName:'Anna',role:'standortleitung' as const,active:true,rowVersion:1,location:null};
const item:SafeReviewItem={employeeMembershipId:id,reviewItemId:id,employeeDisplayName:'Anna',source:'offline_v2',targetType:'customer',targetDisplayName:'Lesekreis',triggerType:'nfc',occurredAt:'2026-10-05T08:00:00.000Z',deviceSequence:2,predecessorBlocked:false,reviewReason:'capture_time_out_of_bounds'};
type Ready=Extract<AdminWebState,{status:'ready'}>;
function ready():{-readonly [K in keyof Ready]:Ready[K]} {return {status:'ready',role:'administrator',membershipId:'actor',managementScope:{kind:'organization'},locationsEnabled:false,selectedLocation:null,assignableLocations:[],availableSections:['setup','employees','time_records','manual_capture'],sections:{setup:{status:'ready'},employees:{status:'ready'},timeRecords:{status:'ready'},reviewItems:{status:'ready'}},projection:{organization:{id,name:'Betrieb'},customers:[{id,displayName:'Lesekreis',active:true}],nfcTags:[{id} as never],customersComplete:true,nfcTagsComplete:true,nextCursor:null},employeeProjection:{organization:{id,name:'Betrieb'},employeeMemberships:[member],nextCursor:null},locationSetup:{locations:[],memberships:[],workTargets:[],activationGaps:[]},locationSetupBusy:false,projects:[],projectsNextCursor:null,projectBusy:false,timeRecords:[{status:'stopped'} as never],timeRecordsNextCursor:null,reviewItems:[],reviewItemsNextCursor:null,timeWindow:{fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-06T12:00:00.000Z'},creating:false,creatingEmployee:false,invitation:null,reassignmentIntent:null,reassigning:false,timeReviewBusy:false,correctionIntent:null,adjudicationIntent:null,notice:null};}
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; });
afterEach(cleanup);
it('selects exactly the first missing prerequisite and disappears when complete',()=>{
 const state=ready();expect(nextSetupStep(state)).toBeNull();
 state.timeRecords=[];expect(nextSetupStep(state)?.text).toBe('Erfassen Sie die erste Arbeitszeit.');
 state.employeeProjection={...state.employeeProjection,employeeMemberships:[]};expect(nextSetupStep(state)?.text).toBe('Laden Sie Mitarbeiter ein.');
 state.projection={...state.projection,nfcTags:[]};expect(nextSetupStep(state)?.text).toBe('Richten Sie in der App Karten ein.');
 state.projection={...state.projection,customers:[]};expect(nextSetupStep(state)?.text).toBe('Legen Sie Kunden an.');
 state.locationSetup={...state.locationSetup!,memberships:[{...member,homeLocationId:null,workLocationIds:[],managementLocationIds:[]}]};expect(nextSetupStep(state)?.text).toBe('Weisen Sie den Standortleitungen ihren Bereich zu.');
 state.locationSetup={...state.locationSetup!,locations:[{id,displayName:'Nord',active:true,rowVersion:1}]};expect(nextSetupStep(state)?.text).toBe('Ordnen Sie Mitarbeiter und Kunden ihren Standorten zu und schalten Sie die Standorte ein.');
});
it('K5 skips unknown prerequisites, keeps administrator scope and avoids another location read',async()=>{
 const base=ready();base.projection={...base.projection,customers:[],nfcTags:[]};
 expect(nextSetupStep({...base,role:'standortleitung'})).toBeNull();
 for(const patch of [{locationSetup:null},{locationSetupBusy:true},{sections:{...base.sections,employees:{status:'loading'}}}])expect(nextSetupStep({...base,...patch} as Ready)?.label).toBe('Kunden anlegen');
 for(const patch of [{projectBusy:true},{projects:undefined},{projection:{...base.projection,customersComplete:false}}])expect(nextSetupStep({...base,...patch} as Ready)?.label).toBe('Karteneinrichtung ansehen');
 const administration={querySearch:stateSearch(()=>base),refreshManagedPeople:vi.fn(),refreshLocationSetup:vi.fn()} as unknown as AdminWebCapability;
 render(<Overview state={base} administration={administration} navigate={vi.fn()}/>);
 expect(await screen.findByText('Legen Sie Kunden an.')).toBeVisible();
 expect(administration.refreshLocationSetup).not.toHaveBeenCalled();
});
it('employee month chooser names the month, preserves filters and loads without the old cursor',()=>{
 const state=ready();const refreshManagedPeople=vi.fn();
 render(<EmployeesView state={state} administration={{querySearch:stateSearch(()=>state),refreshManagedPeople} as unknown as AdminWebCapability} navigate={vi.fn()} route={{...defaultRoute('beschaeftigte'),month:'2026-09'}}/>);
 expect(screen.getByRole('combobox',{name:'Monat'})).toBeVisible();
 expect(screen.getAllByRole('option')).toHaveLength(24);
 expect(refreshManagedPeople).toHaveBeenCalledWith(null,false,'2026-09',null);
 fireEvent.click(screen.getByRole('button',{name:'Zeit läuft'}));
 expect(refreshManagedPeople).toHaveBeenLastCalledWith(true,false,'2026-09',null);
});
it('role success links directly to that persons management assignments',async()=>{
 const state={...ready(),roleAssignmentMembershipId:id,notice:{kind:'success' as const,text:'Rolle geändert. Weisen Sie jetzt die Standorte zu, die diese Person verwalten darf.'}};
 render(<EmployeesView state={state} administration={{querySearch:stateSearch(()=>state)} as AdminWebCapability} navigate={vi.fn()}/>);
 fireEvent.click(screen.getByRole('tab',{name:'Zugänge'}));
 expect(screen.getByRole('link',{name:'Verwaltete Standorte zuweisen'})).toHaveAttribute('href',expect.stringContaining(`mitarbeiter=${id}`));
 fireEvent.click(await screen.findByRole('button',{name:'Rolle ändern'}));
 expect(screen.getByRole('dialog',{name:'Rolle ändern'})).toBeVisible();
 expect(screen.getAllByRole('radio')).toHaveLength(3);
});
it('review context precedes the three unchanged choices and shows the event and day times',()=>{
 const state={...ready(),reviewItems:[item],reviewDay:{status:'ready' as const,reviewItemId:id,value:{records:[{timeRecordId:'time',targetDisplayName:'Lesekreis',startedAt:'2026-10-05T07:00:00.000Z',stoppedAt:'2026-10-05T09:00:00.000Z'}],activeRecord:null,nextCursor:null,windowStartedAt:'2026-10-04T22:00:00.000Z',windowEndedAt:'2026-10-05T22:00:00.000Z'}}} as unknown as Ready;
 render(<ReviewsView state={state} administration={{} as AdminWebCapability}/>);
 expect(screen.getByText('Was heute dort steht')).toBeVisible();
 expect(screen.getByText(/09:00.*11:00/)).toBeVisible();
 expect(screen.getByText(/Der Zeitpunkt der Erfassung von Anna/)).toBeVisible();
 for(const name of ['Ende nachtragen','Zeit ändern','So lassen'])expect(screen.getByRole('button',{name})).toBeVisible();
 expect(screen.queryByText('Details')).toBeNull();
});
// Device A and B can both have sequence 2. The public projection contains no
// installation identity; neither uniqueness nor sequence adjacency proves a link.
it.each(['missing','device-a','device-b','both-devices'] as const)('blocked predecessor keeps the notice without a link: %s',loaded=>{
 const deviceA={...item,reviewItemId:'device-a-2',deviceSequence:2,predecessorBlocked:true};
 const deviceB={...item,reviewItemId:'device-b-2',deviceSequence:2,predecessorBlocked:true};
 const blocked={...item,reviewItemId:'device-a-3',deviceSequence:3,reviewReason:'predecessor_requires_review'};
 const previous=loaded==='missing'?[]:loaded==='device-a'?[deviceA]:loaded==='device-b'?[deviceB]:[deviceA,deviceB];
 render(<ReviewsView administration={{} as AdminWebCapability} state={{...ready(),reviewItems:[...previous,blocked]}}/>);
 expect(screen.getByText('Vor dieser Erfassung von Anna liegt ein offener Fall.')).toBeVisible();
 expect(screen.queryByRole('link',{name:'Zur früheren Erfassung'})).toBeNull();
});
