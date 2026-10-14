// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TargetAssignments from '../src/views/TargetAssignments';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
afterEach(cleanup);
it.each(['customer','person'] as const)('%s: lists and searches pages, multi-selects sequentially, reports partial errors, retries and removes',async mode=>{
 let assigned=['Schon zugeordnet'],attempt=0,inFlight=0,maximum=0;
 const item=(n:number,name:string)=>({assignmentId:id(n+50),displayName:name,...(mode==='customer'?{membershipId:id(n)}:{targetType:'project',targetId:id(n)})});
 const readTargetAssignments=vi.fn(async(request:any)=>{
  if(mode==='customer'&&request.membershipId)return {status:'ready',value:{items:request.membershipId===id(1)?[{assignmentId:id(51),targetType:'customer',targetId:id(9),displayName:'Kunde'}]:[],nextCursor:null}};
  return {status:'ready',value:{items:request.search?[item(8,'Suchfund')]:request.cursor?[item(7,'Seite 2')]:assigned.map((name,i)=>item(i+1,name)),nextCursor:request.cursor||request.search?null:'next'}};
 });
 const querySearch=vi.fn(async(kind:string,request:any)=>({status:'ready',value:kind==='memberships'
  ?{employeeMemberships:[{id:id(1),displayName:'Schon zugeordnet',role:'employee',active:true},{id:id(2),displayName:'Anna',role:'employee',active:true},{id:id(3),displayName:'Berta',role:'employee',active:true}],nextCursor:null}
  :{targets:[{targetType:'project',targetId:id(1),displayName:'Schon zugeordnet',assignedToPerson:true},
    {targetType:'customer',targetId:id(2),displayName:'Anna',assignedToPerson:false},{targetType:'project',targetId:id(3),displayName:'Berta',assignedToPerson:false},
    {targetType:'general_work',targetId:id(4),displayName:'Allgemeine Arbeitszeit',assignedToPerson:false}],nextCursor:null}}));
 const changeTargetAssignment=vi.fn(async(pair:any)=>{maximum=Math.max(maximum,++inFlight);await Promise.resolve();inFlight--;attempt++;
  if(!pair.assigned){assigned=[];return {status:'succeeded'};}
  if((mode==='customer'?pair.membershipId:pair.targetId)===id(2))return {status:'target_not_selectable'};
  return {status:attempt<3?'unavailable':'succeeded'};
 });
 const administration:any={getState:()=>({status:'ready',role:'administrator',membershipId:id(10),selectedLocation:null}),querySearch,readTargetAssignments,changeTargetAssignment};
 render(<TargetAssignments administration={administration} selector={mode==='customer'?{targetType:'customer',targetId:id(9)}:{membershipId:id(9)}} personName="Person"/>);
 const section=await screen.findByRole('region',{name:mode==='customer'?'Mitarbeiter':'Kunden und Projekte'});
 expect(within(section).getByText('Schon zugeordnet')).toBeVisible();
 fireEvent.click(within(section).getByRole('button',{name:'Weitere laden'}));expect(await screen.findByText('Seite 2')).toBeVisible();
 fireEvent.change(within(section).getByRole('searchbox'),{target:{value:'Such'}});expect(await screen.findByText('Suchfund')).toBeVisible();
 fireEvent.click(within(section).getByRole('button',{name:mode==='customer'?'Mitarbeiter zuordnen':'Kunden und Projekte zuordnen'}));
 const chooser=await screen.findByRole('group',{name:mode==='customer'?'Mitarbeiter auswählen':'Kunden und Projekte auswählen'});
 expect(await within(chooser).findByRole('checkbox',{name:/Schon zugeordnet/})).toBeChecked();
 expect(within(chooser).queryByRole('checkbox',{name:'Allgemeine Arbeitszeit'})).toBeNull();
 fireEvent.click(within(chooser).getByRole('checkbox',{name:'Anna'}));fireEvent.click(within(chooser).getByRole('checkbox',{name:'Berta'}));
 fireEvent.click(screen.getByRole('button',{name:'Auswahl zuordnen'}));
 expect(await screen.findByText(/kann diesen Kunden nicht wählen/)).toBeVisible();
 fireEvent.click(await screen.findByRole('button',{name:/Erneut versuchen/}));await waitFor(()=>expect(screen.getByText(/Berta: Zugeordnet/)).toBeVisible());
 expect(maximum).toBe(1);expect(changeTargetAssignment).toHaveBeenCalledTimes(3);
 fireEvent.click(screen.getByRole('button',{name:'Auswahl schließen'}));
 fireEvent.change(within(section).getByRole('searchbox'),{target:{value:''}});
 await waitFor(()=>expect(within(section).getByText('Schon zugeordnet')).toBeVisible());
 fireEvent.click(within(section).getByRole('button',{name:'Entfernen · Schon zugeordnet'}));
 await waitFor(()=>expect(changeTargetAssignment).toHaveBeenLastCalledWith(expect.objectContaining({assigned:false})));
});
it('forbidden hides the person section and location leads only see manageable active employees',async()=>{
 let forbidden=true;
 const readTargetAssignments=vi.fn(async()=>forbidden?{status:'forbidden'}:{status:'ready',value:{items:[],nextCursor:null}});
 const querySearch=vi.fn(async()=>({status:'ready',value:{employeeMemberships:[{id:id(1),displayName:'Erlaubt',role:'employee',active:true},
  {id:id(2),displayName:'Administrator',role:'administrator',active:true},{id:id(3),displayName:'Leitung',role:'standortleitung',active:true},{id:id(4),displayName:'Ausgeschieden',role:'employee',active:false}],nextCursor:null}}));
 const administration:any={getState:()=>({status:'ready',role:'standortleitung',membershipId:id(10),selectedLocation:null}),readTargetAssignments,querySearch};
 const view=render(<TargetAssignments administration={administration} selector={{membershipId:id(9)}} personName="Person"/>);
 await waitFor(()=>expect(readTargetAssignments).toHaveBeenCalled());expect(screen.queryByRole('region')).toBeNull();
 forbidden=false;view.rerender(<TargetAssignments key="customer" administration={administration} selector={{targetType:'customer',targetId:id(9)}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Mitarbeiter zuordnen'}));
 expect(await screen.findByRole('checkbox',{name:'Erlaubt'})).toBeVisible();
 for(const name of ['Administrator','Leitung','Ausgeschieden'])expect(screen.queryByRole('checkbox',{name})).toBeNull();
});
it.each(['forbidden','target_not_selectable'])('identifies each entry when multiple commands return %s',async status=>{
 const readTargetAssignments=vi.fn(async()=>({status:'ready',value:{items:[],nextCursor:null}}));
 const administration:any={getState:()=>({status:'ready',role:'administrator'}),readTargetAssignments,
  querySearch:async()=>({status:'ready',value:{targets:[{targetType:'customer',targetId:id(1),displayName:'Kunde A',assignedToPerson:false},{targetType:'project',targetId:id(2),displayName:'Projekt B',assignedToPerson:false}],nextCursor:null}}),
  changeTargetAssignment:async()=>({status})};
 render(<TargetAssignments administration={administration} selector={{membershipId:id(9)}} personName="Ada"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Kunden und Projekte zuordnen'}));
 fireEvent.click(await screen.findByRole('checkbox',{name:'Kunde A'}));fireEvent.click(screen.getByRole('checkbox',{name:'Projekt B'}));
 fireEvent.click(screen.getByRole('button',{name:'Auswahl zuordnen'}));
 const message=status==='forbidden'?'Dafür fehlt Ihnen die Berechtigung.':'Ada kann diesen Kunden nicht wählen (anderer Standort).';
 await waitFor(()=>expect(screen.getAllByText(message)).toHaveLength(status==='forbidden'?2:1));
 if(status==='target_not_selectable')expect(screen.getByText('Ada kann dieses Projekt nicht wählen (anderer Standort).')).toBeVisible();
 const result=screen.getAllByRole('status').find(node=>node.textContent?.includes(message))!;
 expect(result).toHaveTextContent('Kunde A');expect(result).toHaveTextContent('Projekt B');
});

it('K8 reads one membership search page and all target pages for 50 candidates, reuses them on search and refreshes after assigning',async()=>{
 const people=Array.from({length:50},(_,n)=>({id:id(n+1),displayName:`Person ${n+1}`,role:'employee',active:true}));
 let assigned=false;
 const readTargetAssignments=vi.fn(async(request:any)=>({status:'ready',value:{items:request.cursor
  ?[{assignmentId:id(91),membershipId:id(50),displayName:'Person 50'}]
  :assigned?[{assignmentId:id(90),membershipId:id(1),displayName:'Person 1'}]:[],nextCursor:request.cursor?null:'target-page-2'}}));
 const querySearch=vi.fn(async()=>({status:'ready',value:{employeeMemberships:people,nextCursor:null}}));
 const changeTargetAssignment=vi.fn(async()=>{assigned=true;return {status:'succeeded'};});
 const administration:any={getState:()=>({status:'ready',role:'administrator',membershipId:id(99)}),querySearch,readTargetAssignments,changeTargetAssignment};
 render(<TargetAssignments administration={administration} selector={{targetType:'customer',targetId:id(80)}}/>);
 await screen.findByRole('button',{name:'Mitarbeiter zuordnen'});readTargetAssignments.mockClear();
 fireEvent.click(screen.getByRole('button',{name:'Mitarbeiter zuordnen'}));
 expect(await screen.findByRole('checkbox',{name:'Person 50 · zugeordnet'})).toBeChecked();
 expect(querySearch).toHaveBeenCalledTimes(1);expect(readTargetAssignments).toHaveBeenCalledTimes(2);
 expect(readTargetAssignments.mock.calls.map(([q])=>q)).toEqual([
  {targetType:'customer',targetId:id(80),search:null,cursor:null},{targetType:'customer',targetId:id(80),search:null,cursor:'target-page-2'}]);
 fireEvent.change(screen.getAllByRole('searchbox')[1]!,{target:{value:'Person'}});
 await waitFor(()=>expect(querySearch).toHaveBeenCalledTimes(2));
 expect(readTargetAssignments).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getByRole('checkbox',{name:'Person 1'}));fireEvent.click(screen.getByRole('button',{name:'Auswahl zuordnen'}));
 expect(await screen.findByRole('checkbox',{name:'Person 1 · zugeordnet'})).toBeChecked();
 expect(changeTargetAssignment).toHaveBeenCalledTimes(1);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Auswahl schließen'})).toBeEnabled());
 expect(screen.getByRole('button',{name:'Entfernen · Person 1'})).toBeVisible();
 // The displayed unsearched list shares the picker's freshly read first page.
 expect(readTargetAssignments).toHaveBeenCalledTimes(4);expect(querySearch).toHaveBeenCalledTimes(3);
 expect(readTargetAssignments.mock.calls.every(([q])=>q.targetId===id(80)&&!('membershipId' in q))).toBe(true);
});
