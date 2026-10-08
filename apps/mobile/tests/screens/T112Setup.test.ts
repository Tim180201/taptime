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
    TextInput: ({ value, onChangeText, accessibilityLabel, editable }: { editable?: boolean; value: string; onChangeText: (value: string) => void; accessibilityLabel: string }) =>
      createElement('input', { value, disabled: editable === false, 'aria-label': accessibilityLabel, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value) }),
    StyleSheet: { create: (value: unknown) => value }, Platform: { OS: 'android' },
    BackHandler: { addEventListener: () => ({ remove() {} }) },
    AccessibilityInfo: { isReduceMotionEnabled: async () => native.reduced, addEventListener: () => ({ remove() {} }) },
  };
});


const {AdminSetupScreen,presentAdminSetupState}=await import('../../src/screens/AdminSetupScreen');
import type {AdminSetupCapability,AdminSetupState} from '../../src/administration/contracts';
let root:Root,container:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const customers=[{id:'one',displayName:'Werkstatt',active:true},{id:'two',displayName:'Lager',active:true},{id:'long',displayName:'😀'.repeat(90),active:true}];
const projection={organization:{id:'org',name:'Betrieb'},customers,nfcTags:[],nextCursor:null};
function setup(state:AdminSetupState={status:'ready',projection,outcome:null}){
 const listeners=new Set<()=>void>();
 const administration={getState:()=>state,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},refresh:vi.fn(async()=>{}),cancel:vi.fn(async()=>{}),provision:vi.fn(async()=>{}),provisionBreak:vi.fn(async()=>{})} as unknown as AdminSetupCapability;
 return {administration,set(next:AdminSetupState){state=next;listeners.forEach(fn=>fn());}};
}
const click=async(text:string)=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===text||b.getAttribute('aria-label')===text);if(!b)throw Error(text);await act(async()=>b.click());};
const input=()=>container.querySelector<HTMLInputElement>('[aria-label="Bezeichnung der Karte"]')!;
it('T112 defaults follow the target until manually edited, with Unicode-safe truncation',async()=>{
 const c=setup();await act(async()=>root.render(createElement(AdminSetupScreen,{administration:c.administration})));
 await click('Karte einrichten');await click('Werkstatt');expect(input().value).toBe('Werkstatt');
 await click('Lager');expect(input().value).toBe('Lager');await click('Pause');expect(input().value).toBe('Pause');
 await click(customers[2]!.displayName);expect(Array.from(input().value)).toHaveLength(80);
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input(),'Eigener Name');input().dispatchEvent(new Event('input',{bubbles:true}));});
 await click('Werkstatt');expect(input().value).toBe('Eigener Name');
 expect(container.textContent).not.toContain('eindeutige');
});
it('T112 restores and locks an uncertain command after reopening, offering its exact retry',async()=>{
 const c=setup({status:'ready',projection,outcome:{status:'request_failed'},pendingTag:{customerId:'one',displayName:'Fest'}});
 await act(async()=>root.render(createElement(AdminSetupScreen,{administration:c.administration})));
 expect(input().value).toBe('Fest');expect(input().disabled).toBe(true);
 await click('Zuordnung erneut versuchen');expect(c.administration.provision).toHaveBeenCalledWith('one','Fest');
});
it('T112 explains offline setup before NFC opens',()=>{
 expect(presentAdminSetupState({status:'ready',projection,outcome:{status:'setup_offline'}}).message).toBe('Zum Einrichten brauchst du eine Internetverbindung.');
});
