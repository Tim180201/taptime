// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('react-native',()=>{
  const element=({children,onPress,accessibilityLabel,accessibilityRole,role,disabled}:any)=>createElement(onPress?'button':'div',{onClick:onPress,'aria-label':accessibilityLabel,role:role??accessibilityRole,disabled},children);
  return {View:element,Text:element,Pressable:element,ScrollView:element,RefreshControl:()=>null,
    TextInput:({value,onChangeText,accessibilityLabel}:any)=>createElement('input',{value,'aria-label':accessibilityLabel,onChange:(e:any)=>onChangeText(e.target.value)}),
    StyleSheet:{create:(v:unknown)=>v},Platform:{OS:'android'},BackHandler:{addEventListener:()=>({remove(){}})},AccessibilityInfo:{announceForAccessibility(){},isReduceMotionEnabled:async()=>false,addEventListener:()=>({remove(){}})}};
});
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
vi.mock('react-native-svg',()=>({default:({children}: {children:ReactNode})=>createElement('svg',{},children),Path:()=>null}));
import { CustomerQuotaNotice as AppNotice } from '../../src/screens/QuotaNotice';
import { CustomerQuotaNotice as WebNotice } from '../../../admin-web/src/QuotaNotice';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const page=(n:number,nextCursor:string|null)=>({version:'customer-quota-alerts.v1',scope:'people',asOf:'2026-10-14T08:00:00.000Z',
 customers:[{customerId:id(n),displayName:`Kunde ${n}`,active:true,workDurationSeconds:3600,running:false,quotaSeconds:3600,quotaStage:'exceeded'}],nextCursor});
afterEach(()=>{cleanup();vi.useRealTimers();});
it.each(['app','web'])('%s: notices page only after acknowledgement, skip seen pages and never read all hours',async mode=>{
 vi.setSystemTime(new Date('2026-10-14T08:00:00Z'));
 const readCustomerHours=vi.fn(),readQuotaAlerts=vi.fn().mockResolvedValueOnce({status:'ready',value:page(1,'two')})
  .mockResolvedValueOnce({status:'ready',value:page(2,'three')}).mockResolvedValueOnce({status:'ready',value:page(3,null)});
 const cap:any={readQuotaAlerts,readCustomerHours};const saved=new Set<string>();
 const storage={read:async(key:string)=>key.includes(id(2))||saved.has(key)?'1':null,write:async(key:string)=>{saved.add(key);}};
 const onView=vi.fn(),props={membership:id(9),role:'administrator',onView,storage};
 render(mode==='app'?<AppNotice {...props} work={cap} authorityContext={cap}/>:<WebNotice {...props} administration={cap} authorityContext="one"/>);
 expect(await screen.findByText(/Kunde 1: Kontingent/)).toBeInTheDocument();expect(readQuotaAlerts).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Schließen'}));
 expect(await screen.findByText(/Kunde 3: Kontingent/)).toBeInTheDocument();
 expect(readQuotaAlerts.mock.calls).toEqual([['2026-10',null],['2026-10','two'],['2026-10','three']]);
 fireEvent.click(screen.getByRole('button',{name:'Ansehen'}));await act(async()=>{});
 expect(onView).toHaveBeenCalledWith(id(3),'2026-10');expect(readCustomerHours).not.toHaveBeenCalled();
});
