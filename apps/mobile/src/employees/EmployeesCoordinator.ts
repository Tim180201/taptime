import type { InternalAuthenticatedSessionSnapshot } from '../auth/contracts';
import type { AdminSessionContextReader } from '../administration/contracts';
import { businessDay, dayStart, shiftMonth } from '../screens/ownTimeCalendar';
import type { EmployeesApiPort, EmployeesCapability, EmployeesState, InvitationCommand, ManagedPerson, EmployeeLocation } from './contracts';

/** Owns only volatile view state. No token, person cache or invitation enters offline storage. */
export class EmployeesCoordinator implements EmployeesCapability {
  private state: EmployeesState = {status:'inactive'};
  private readonly listeners = new Set<()=>void>();
  private unsubscribe: (()=>void) | null = null;
  private generation = 0;
  private entered = false;
  private running = true;
  private personMonth: string | null = null;
  private invitation: InvitationCommand | null = null;
  constructor(private readonly session: AdminSessionContextReader, private readonly api: EmployeesApiPort,
    private readonly createCommandId: ()=>string, private readonly now: ()=>number = Date.now) {}
  start(): void {
    this.unsubscribe ??= this.session.subscribe(()=>{
      this.generation++; this.invitation = null;
      this.publish({status:'inactive'});
      if (this.entered) void this.refresh();
    });
  }
  stop(): void { this.leave(); this.unsubscribe?.(); this.unsubscribe=null; }
  leave(): void { this.entered=false; this.generation++; this.invitation=null; this.publish({status:'inactive'}); }
  getState(): EmployeesState { return this.state; }
  subscribe(listener: ()=>void): ()=>void { this.listeners.add(listener); return ()=>{this.listeners.delete(listener);}; }
  async refresh(): Promise<void> {
    this.entered=true;
    if (this.state.status === 'person') { await this.readPerson(this.state.person,this.personMonth ?? undefined); return; }
    await this.loadList();
  }
  async filter(isRunning: boolean): Promise<void> { this.running=isRunning; await this.loadList(); }
  async back(): Promise<void> { this.invitation=null; await this.loadList(); }
  async loadMore(): Promise<void> { if (this.state.status==='list' && !this.state.busy && this.state.summary.nextCursor!==null) await this.loadList(true); }
  private async loadList(more=false): Promise<void> {
    const snapshot=this.capture(); if (!snapshot) return;
    const current=this.state;
    const old=more && current.status==='list' ? current.summary : null;
    const cursor=old?.nextCursor ?? null;
    const generation=++this.generation;
    this.publish(old ? {status:'list',summary:old,filter:this.running,busy:true,failed:false} : {status:'loading'});
    const result=await this.api.summary({expectedMembershipId:snapshot.session.membershipId,locationId:null,isRunning:this.running,cursor,limit:20});
    if (!this.current(generation,snapshot)) return;
    if (result.status==='authority_rejected') { this.publish({status:'not_authorized'}); return; }
    if (result.status!=='ready' || (old && (result.value.nextCursor===cursor || result.value.people.some(p=>old.people.some(o=>o.membershipId===p.membershipId))))) {
      this.publish(old ? {status:'list',summary:old,filter:this.running,busy:false,failed:true} : {status:'unavailable'}); return;
    }
    this.publish({status:'list',summary:{...result.value,people:old ? [...old.people,...result.value.people] : result.value.people},filter:this.running,busy:false,failed:false});
  }
  async openPerson(person: ManagedPerson): Promise<void> { await this.readPerson(person); }
  async loadPersonMonth(month: string): Promise<void> {
    if (this.state.status !== 'person' || !/^\d{4}-\d{2}$/.test(month) || Number(month.slice(5)) < 1 || Number(month.slice(5)) > 12) return;
    if (dayStart(`${month}-01`) >= this.now()) return; // Future days remain outside the loaded window.
    await this.readPerson(this.state.person,month);
  }
  private async readPerson(person: ManagedPerson, requestedMonth?: string): Promise<void> {
    const snapshot=this.capture(); if (!snapshot) return;
    const generation=++this.generation;
    // A calendar month is bounded by Berlin midnight; October can contain 745 hours.
    const month=requestedMonth ?? businessDay(this.now()).slice(0,7);
    this.personMonth=month;
    const previous=this.state.status==='person' && this.state.person.membershipId===person.membershipId ? this.state.value : null;
    const fromInclusive=new Date(dayStart(`${month}-01`)).toISOString();
    const toExclusive=new Date(Math.max(dayStart(`${month}-01`)+1,Math.min(this.now(),dayStart(`${shiftMonth(month,1)}-01`)))).toISOString();
    this.publish({status:'person',person,value:previous,busy:true,failed:false});
    let cursor: string|null=null;
    const cursors=new Set<string>();
    let records: import('@taptime/mobile-work-contract').MobileOwnTimeQueryResponse['records']=[];
    for (;;) {
      const result=await this.api.personTime({expectedMembershipId:snapshot.session.membershipId,targetMembershipId:person.membershipId,
        fromInclusive,toExclusive,cursor,limit:20});
      if (!this.current(generation,snapshot)) return;
      if (result.status==='authority_rejected') { this.publish({status:'not_authorized'}); return; }
      if (result.status!=='ready' || result.value.windowStartedAt!==fromInclusive || result.value.windowEndedAt!==toExclusive
        || (result.value.nextCursor!==null && result.value.records.length===0)
        || result.value.records.some(r=>records.some(old=>old.timeRecordId===r.timeRecordId))
        || (result.value.nextCursor!==null && cursors.has(result.value.nextCursor))) {
        const state=this.state;
        this.publish({status:'person',person,value:state.status==='person' ? state.value : null,busy:false,failed:true}); return;
      }
      records=[...records,...result.value.records];
      this.publish({status:'person',person,value:{...result.value,records},busy:result.value.nextCursor!==null,failed:false});
      cursor=result.value.nextCursor;
      if (cursor===null) return;
      cursors.add(cursor);
    }
  }
  async openInvitation(): Promise<void> {
    const snapshot=this.capture(); if (!snapshot) return;
    const generation=++this.generation;
    this.invitation=null;
    const scope=snapshot.session.managementScope!;
    if (scope.kind==='location') {
      this.publish({status:'invite',locations:[{id:scope.locationId,name:scope.locationName}],locationsReady:true,busy:false,outcome:null}); return;
    }
    this.publish({status:'invite',locations:[],locationsReady:snapshot.session.locationsEnabled===false,busy:false,outcome:null});
    if (snapshot.session.locationsEnabled===false) return;
    let cursor: string|null=null;
    const cursors=new Set<string>();
    const locations: EmployeeLocation[]=[];
    for (;;) {
      const result=await this.api.locations(snapshot.session.membershipId,cursor);
      if (!this.current(generation,snapshot)) return;
      if (result.status!=='ready' || result.value.locations.some(l=>locations.some(old=>old.id===l.id))
        || (result.value.nextCursor!==null && cursors.has(result.value.nextCursor))) {
        this.publish({status:'invite',locations:[],locationsReady:false,busy:false,outcome:result.status==='authority_rejected' ? 'authority_rejected' : 'unavailable'}); return;
      }
      locations.push(...result.value.locations);
      cursor=result.value.nextCursor;
      if (cursor===null) break;
      cursors.add(cursor);
    }
    this.publish({status:'invite',locations,locationsReady:true,busy:false,outcome:null});
  }
  async invite(displayName: string,email: string,locationId: string|null): Promise<void> {
    const snapshot=this.capture(); const state=this.state;
    if (!snapshot || state.status!=='invite' || state.busy || !state.locationsReady) return;
    const scope=snapshot.session.managementScope!;
    const location=scope.kind==='location' ? scope.locationId : snapshot.session.locationsEnabled===false ? null : locationId;
    if (!displayName.trim() || [...displayName.trim()].length>80 || (location!==null && !state.locations.some(l=>l.id===location))
      || (snapshot.session.locationsEnabled!==false && location===null)) {
      this.publish({...state,outcome:'invalid_request'}); return;
    }
    const input={expectedMembershipId:snapshot.session.membershipId,displayName:displayName.trim(),email:email.trim(),locationId:location};
    // Keep the command ID on an uncertain retry; a deliberate input change creates a new command.
    if (!this.invitation || Object.entries(input).some(([key,value])=>this.invitation![key as keyof InvitationCommand]!==value)) {
      this.invitation={...input,commandId:this.createCommandId()};
    }
    const generation=++this.generation;
    this.publish({...state,busy:true,outcome:null});
    const result=await this.api.invite(this.invitation);
    if (!this.current(generation,snapshot)) return;
    this.publish({...state,busy:false,outcome:result.status});
  }
  private capture(): InternalAuthenticatedSessionSnapshot|null {
    const snapshot=this.session.capture();
    if (!this.entered || snapshot===null || snapshot.session.managementScope==null) {
      this.publish({status:'not_authorized'}); return null;
    }
    return snapshot;
  }
  private current(generation:number,snapshot:InternalAuthenticatedSessionSnapshot): boolean {
    return this.entered && generation===this.generation && this.session.isCurrent(snapshot);
  }
  private publish(state:EmployeesState): void { this.state=Object.freeze(state); for(const listener of this.listeners) listener(); }
}
