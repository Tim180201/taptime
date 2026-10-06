// @vitest-environment jsdom
import {createElement as h} from 'react';
import {render,screen,fireEvent,cleanup,act,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {dayStart,shiftMonth} from '../../src/screens/ownTimeCalendar';
import type {MobileOwnTimeQueryResponse} from '@taptime/mobile-work-contract';
import type {MobileWorkCapability} from '../../src/work/contracts';
import type {ProductScanCapability} from '../../src/scan/contracts';
vi.mock('react-native',async()=>({...await vi.importActual<typeof import('react-native')>('react-native-web'),AccessibilityInfo:{announceForAccessibility:vi.fn(),isReduceMotionEnabled:async()=>true,addEventListener:()=>({remove(){}})}}));
vi.mock('../../src/design/ScanRing',()=>({ScanRing:()=>h('div',{'data-testid':'scan-ring'})}));
vi.mock('../../src/design/AppBuildIdentity',()=>({AppBuildIdentity:()=>null}));
const {AccessibilityInfo}=await import('react-native');
const {ScanScreen}=await import('../../src/screens/ScanScreen');
const {TimeCalendar}=await import('../../src/screens/TimeCalendar');
const {LoginScreen}=await import('../../src/screens/LoginScreen');
const {EmployeeEnrollmentScreen}=await import('../../src/screens/EmployeeEnrollmentScreen');
const {SynchronizationScreen}=await import('../../src/screens/SynchronizationScreen');
const active={timeRecordId:'entry',targetId:'target',source:'canonical' as const,targetType:'customer' as const,targetDisplayName:'Kunde X',status:'started' as const,startedAt:'2026-10-04T06:12:00.000Z',stoppedAt:null,startedVia:'manual' as const,stoppedVia:null,breakStartedAt:null};
const ownTime:MobileOwnTimeQueryResponse={activeRecord:active,records:[],nextCursor:null,windowStartedAt:'2026-09-30T22:00:00.000Z',windowEndedAt:'2026-10-31T23:00:00.000Z'};
const scanState={status:'ready' as const,outcome:null};
const scan={subscribe:()=>()=>{},getState:()=>scanState,scan:vi.fn(),cancel:vi.fn(),retry:vi.fn()} as unknown as ProductScanCapability;
afterEach(()=>{cleanup();vi.clearAllMocks();});
it.each([null,'2026-10-04T08:30:00.000Z'])('puts active actions before NFC and calls the same work capability (%s)',async breakStartedAt=>{
 const state={status:'ready' as const,ownTime:{...ownTime,activeRecord:{...active,breakStartedAt}},targets:{targets:[],nextCursor:null},submitting:false,outcome:null,loadingMore:false};
 const work={subscribe:()=>()=>{},getState:()=>state,refresh:vi.fn(),stopActiveTime:vi.fn(),triggerBreak:vi.fn()} as unknown as MobileWorkCapability;
 render(h(ScanScreen,{actor:'employee',scan,work,signOut:async()=>{}}));
 const stop=screen.getByRole('button',{name:'Zeit beenden'});
 expect(stop.compareDocumentPosition(screen.getByTestId('scan-ring')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 fireEvent.click(stop);expect(work.stopActiveTime).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('button',{name:breakStartedAt?'Pause beenden':'Pause starten'}));expect(work.triggerBreak).toHaveBeenCalledOnce();
});
it.each(['2026-02','2026-06','2026-10'])('renders fixed rows of seven slots in %s',month=>{
 const end=new Date(dayStart(`${shiftMonth(month,1)}-01`));
 render(h(TimeCalendar,{value:{...ownTime,activeRecord:null,windowEndedAt:end.toISOString()},onRefresh:async()=>{}}));
 expect(screen.getByTestId('calendar-weekdays').children).toHaveLength(7);
 const first=screen.getAllByTestId('calendar-week')[0]!;
 const firstDay=month==='2026-02'?6:month==='2026-06'?0:3;
 expect(first.children[firstDay]?.textContent).toContain('1');
 for(const row of screen.getAllByTestId('calendar-week'))expect(row.children).toHaveLength(7);
 expect(screen.getByText(/Zeiten vom/)).toBeDefined();expect(screen.queryByText(/Abfragezeitraum/)).toBeNull();
});
it('keeps reported evidence separate from outstanding transfers',()=>{
 const entry={workEventId:'failed',displayName:'Kunde X',occurredAt:'2026-10-04T08:00:00Z',reason:'rejected',reported:true};
 const reported={...scanState,untransferred:[entry]};
 render(h(SynchronizationScreen,{scan:{...scan,getState:()=>reported} as ProductScanCapability}));
 expect(screen.getByText('Wird von der Verwaltung geprüft. Der Originalbeleg bleibt auf dem Handy erhalten.')).toBeDefined();
 expect(screen.queryByText(/sperrt den Kontowechsel/)).toBeNull();
 expect(screen.queryByText(/wartet auf Bestätigung/)).toBeNull();
});
it('announces reset success once without an alert',async()=>{
 render(h(LoginScreen,{signIn:vi.fn(),signInForEmployeeEnrollment:vi.fn(),disabled:false,requestPasswordReset:async()=> 'requested' as const}));
 fireEvent.change(screen.getByLabelText('E-Mail-Adresse'),{target:{value:'test@example.invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Passwort vergessen'}));
 await screen.findByText(/Wir haben dir eine E-Mail/);
 expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
 expect(screen.queryByRole('alert')).toBeNull();
});
it('retains enrollment input after a temporary failure and announces each result once',async()=>{
 const redeem=vi.fn(async()=>({status:'context_unavailable' as const}));
 const props={notice:null,redeem,signOut:async()=>{}};
 const view=render(h(EmployeeEnrollmentScreen,props));
 fireEvent.change(screen.getByLabelText('Einladungsgeheimnis'),{target:{value:'synthetic-invitation'}});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Einladung sicher einlösen'})));
 view.rerender(h(EmployeeEnrollmentScreen,{...props,notice:'request_failed'}));
 expect((screen.getByLabelText('Einladungsgeheimnis') as HTMLInputElement).value).toBe('synthetic-invitation');
 await waitFor(()=>expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1));
 expect(screen.getByText('Die Einladung konnte gerade nicht geprüft werden. Versuche es erneut; deine Eingabe bleibt erhalten.')).toBeDefined();
 let finish!:(value:{status:'context_unavailable'})=>void;
 redeem.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 fireEvent.click(screen.getByRole('button',{name:'Einladung sicher einlösen'}));
 await screen.findByRole('button',{name:'Einladung wird geprüft …'});
 await act(async()=>finish({status:'context_unavailable'}));
 await waitFor(()=>expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2));
});
it('offers a direct administrative stop at the person status with its context',async()=>{
 const {PersonTimeScreen}=await import('../../src/screens/PersonTimeScreen');
 const {TimeEditingContext}=await import('../../src/timeEditing/TimeEditingControls');
 const entry={...active,details:{origin:'nfc' as const,baseRowVersion:1,effectiveRevisionNumber:0,comment:null,changed:false,change:null,overlapsAnotherRecord:false}};
 const context={membershipId:'manager',role:'administrator' as const,online:true,busy:false,targets:[],capability:{save:vi.fn(),subscribe:()=>()=>{},getState:()=>({online:true,busy:false})}};
 render(h(TimeEditingContext.Provider,{value:context},h(PersonTimeScreen,{person:{membershipId:'other',displayName:'Erika Beispiel',role:'employee',location:null,isRunning:true,runningSince:active.startedAt,runningTargetDisplayName:'Kunde X'},value:{...ownTime,activeRecord:entry},onBack:()=>{},onRefresh:async()=>{}})));
 fireEvent.click(screen.getByRole('button',{name:'Zeit beenden'}));
 expect(screen.getByLabelText(/^Grund(?: der Änderung \(Pflicht\))?$/)).toBeDefined();
 expect(screen.getByText(/Erika Beispiel · Kunde X ·/)).toBeDefined();
});

it('does not start a manual action while the NFC operation is in progress',()=>{
 const scanning={status:'scanning' as const};
 const state={status:'ready' as const,ownTime,targets:{targets:[],nextCursor:null},submitting:false,outcome:null,loadingMore:false};
 const work={subscribe:()=>()=>{},getState:()=>state,refresh:vi.fn(),stopActiveTime:vi.fn(),triggerBreak:vi.fn()} as unknown as MobileWorkCapability;
 render(h(ScanScreen,{actor:'employee',scan:{...scan,getState:()=>scanning},work,signOut:async()=>{}}));
 fireEvent.click(screen.getByRole('button',{name:'Zeit beenden'}));
 expect(work.stopActiveTime).not.toHaveBeenCalled();
});
