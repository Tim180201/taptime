import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { productDestinations } from '../../src/navigation/presentation';
import { TapTimeSessionApiClient } from '../../src/auth/TapTimeSessionApiClient';
import * as calendar from '../../src/screens/ownTimeCalendar';

vi.mock('react-native', () => {
  const element = ({ children, accessibilityLabel }: {children?: ReactNode; accessibilityLabel?: string}) => createElement('div', {'aria-label':accessibilityLabel},children);
  return {View:element,Text:element,ScrollView:element,Pressable:element,TextInput:element,ActivityIndicator:element,
    StyleSheet:{create:(v:unknown)=>v,flatten:()=>({})}};
});
const id = '12000000-0000-4000-8000-000000000001';
const locationId = '51000000-0000-4000-8000-000000000001';
const session = {userId:id,membershipId:id,organizationId:id,role:'administrator' as const,nfcSetupAvailable:true};
const value = {activeRecord:null,records:[],nextCursor:null,windowStartedAt:'2026-09-15T00:00:00.000Z',windowEndedAt:'2026-09-18T12:00:00.000Z'};

describe('T059 Mobile red proofs',()=>{
  it('f: session parses organization and location scope; missing scope never enables employees',async()=>{
    for(const scope of [{kind:'organization'},{kind:'location',locationId,locationName:'Nord'}]){
      const client=new TapTimeSessionApiClient('https://example.test',async()=>Response.json({...session,managementScope:scope,locationsEnabled:true}));
      expect(await client.resolve('token')).toMatchObject({status:'resolved',session:{managementScope:scope,locationsEnabled:true}});
    }
    expect(productDestinations({...session,managementScope:{kind:'organization'}})).toEqual(['capture','times','employees','setup']); // D-090 adds own time before employees.
    expect(productDestinations(session)).not.toContain('employees');
  });
  it('g: invitation client uses exactly T047 fields, rejects authority, and every outcome has distinct German text',async()=>{
    const {TapTimeEmployeesApiClient}=await import('../../src/employees/TapTimeEmployeesApiClient');
    const {invitationMessage}=await import('../../src/employees/presentation');
    const command={expectedMembershipId:id,commandId:id,displayName:'Anna',email:'anna@example.test',locationId};
    const post=vi.fn(async(_endpoint: URL,_body: string)=>({status:'response' as const,statusCode:200,contentType:'application/json',body:JSON.stringify({status:'succeeded',membershipId:id})}));
    const client=new TapTimeEmployeesApiClient('https://example.test', {post});
    expect(await client.invite(command)).toEqual({status:'succeeded'});
    expect(String(post.mock.calls[0]![0])).toBe('https://example.test/v1/administration/employee-account-invitations');
    expect(JSON.parse(post.mock.calls[0]![1])).toEqual(command);
    const codes=['invalid_request','invalid_email','command_id_conflict','email_exists','membership_exists','former_membership',
      'account_creation_not_configured','invitation_delivery_failed','invitation_rate_limited','invitation_service_unavailable',
      'invitation_needs_attention','authority_rejected','transient_failure','unavailable','succeeded','succeeded_existing_account','rate_limited'] as const;
    expect(new Set(codes.map(code=>invitationMessage(code))).size).toBe(codes.length);
    for(const statusCode of [401,403]){
      post.mockResolvedValueOnce({status:'response',statusCode,contentType:'application/json',body:'{}'});
      expect(await client.invite(command)).toEqual({status:'authority_rejected'});
    }
    for(const code of codes.slice(0,11)){
      post.mockResolvedValueOnce({status:'response',statusCode:code==='invitation_rate_limited'?429:400,contentType:'application/json',body:JSON.stringify({error:{code}})});
      expect(await client.invite(command)).toEqual({status:code});
    }
  });
  it('h: foreign person calendar uses the own-time helpers and prints an em dash for unloaded days',async()=>{
    const {PersonTimeScreen}=await import('../../src/screens/PersonTimeScreen');
    const range=vi.spyOn(calendar,'rangeSummary');
    const person={membershipId:id,displayName:'Anna',role:'employee' as const,location:{id:locationId,name:'Nord'},
      isRunning:false,runningSince:null,runningTargetDisplayName:null};
    const html=renderToStaticMarkup(createElement(PersonTimeScreen,{person,value,onBack:()=>{},onRefresh:async()=>{}}));
    expect(range).toHaveBeenCalled();
    expect(html).toContain('—');
    expect(html).toContain('Anna');
    expect(html).toContain('Nord');
    expect(calendar.rangeSummary(value,'2026-09-01','2026-10-01').complete).toBe(false);
    range.mockRestore();
  });
});
