// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Overview,{nextSetupStep} from '../src/views/Overview';
import type {AdminWebState} from '../src/contracts';
type Ready=Extract<AdminWebState,{status:'ready'}>;
const organization={id:'org',name:'Betrieb'};
function ready():any{return {status:'ready',membershipId:'self',role:'administrator',selectedLocation:null,managementScope:{kind:'organization'},locationsEnabled:false,
 availableSections:['setup','employees','time_records'],sections:{setup:{status:'ready'},employees:{status:'ready'},timeRecords:{status:'ready'},reviewItems:{status:'ready'}},
 projection:{organization,customers:[{id:'customer'}],nfcTags:[{id:'tag'}],customersComplete:false,nfcTagsComplete:false,nextCursor:'mixed-more'},
 employeeProjection:{organization,employeeMemberships:[{id:'other',active:true}],nextCursor:'people-more'},
 projects:[],projectsNextCursor:null,projectBusy:false,locationSetup:{locations:[],memberships:[],workTargets:[],activationGaps:[]},locationSetupBusy:false,
 timeRecords:[{status:'stopped'}],timeRecordsNextCursor:'time-more',reviewItems:[],reviewItemsNextCursor:null};}
afterEach(cleanup);
it.each(['locations','management','customers','tags','people','time'])('K5/K6 %s: yes, no, unknown; unrelated incomplete pages never block a proven hint',kind=>{
 const s=ready();const check=()=>nextSetupStep(s as Ready)?.label??null;
 const yes=()=>{
  if(kind==='locations')s.locationSetup.locations=[{active:true}];
  if(kind==='management')s.locationSetup.memberships=[{role:'standortleitung',managementLocationIds:[]}];
  if(kind==='customers'){s.projection.customers=[];s.projection.customersComplete=true;s.projection.nextCursor=null;}
  if(kind==='tags'){s.projection.nfcTags=[];s.projection.nfcTagsComplete=true;s.projection.nextCursor=null;}
  if(kind==='people'){s.employeeProjection.employeeMemberships=[{id:'self',active:true},{id:'former',active:false}];s.employeeProjection.nextCursor=null;}
  if(kind==='time'){s.timeRecords=[];s.timeRecordsNextCursor=null;}
 };
 yes();expect(check()).toBe({locations:'Standorte zuordnen',management:'Bereiche zuweisen',customers:'Kunden anlegen',tags:'Karteneinrichtung ansehen',people:'Mitarbeiter einladen',time:'Arbeitszeit erfassen'}[kind]);
 if(kind==='locations')s.locationsEnabled=true;
 if(kind==='management')s.locationSetup.memberships[0].managementLocationIds=['north'];
 if(kind==='customers')s.projects=[{projectId:'project'}];
 if(kind==='tags')s.projection.nfcTags=[{id:'tag'}];
 if(kind==='people')s.employeeProjection.employeeMemberships.push({id:'other',active:true});
 if(kind==='time')s.timeRecords=[{status:'stopped'}];
 expect(check()).toBeNull();
 yes();s.locationsEnabled=false;
 if(kind==='locations'||kind==='management')s.locationSetupFailed=true;
 if(kind==='customers'){s.projects=[];s.projection.customersComplete=false;}
 if(kind==='tags')s.projection.nfcTagsComplete=false;
 if(kind==='people')s.employeeProjection.nextCursor='more';
 if(kind==='time')s.timeRecordsNextCursor='more';
 expect(check()).toBeNull();
 // Errors remain unknown even if a previously loaded empty page is retained.
 if(kind==='customers'||kind==='tags'){s.sections.setup={status:'unavailable'};s.projection.customersComplete=true;s.projection.nfcTagsComplete=true;}
 if(kind==='people'){s.sections.employees={status:'unavailable'};s.employeeProjection.nextCursor=null;}
 if(kind==='time'){s.sections.timeRecords={status:'unavailable'};s.timeRecordsNextCursor=null;}
 expect(check()).toBeNull();
});
it('K5 skips each unknown prerequisite and keeps the established order',()=>{
 const s=ready();s.locationSetup=null;s.projection.customers=[];s.projection.nfcTags=[];s.projects=undefined;
 s.employeeProjection.employeeMemberships=[];s.timeRecords=[];s.timeRecordsNextCursor=null;
 expect(nextSetupStep(s)?.label).toBe('Arbeitszeit erfassen');
 s.employeeProjection.nextCursor=null;expect(nextSetupStep(s)?.label).toBe('Mitarbeiter einladen');
 s.projection.nfcTagsComplete=true;s.projection.nextCursor=null;expect(nextSetupStep(s)?.label).toBe('Karteneinrichtung ansehen');
 s.projection.customersComplete=true;s.projects=[];expect(nextSetupStep(s)?.label).toBe('Kunden anlegen');
});
it.each(['empty','found','partial','error'] as const)('K6 fallback first pages: %s, without search or pagination',async mode=>{
 const s=ready();s.projection.customers=[];s.projection.nfcTags=[];s.projects=undefined;s.timeRecords=[];s.timeRecordsNextCursor=null;
 const querySearch=vi.fn(async(kind:string)=>mode==='error'?{status:'unavailable'}:{status:'ready',value:{
  customers:mode==='found'?[{id:'c'}]:[],nfcTags:mode==='found'?[{id:'t'}]:[],projects:mode==='found'?[{projectId:'p'}]:[],nextCursor:mode==='partial'?'more':null}});
 const administration:any={querySearch};render(<Overview state={s} administration={administration} navigate={vi.fn()}/>);
 await waitFor(()=>expect(querySearch).toHaveBeenCalledTimes(3));
 for(const [kind,request] of querySearch.mock.calls as unknown as [string,any][]) {
  expect(['setup_customers','setup_tags','projects']).toContain(kind);expect(request).toMatchObject({cursor:null,search:null});
 }
 expect(await screen.findByText(mode==='empty'?'Legen Sie Kunden an.':'Erfassen Sie die erste Arbeitszeit.')).toBeVisible();
});
it('K6 independently uses the card source after a failed customer source',async()=>{
 const s=ready();s.projection.customers=[];s.projection.nfcTags=[];s.projects=undefined;
 const querySearch=vi.fn(async(kind:string)=>kind==='setup_customers'?{status:'unavailable'}:{status:'ready',value:{projects:[],nfcTags:[],nextCursor:null}});
 render(<Overview state={s} administration={{querySearch} as any} navigate={vi.fn()}/>);
 expect(await screen.findByText('Richten Sie in der App Karten ein.')).toBeVisible();expect(querySearch).toHaveBeenCalledTimes(3);
});
it('K7 a complete mixed page is a shortcut, and partial mixed matches still prove existence',async()=>{
 const s=ready();const querySearch=vi.fn(async()=>({status:'ready',value:{projects:[],nextCursor:null}}));
 const view=render(<Overview state={s} administration={{querySearch} as any} navigate={vi.fn()}/>);
 expect(querySearch).not.toHaveBeenCalled();
 s.projection={...s.projection,customers:[],nfcTags:[],customersComplete:true,nfcTagsComplete:true,nextCursor:null};
 view.rerender(<Overview state={{...s}} administration={{querySearch} as any} navigate={vi.fn()}/>);
 expect(await screen.findByText('Legen Sie Kunden an.')).toBeVisible();
 expect(querySearch).toHaveBeenCalledExactlyOnceWith('projects',{search:null,cursor:null});
});
it('K5 exposes guidance and its fallback reads only to an administrator on the unfiltered overview',()=>{
 const s=ready();s.projection.customers=[];s.projection.nfcTags=[];
 const querySearch=vi.fn();
 for(const patch of [{role:'standortleitung'},{selectedLocation:{id:'north'}}]){
  const state={...s,...patch};expect(nextSetupStep(state)).toBeNull();
  const view=render(<Overview state={state} administration={{querySearch} as any} navigate={vi.fn()}/>);
  expect(screen.queryByText('Ihr nächster Schritt')).toBeNull();view.unmount();
 }
 expect(querySearch).not.toHaveBeenCalled();
});
it('K7 valid mixed rows with a next cursor cannot prove absence',async()=>{
 const s=ready();s.projection={...s.projection,customers:[],nfcTags:[],customersComplete:true,nfcTagsComplete:true};
 expect(nextSetupStep(s)).toBeNull();
 const querySearch=vi.fn(async()=>({status:'ready',value:{customers:[{id:'customer'}],nfcTags:[{id:'tag'}],projects:[{projectId:'project'}],nextCursor:null}}));
 render(<Overview state={s} administration={{querySearch} as any} navigate={vi.fn()}/>);
 await waitFor(()=>expect(querySearch).toHaveBeenCalledTimes(3));
 expect(screen.queryByText('Ihr nächster Schritt')).toBeNull();
});
