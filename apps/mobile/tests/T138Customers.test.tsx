// @vitest-environment jsdom
import { act, createElement, useEffect, useState, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('react-native',()=>{
  const element=({children,onPress,accessibilityLabel,accessibilityRole,role,disabled,onLayout}:any)=>{useEffect(()=>{onLayout?.({nativeEvent:{layout:{height:844}}});},[]);return createElement(onPress?'button':'div',{onClick:onPress,'aria-label':accessibilityLabel,role:role??accessibilityRole,disabled},children);};
  return {View:element,Text:element,Pressable:element,ScrollView:element,RefreshControl:()=>null,
    TextInput:({value,onChangeText,accessibilityLabel}:any)=>createElement('input',{value,'aria-label':accessibilityLabel,onChange:(e:any)=>onChangeText(e.target.value)}),
    Modal:element,StyleSheet:{create:(v:unknown)=>v},Platform:{OS:'android'},BackHandler:{addEventListener:()=>({remove(){}})},AccessibilityInfo:{announceForAccessibility(){},isReduceMotionEnabled:async()=>false,addEventListener:()=>({remove(){}})}};
});
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
vi.mock('react-native-svg',()=>({default:({children}: {children:ReactNode})=>createElement('svg',{},children),Path:()=>null}));
import { CustomerManagement } from '../src/screens/CustomerManagement';
import { CustomersScreen } from '../src/screens/CustomersScreen';
const id=(n:number)=>`13800000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const customer={customerId:id(1),displayName:'Kunde A',active:true,workDurationSeconds:7200,running:false,quotaSeconds:null,quotaStage:'none'};
const person={membershipId:id(2),displayName:'Anna',workDurationSeconds:7200,running:false};
const authority={role:'administrator'};
afterEach(cleanup);
it('T138 app: deletion is a separate dialog and cancellation is primary',()=>{
  const manageCustomer=vi.fn();
  render(<CustomerManagement customer={customer} administration={{manageCustomer} as any} onSaved={()=>{}}/>);
  const trigger=screen.getByRole('button',{name:'Kunde löschen'});
  fireEvent.click(trigger);
  const dialog=screen.getByRole('alertdialog');
  expect(within(dialog).getByRole('button',{name:'Abbrechen'})).toBeInTheDocument();
  expect(dialog.contains(trigger)).toBe(false);
  fireEvent.click(trigger);
  expect(manageCustomer).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button',{name:'Abbrechen'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('T138 app: each person opens their customer days and month changes keep the subview',async()=>{
  const querySearch=vi.fn(async(kind:string,request:any)=>({status:'ready',value:kind==='customer_detail'
    ?{version:'customer-hours.detail.v1',scope:'people',asOf:'2026-10-27T09:00:00.000Z',customer,people:[person],nextCursor:null}
    :{version:'customer-hours.person-days.v1',asOf:'2026-10-27T09:00:00.000Z',customer:{customerId:customer.customerId,displayName:customer.displayName},person,days:request.fromInclusive.startsWith('2026-09-30')?[{date:'2026-10-02',workDurationSeconds:7200,running:false}]:[],nextCursor:null}}));
  render(<CustomersScreen work={{querySearch} as any} authorityContext={authority} openCustomer={{customerId:customer.customerId,month:'2026-10'}}/>);
  fireEvent.click(await screen.findByRole('button',{name:/Tage von Anna/}));
  expect(await screen.findByText('02.10.2026')).toBeInTheDocument();
  expect(querySearch).toHaveBeenLastCalledWith('customer_person_days',expect.objectContaining({customerId:id(1),targetMembershipId:id(2)}));
  fireEvent.click(screen.getByRole('button',{name:'Voriger Monat'}));
  expect(await screen.findByText('In diesem Monat noch keine Stunden.')).toBeInTheDocument();
  expect(querySearch).toHaveBeenLastCalledWith('customer_person_days',expect.objectContaining({targetMembershipId:id(2),fromInclusive:'2026-08-31T22:00:00.000Z'}));
  fireEvent.click(screen.getByRole('button',{name:'Zurück zum Kunden'}));
  expect(await screen.findByRole('button',{name:/Tage von Anna/})).toBeInTheDocument();
});
