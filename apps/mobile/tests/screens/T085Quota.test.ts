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
  return { View: element, Text: element, Pressable: element,
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

vi.mock('expo-secure-store',()=>({getItemAsync:async()=>null,setItemAsync:async()=>{},WHEN_UNLOCKED_THIS_DEVICE_ONLY:1}));
const {CustomerQuotaNotice}=await import('../../src/screens/QuotaNotice');
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
const quota:CustomerHoursResponse={version:'customer-hours.v2',asOf:people.asOf,scope:'people',customers:[{...customer,active:true,workDurationSeconds:129600,quotaSeconds:144000,quotaStage:'warning',people:[{membershipId:mid,displayName:'Person B',workDurationSeconds:129600,running:true}]}]};
it('manager edits half hours, removes quota and sees server progress and stage',async()=>{
 const setCustomerQuota=vi.fn(async()=>({status:'succeeded' as const})),readCustomerHours=vi.fn(async()=>({status:'ready' as const,value:quota}));
 const work={readCustomerHours,setCustomerQuota} as unknown as MobileWorkCapability;
 await act(async()=>root.render(createElement(CustomersScreen,{work,authorityContext:{role:'standortleitung'}})));
 expect(container.textContent).toContain('36,0 / 40,0 h');expect(container.textContent).toContain('Kontingent fast erreicht');
 await click('Werkstatt');await click('Ändern');
 const input=container.querySelector('input')!;
 const change=async(value:string)=>{await act(async()=>{const current=container.querySelector('input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(current,value);current.dispatchEvent(new Event('input',{bubbles:true}));});};
 await change('40,5');await click('Kontingent speichern');expect(setCustomerQuota).toHaveBeenCalledWith(cid,2430);
 await click('Ändern');await change('');await click('Kontingent speichern');expect(setCustomerQuota).toHaveBeenLastCalledWith(cid,null);
});
it('quota notice acknowledges each stage, isolates membership and hides pending old reply',async()=>{
 const saved=new Map<string,string>(),storage={read:async(key:string)=>saved.get(key)??null,write:async(key:string)=>{saved.set(key,'1');}};
 const work={readCustomerHours:vi.fn(async()=>({status:'ready' as const,value:quota}))} as unknown as MobileWorkCapability;
 const authority={role:'administrator'},onView=vi.fn();
 const props={work,membership:mid,role:'administrator',authorityContext:authority,onView,storage};
 await act(async()=>root.render(createElement(CustomerQuotaNotice,props)));expect(container.textContent).toContain('fast erreicht');
 await click('Schließen');expect(container.textContent).toBe('');
 await act(async()=>root.render(createElement(CustomerQuotaNotice,{...props,authorityContext:{role:'administrator'}})));expect(container.textContent).toBe('');
 await act(async()=>root.render(createElement(CustomerQuotaNotice,{...props,membership:cid})));expect(container.textContent).toContain('fast erreicht');
 await click('Ansehen');expect(onView).toHaveBeenCalledWith(cid,'2026-09');
 await act(async()=>root.render(createElement(CustomerQuotaNotice,{...props,role:'employee'})));expect(container.textContent).toBe('');
});
it('employee customer detail contains no quota controls or values',async()=>{
 await act(async()=>root.render(createElement(CustomersScreen,{work:{readCustomerHours:async()=>({status:'ready',value:own})} as unknown as MobileWorkCapability,authorityContext})));
 await click('Werkstatt');expect(container.textContent).not.toContain('Kontingent');expect(container.textContent).not.toContain('Ändern');
});

it('Ansehen opens the hint month even after browsing the previous month or the same customer',async()=>{
 const readCustomerHours=vi.fn(async()=>({status:'ready' as const,value:quota}));
 const work={readCustomerHours} as unknown as MobileWorkCapability,authorityContext={role:'administrator'};
 await act(async()=>root.render(createElement(CustomersScreen,{work,authorityContext})));
 await click('Voriger Monat');expect(readCustomerHours).toHaveBeenLastCalledWith('2026-08');
 await act(async()=>root.render(createElement(CustomersScreen,{work,authorityContext,openCustomer:{customerId:cid,month:'2026-09'}})));
 expect(readCustomerHours).toHaveBeenLastCalledWith('2026-09');expect(container.textContent).toContain('Stunden je Person');
 await click('Voriger Monat');
 await act(async()=>root.render(createElement(CustomersScreen,{work,authorityContext,openCustomer:{customerId:cid,month:'2026-09'}})));
 expect(readCustomerHours).toHaveBeenLastCalledWith('2026-09');expect(container.textContent).toContain('September 2026');
});
