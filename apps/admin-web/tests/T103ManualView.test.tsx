// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ManualView from '../src/views/ManualView';
import type { AdminWebState, AdminWebCapability } from '../src/contracts';
afterEach(cleanup);
const target={targetType:'customer',targetId:'20000000-0000-4000-8000-000000000001',displayName:'Kunde X'};
const active={timeRecordId:'entry',source:'canonical',targetType:'customer',targetId:target.targetId,targetDisplayName:'Kunde X',status:'started',startedAt:'2026-10-04T06:12:00.000Z',stoppedAt:null,startedVia:'manual',stoppedVia:null,breakStartedAt:null};
const administration={loadOwnTime:vi.fn(async()=>{}),loadWorkTargets:vi.fn(async()=>{}),captureManual:vi.fn(async()=>{})} as unknown as AdminWebCapability;
it.each(['empty','running','pause','busy','offline'])('shows the %s state without a pause radio list',kind=>{
 const state={status:'ready',workTargets:{status:'ready',value:[target]},manual:{busy:kind==='busy',pending:false,message:null},
  calendar:kind==='offline'?{status:'unavailable',value:null,message:'Nicht erreichbar'}:{status:'ready',targetMembershipId:null,month:'2026-10',value:{activeRecord:kind==='empty'?null:{...active,breakStartedAt:kind==='pause'?'2026-10-04T08:30:00.000Z':null},records:[],nextCursor:null,windowStartedAt:'2026-08-31T22:00:00.000Z',windowEndedAt:'2026-10-04T09:47:00.000Z'}}} as unknown as Extract<AdminWebState,{status:'ready'}>;
 render(<ManualView state={state} administration={administration}/>);
 expect(screen.queryAllByRole('radio')).toHaveLength(0);
 if(kind==='empty')expect(screen.getByRole('button',{name:'Zeit starten'})).toBeDefined();
 if(kind==='running'||kind==='pause'){expect(screen.getByRole('button',{name:'Zeit beenden'})).toBeDefined();expect(screen.getByRole('button',{name:kind==='pause'?'Pause beenden':'Pause starten'})).toBeDefined();expect(screen.getByText(kind==='pause'?'Pause seit 10:30 · Kunde X':'Läuft seit 08:12 · Kunde X')).toBeDefined();}
 if(kind==='busy')expect(screen.getAllByRole('button').every(b=>(b as HTMLButtonElement).disabled)).toBe(true);
 if(kind==='offline')expect(screen.queryByRole('button',{name:'Zeit starten'})).toBeNull();
});
