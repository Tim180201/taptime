// @vitest-environment jsdom
import { act, createElement, useEffect, useImperativeHandle, type ReactNode, type Ref } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CustomerHoursResponse } from '@taptime/mobile-work-contract';
import type { MobileWorkCapability } from '../../src/work/contracts';
import { TapTimeMobileWorkApiClient } from '../../src/work/TapTimeMobileWorkApiClient';
const native=vi.hoisted(()=>({scroll:vi.fn(),reduced:false,headingY:0}));
vi.mock('react-native', () => {
  type Props = { children?: ReactNode; onPress?: () => void; disabled?: boolean; accessibilityRole?: string;
    accessibilityLabel?: string; accessibilityState?: { selected?: boolean }; onLayout?: (event: unknown) => void };
  const element = ({ children, onPress, disabled, accessibilityRole, accessibilityLabel, accessibilityState, onLayout }: Props) => {
    useEffect(() => { onLayout?.({ nativeEvent: { layout: { y: native.headingY } } }); }, []);
    return createElement(onPress ? 'button' : 'div', { onClick: onPress, disabled, role: accessibilityRole,
      'aria-label': accessibilityLabel, 'aria-selected': accessibilityState?.selected }, children);
  };
  return { RefreshControl: () => null, View: element, Text: element, Pressable: element,
    ScrollView: ({ ref, children }: { ref?: Ref<unknown>; children?: ReactNode }) => {
      useImperativeHandle(ref, () => ({ scrollTo: native.scroll })); return createElement('div', {}, children);
    },
    TextInput: ({ value, onChangeText, accessibilityLabel }: { value: string; onChangeText: (value: string) => void; accessibilityLabel: string }) =>
      createElement('input', { value, 'aria-label': accessibilityLabel, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value) }),
    StyleSheet: { create: (value: unknown) => value }, Platform: { OS: 'android' },
    BackHandler: { addEventListener: () => ({ remove() {} }) },
    AccessibilityInfo: { isReduceMotionEnabled: async () => native.reduced, addEventListener: () => ({ remove() {} }) },
  };
});

const {CustomersScreen}=await import('../../src/screens/CustomersScreen');
let root:Root,container:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.setSystemTime(new Date('2026-09-28T08:00Z'));container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
const authorityContext={role:'employee'};
const cid='40000000-0000-4000-8000-000000000001',mid='70000000-0000-4000-8000-000000000001';
const customer={customerId:cid,displayName:'Werkstatt',active:false,workDurationSeconds:7200,running:true};
const own:CustomerHoursResponse={version:'customer-hours.v1',scope:'self',asOf:'2026-09-28T08:00:00.000Z',customers:[{...customer,days:[{date:'2026-09-28',workDurationSeconds:7200,running:true}]}]};
const people:CustomerHoursResponse={...own,scope:'people',customers:[{...customer,people:[{membershipId:mid,displayName:'Person B',workDurationSeconds:7200,running:true}]}]};
const click=async(text:string)=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===text||b.getAttribute('aria-label')?.includes(text));if(!b)throw Error(text);await act(async()=>b.click());};
it.each([own,people])('renders $scope detail, marks inactive/running and selects previous month',async value=>{
 const readCustomerHours=vi.fn(async()=>({status:'ready' as const,value}));
 await act(async()=>root.render(createElement(CustomersScreen,{work:{readCustomerHours} as unknown as MobileWorkCapability,authorityContext})));
 await click('Werkstatt');expect(container.textContent).toContain(value.scope==='self'?'28.09.2026':'Person B');
 expect(container.textContent).toContain('inaktiv');expect(container.textContent).toContain('läuft');
 expect(container.querySelector('[aria-label="Nächster Monat"]')?.hasAttribute('disabled')).toBe(true);
 await click('Monat auswählen');expect(container.textContent).toContain('Oktober 2024');
 await click('August 2026');expect(readCustomerHours).toHaveBeenLastCalledWith('2026-08');
});
it('keeps error distinct from empty and retries',async()=>{
 const readCustomerHours=vi.fn<NonNullable<MobileWorkCapability['readCustomerHours']>>().mockResolvedValueOnce({status:'unavailable'}).mockResolvedValueOnce({status:'ready',value:{...own,customers:[]}});
 await act(async()=>root.render(createElement(CustomersScreen,{work:{readCustomerHours} as unknown as MobileWorkCapability,authorityContext})));
 expect(container.textContent).toContain('konnten nicht geladen');await click('Erneut versuchen');expect(container.textContent).toContain('Keine Kunden in diesem Monat');
});
it('uses exact mobile customer contract and rejects employee response containing foreign people',async()=>{
 const post=vi.fn(async()=>({status:'response' as const,statusCode:200,contentType:'application/json',body:JSON.stringify(own)}));
 const api=new TapTimeMobileWorkApiClient(new URL('https://synthetic.invalid'),{post},()=>mid);
 const request={expectedMembershipId:mid,fromInclusive:'2026-08-31T22:00:00.000Z',toExclusive:'2026-09-30T22:00:00.000Z'};
 await expect(api.readCustomerHours(request)).resolves.toEqual({status:'ready',value:own});
 post.mockResolvedValueOnce({status:'response',statusCode:200,contentType:'application/json',body:JSON.stringify({...people,scope:'self'})});
 await expect(api.readCustomerHours(request)).resolves.toEqual({status:'unavailable'});
});
it('hides loaded people hours immediately when the session context changes and ignores late replies',async()=>{
 const administratorContext={role:'administrator'},employeeContext={role:'employee'};
 let finishOld!: (value: import('@taptime/mobile-work-contract').CustomerHoursResult)=>void;
 const readCustomerHours=vi.fn<NonNullable<MobileWorkCapability['readCustomerHours']>>()
   .mockResolvedValueOnce({status:'ready',value:people})
   .mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;}))
   .mockResolvedValueOnce({status:'ready',value:own});
 const work={readCustomerHours} as unknown as MobileWorkCapability;
 await act(async()=>root.render(createElement(CustomersScreen,{work,authorityContext:administratorContext})));
 await click('Werkstatt');expect(container.textContent).toContain('Person B');
 await click('Kundenstunden aktualisieren');
 await act(async()=>root.render(createElement(CustomersScreen,{work,authorityContext:employeeContext})));
 expect(container.textContent).not.toContain('Person B');
 expect(container.textContent).toContain('Deine Stunden je Tag');
 await act(async()=>finishOld({status:'ready',value:people}));
 expect(container.textContent).not.toContain('Person B');
 expect(container.textContent).toContain('Deine Stunden je Tag');
});
it('T100 confirms deletion before mutation and displays a running-time rejection',async()=>{
 const {CustomerManagement}=await import('../../src/screens/CustomerManagement');
 const manageCustomer=vi.fn(async()=>({status:'running_time' as const}));
 await act(async()=>root.render(createElement(CustomerManagement,{customer,administration:{manageCustomer} as unknown as import('../../src/administration/contracts').AdminSetupCapability,onSaved:vi.fn()})));
 await click('Kunde löschen');
 expect(container.textContent).toContain('Kunde Werkstatt löschen? Stunden bleiben erhalten.');
 expect(manageCustomer).not.toHaveBeenCalled();
 await click('Löschen bestätigen');
 expect(manageCustomer).toHaveBeenCalledWith(cid,{action:'deactivate'});
 expect(container.textContent).toContain('Erst die laufende Zeit beenden');
});
