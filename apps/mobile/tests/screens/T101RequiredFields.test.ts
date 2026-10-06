// @vitest-environment jsdom
import { act, createElement as h, type ReactNode, type Ref } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AdminSetupCapability } from '../../src/administration/contracts';
import type { MobileWorkCapability } from '../../src/work/contracts';
import type { OfflineManualCaptureCapability } from '../../src/offline/OfflineCaptureCoordinator';
const native=vi.hoisted(()=>({announce:vi.fn(),focus:vi.fn()}));
vi.mock('react-native',()=>{
 const view=({children,ref,style,focusable,accessible,accessibilityLabel}:{children?:ReactNode;ref?:Ref<HTMLDivElement>;style?:unknown;focusable?:boolean;accessible?:boolean;accessibilityLabel?:string})=>h('div',{ref,tabIndex:focusable?0:undefined,'aria-label':accessibilityLabel,'data-accessible':accessible,'data-style':JSON.stringify(style)},children);
 return {View:view,ScrollView:view,StyleSheet:{create:(v:unknown)=>v},Platform:{OS:'android'},BackHandler:{addEventListener:()=>({remove(){}})},findNodeHandle:(node:unknown)=>node,AccessibilityInfo:{announceForAccessibility:native.announce,setAccessibilityFocus:native.focus}};
});
vi.mock('../../src/design/LineIcon',()=>({LineIcon:()=>null}));
vi.mock('../../src/design/AppBuildIdentity',()=>({AppBuildIdentity:()=>null}));
vi.mock('../../src/design/primitives',()=>{
 const group=({children}:{children?:ReactNode})=>h('div',{},children);
 return {Card:group,Screen:group,AppText:({children,accessibilityRole,accessibilityLiveRegion}:{children?:ReactNode;accessibilityRole?:string;accessibilityLiveRegion?:string})=>h('span',{role:accessibilityRole,'aria-live':accessibilityLiveRegion},children),
 TextField:({ref,value,onChangeText,accessibilityLabel,accessibilityHint,editable}:{ref?:Ref<HTMLInputElement>;value:string;onChangeText:(s:string)=>void;accessibilityLabel?:string;accessibilityHint?:string;editable?:boolean})=>h('input',{ref,value,disabled:editable===false,'aria-label':accessibilityLabel,'aria-description':accessibilityHint,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onChangeText(e.target.value)}),
 ActionButton:({title,onPress,disabled}:{title:string;onPress:()=>void;disabled?:boolean})=>h('button',{onClick:onPress,disabled},title),TouchTarget:({children,onPress,disabled}:{children?:ReactNode;onPress:()=>void;disabled?:boolean})=>h('button',{onClick:onPress,disabled},children)};
});
const {LoginScreen}=await import('../../src/screens/LoginScreen');
const {EmployeeEnrollmentScreen}=await import('../../src/screens/EmployeeEnrollmentScreen');
const {InviteEmployeeScreen}=await import('../../src/screens/InviteEmployeeScreen');
const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
const {CustomerCreation}=await import('../../src/screens/CustomerCreation');
const {CustomerManagement}=await import('../../src/screens/CustomerManagement');
const {CustomerQuota}=await import('../../src/screens/CustomerQuota');
const {ManualCaptureScreen}=await import('../../src/screens/ManualCaptureScreen');
const {OfflineManualCaptureScreen}=await import('../../src/screens/OfflineManualCaptureScreen');
let root:Root,box:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);box=document.createElement('div');document.body.append(box);root=createRoot(box);native.announce.mockClear();native.focus.mockClear();});
afterEach(async()=>{await act(async()=>root.unmount());box.remove();vi.unstubAllGlobals();});
async function mount(ui:ReactNode){await act(async()=>root.render(ui));}
async function press(title:string){const button=Array.from(box.querySelectorAll('button')).find(b=>b.textContent===title)!;expect(button,title).toBeTruthy();expect(button.disabled).toBe(false);await act(async()=>{button.focus();button.click();});}
async function fill(label:string,value:string){const input=box.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;expect(input,label).toBeTruthy();await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
function hint(text:string){const node=Array.from(box.querySelectorAll('[role="alert"]')).find(node=>node.textContent===text)!;expect(node,text).toBeTruthy();expect(node.getAttribute('aria-live')).toBe('polite');expect(node.closest('[data-style*="#FF8F8F"]')?.getAttribute('data-style')).toContain('#FF8F8F');}
const customer={id:'customer',customerId:'customer',displayName:'Kunde A',active:true};
const state={status:'ready',outcome:null,projection:{organization:{id:'org',name:'Betrieb'},customers:[customer],nfcTags:[],nextCursor:null}};
function admin(){return {getState:()=>state,subscribe:()=>()=>{},cancel:vi.fn(async()=>{}),prepareCustomer:vi.fn(async()=>({status:'ready',locationsEnabled:true,locations:[{id:'l1',displayName:'Berlin'},{id:'l2',displayName:'Bonn'}]})),refresh:vi.fn(async()=>{}),createCustomer:vi.fn(async()=>{}),provision:vi.fn(async()=>{}),provisionBreak:vi.fn(async()=>{}),manageCustomer:vi.fn(async()=>({status:'succeeded'}))};}
it.each(['Anmelden','Mit Einladung beitreten','Passwort vergessen'])('T101 %s identifies required credentials without contacting auth',async title=>{
 const signIn=vi.fn(async()=>({status:'invalid_credentials' as const})),reset=vi.fn(async()=> 'requested' as const);
 await mount(h(LoginScreen,{signIn,signInForEmployeeEnrollment:signIn,requestPasswordReset:reset,disabled:false}));await press(title);
 hint('Bitte E-Mail-Adresse eingeben.');expect(signIn).not.toHaveBeenCalled();expect(reset).not.toHaveBeenCalled();expect(document.activeElement).toBe(box.querySelector('input'));
 await fill('E-Mail-Adresse','a@example.test');expect(box.textContent).not.toContain('Bitte E-Mail-Adresse eingeben.');
 if(title!=='Passwort vergessen'){hint('Bitte Passwort eingeben.');await fill('Passwort','secret');expect(box.textContent).not.toContain('Bitte Passwort eingeben.');}
 expect(native.announce).toHaveBeenCalled();
});
it('T101 enrollment keeps submit available and the hint disappears',async()=>{
 const redeem=vi.fn(async()=>({status:'invalid_request' as const}));await mount(h(EmployeeEnrollmentScreen,{notice:null,redeem,signOut:vi.fn(async()=>{})}));await press('Einladung sicher einlösen');hint('Bitte Einladungsgeheimnis eingeben.');expect(redeem).not.toHaveBeenCalled();await fill('Einladungsgeheimnis','abc');expect(box.textContent).not.toContain('Bitte Einladungsgeheimnis eingeben.');
});
it('T101 invitation marks name, email and location independently',async()=>{
 const invite=vi.fn();await mount(h(InviteEmployeeScreen,{employees:{invite,back:vi.fn()} as never,state:{status:'invite',busy:false,outcome:null,locationsReady:true,locations:[{id:'l1',name:'Berlin'}]},scope:{kind:'organization'},locationsEnabled:true}));await press('Einladung senden');
 for(const message of ['Bitte Name eingeben.','Bitte E-Mail eingeben.','Bitte einen Standort wählen.'])hint(message);
 expect(invite).not.toHaveBeenCalled();await fill('Name','Alex');await fill('E-Mail','alex@example.test');await press('Berlin');expect(box.querySelector('[role="alert"]')).toBeNull();
});
it.each([false,true])('T101 tag assignment / pause=%s requires its label and choice',async pause=>{
 const api=admin();await mount(h(AdminSetupScreen,{administration:api as unknown as AdminSetupCapability}));await press('Tag zuordnen');if(pause)await press('Pause');await press('Tag erfassen');hint('Bitte Bezeichnung eingeben.');if(!pause){hint('Bitte einen Kunden oder Pause wählen.');expect(document.activeElement?.getAttribute('aria-label')).toContain('Kunden');}
 expect(api.provision).not.toHaveBeenCalled();expect(api.provisionBreak).not.toHaveBeenCalled();await fill('Bezeichnung des NFC-Tags','Eingang');if(!pause)await press('Kunde A');expect(box.querySelector('[role="alert"]')).toBeNull();
});
it.each(['Nur anlegen','NFC-Tag zuordnen'])('T101 customer creation via %s marks name and location before any creation',async title=>{
 const api=admin();await mount(h(CustomerCreation,{administration:api as unknown as AdminSetupCapability,onCreated:vi.fn()}));await press('+ Kunde hinzufügen');await press(title);hint('Bitte Name eingeben.');hint('Bitte einen Standort wählen.');expect(api.createCustomer).not.toHaveBeenCalled();expect(api.provision).not.toHaveBeenCalled();await fill('Name des neuen Kunden','Alex');await press('Berlin');expect(box.querySelector('[role="alert"]')).toBeNull();
});
it('T101 customer rename rejects blank names at the field',async()=>{
 const api=admin();await mount(h(CustomerManagement,{customer,administration:api as unknown as AdminSetupCapability,onSaved:vi.fn()}));await press('Kunde umbenennen');await fill('Neuer Kundenname',' ');await press('Namen speichern');hint('Bitte Kundenname eingeben.');expect(api.manageCustomer).not.toHaveBeenCalled();await fill('Neuer Kundenname','Kunde B');expect(box.querySelector('[role="alert"]')).toBeNull();
});
it('T101 quota remains optional and only invalid filled input gets a hint',async()=>{
 const save=vi.fn(async()=>({status:'succeeded' as const}));await mount(h(CustomerQuota,{customer:{customerId:'customer',workDurationSeconds:0},work:{setCustomerQuota:save} as unknown as MobileWorkCapability,onSaved:vi.fn(),editable:true}));await press('Kontingent ändern');await fill('Stunden pro Monat (optional)','x');await press('Kontingent speichern');hint('Gib 0,5 bis 744 Stunden in halben oder ganzen Stunden ein.');expect(save).not.toHaveBeenCalled();await fill('Stunden pro Monat (optional)','');expect(box.querySelector('[role="alert"]')).toBeNull();await press('Kontingent speichern');expect(save).toHaveBeenCalledWith('customer',null);
});
it.each(['online','offline'])('T101 manual %s requires a choice without capturing anything',async mode=>{
 const capture=vi.fn(),target={targetType:'customer' as const,targetId:'customer',displayName:'Kunde A'};
 const ownTime={records:[],activeRecord:null,nextCursor:null,windowStartedAt:'2026-09-01T00:00:00Z',windowEndedAt:'2026-09-30T12:00:00Z'};
 const ready={status:'ready',targets:{targets:[target],nextCursor:null},ownTime,submitting:false,capturePending:false,outcome:null};
 if(mode==='online')await mount(h(ManualCaptureScreen,{work:{getState:()=>ready,subscribe:()=>()=>{},refresh:vi.fn(async()=>{}),triggerManual:capture} as unknown as MobileWorkCapability}));
 else await mount(h(OfflineManualCaptureScreen,{manual:{readOfflineManualTargets:async()=>({status:'ready',targets:[target]}),captureManual:capture} as unknown as OfflineManualCaptureCapability,restorationKey:'test'}));
 await press(mode==='online'?'Zeit starten':'Jetzt erfassen');hint(mode==='online'?'Wähle ein Arbeitsziel. Deine Eingaben bleiben erhalten.':'Bitte ein Arbeitsziel oder Pause wählen.');expect(capture).not.toHaveBeenCalled();expect(native.focus).toHaveBeenCalledWith(document.activeElement);expect(document.activeElement?.getAttribute('aria-label')).toMatch(/Arbeitsziel/);expect(document.activeElement?.getAttribute('tabindex')).toBe('0');expect(document.activeElement?.getAttribute('data-accessible')).toBe('true');expect(box.querySelector('button')?.closest('[data-accessible="true"]')).toBeNull();await press(mode==='online'?'Zeit starten':'Jetzt erfassen');expect(native.focus).toHaveBeenCalledTimes(2);await press('Kunde A');expect(box.querySelector('[role="alert"]')).toBeNull();
});

it('T075 warns at the invitation boundary but keeps sending possible; null package and managers have no hint',async()=>{
  const invite=vi.fn();const props={employees:{invite,back:vi.fn()} as never,state:{status:'invite' as const,busy:false,outcome:null,locationsReady:true,locations:[],packageUsage:{packageSize:2 as number|null,activeAccessCount:2}},scope:{kind:'organization' as const},locationsEnabled:false};
  await mount(h(InviteEmployeeScreen,props));expect(box.textContent).toContain('Mit dieser Einladung wird das Paket von 2 Zugängen überschritten. Einladen bleibt möglich.');
  await fill('Name','Alex');await fill('E-Mail','alex@example.test');await press('Einladung senden');expect(invite).toHaveBeenCalledWith('Alex','alex@example.test',null);
  await mount(h(InviteEmployeeScreen,{...props,state:{...props.state,packageUsage:{packageSize:null,activeAccessCount:2}}}));expect(box.textContent).not.toContain('Paket');
  await mount(h(InviteEmployeeScreen,{...props,scope:{kind:'location',locationId:'l1',locationName:'Nord'}}));expect(box.textContent).not.toContain('Paket');
});
