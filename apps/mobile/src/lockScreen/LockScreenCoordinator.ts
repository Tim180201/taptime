import type { LockScreenState, MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import type { AuthenticatedRequestCapability, MobileSessionState } from '../auth/contracts';
import type { MobileWorkSessionReader, MobileWorkState } from '../work/contracts';
import type { CaptureConnectivityPort } from '../work/MobileWorkCoordinator';
import type { AppStatePort } from '../runtime/AppStateAutoRefreshLifecycle';
import type { ProductScanCapability } from '../scan/contracts';
import type { CaptureBoundary, CaptureRejection, LockScreenNativePort, LockScreenCapability, LockScreenUiState } from './contracts';
import { issueCapability } from './issueCapability';

const WAIT='Der Stand vom Sperrbildschirm muss zuerst online abgeglichen werden. Pause und Beenden sind bis dahin gesperrt.';
const CHANGED='Der Stand hat sich geändert. Prüfe ihn und tippe erneut.';
interface Work {
  getState():MobileWorkState;
  subscribe(listener:()=>void):()=>void;
  refreshPreservingActive():Promise<boolean>;
  setCaptureBlockedReason(reason:string|null):void;
  setCaptureFeedback(message:string|null):void;
}
interface Offline {
  hasUnconfirmedCapture():Promise<boolean>;
  lockScreenInstallationId():Promise<string|null>;
}
/** Android-only owner. The existing work/event chain remains the sole app capture path. */
export class LockScreenCoordinator implements LockScreenCapability, CaptureBoundary {
  private state:LockScreenUiState={notificationsDenied:false,blockedReason:null};
  private listeners=new Set<()=>void>();
  private unsubscribers:(()=>void)[]=[];
  private owner:string|null=null;
  private readRevision:string|undefined;
  private epoch=0;
  private started=false;
  private appCapture=false;
  private rejection:CaptureRejection|null=null;
  private refreshing:Promise<void>|null=null;
  private requested=false;
  private discardPendingRequested=false;
  private scanBusy=false;
  private lastOwnTime:MobileOwnTimeQueryResponse|null=null;
  constructor(private readonly native:LockScreenNativePort,
    private readonly session:MobileWorkSessionReader & {getState():MobileSessionState},
    private readonly auth:AuthenticatedRequestCapability & {refresh():Promise<void>},
    private readonly work:Work,private readonly offline:Offline,private readonly scan:ProductScanCapability,
    private readonly connectivity:CaptureConnectivityPort,private readonly appState:AppStatePort){}
  getState=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  openSettings=()=>this.native.openSettings();
  getCaptureRejection=()=>this.rejection;
  private reject(message:string,blocked=false):false {
    this.rejection={message,blocked};this.work.setCaptureFeedback(message);return false;
  }
  start(){
    if(this.started)return;this.started=true;
    this.scanBusy=this.isScanBusy();
    this.unsubscribers=[this.session.subscribe(()=>this.onSession()),this.native.subscribe(()=>{
      this.updateUi();if(!this.appCapture)void this.refresh();
    }),this.work.subscribe(()=>{
      const state=this.work.getState();
      if(state.status==='ready' && (state.submitting||state.capturePending))this.native.awaitOwnCapture();
      if(state.status==='ready' && state.ownTime!==this.lastOwnTime){
        this.lastOwnTime=state.ownTime;
        if(!this.refreshing&&!this.appCapture)void this.refresh();
      }
    }),this.scan.subscribe(()=>this.onScan()),this.connectivity.subscribe(online=>{if(online)void this.refresh();else this.updateUi(true);})];
    let previous=this.appState.currentState;
    const subscription=this.appState.addEventListener('change',state=>{
      const returning=state==='active'&&previous!=='active';previous=state;
      if(returning)void this.refresh();
    });this.unsubscribers.push(()=>subscription.remove());
    this.onSession();
  }
  stop(){this.started=false;this.epoch++;this.unsubscribers.forEach(unsubscribe=>unsubscribe());this.unsubscribers=[];}
  private isScanBusy(){
    return ['scanning','submitting','saved_locally','synchronizing'].includes(this.scan.getState().status);
  }
  private onScan(){
    const wasBusy=this.scanBusy;
    this.scanBusy=this.isScanBusy();
    if(this.scanBusy){
      if(!wasBusy)this.epoch++; // Invalidate every read/issue chain started before this scan.
      if(['saved_locally','synchronizing'].includes(this.scan.getState().status))this.native.awaitOwnCapture();
      else this.native.suspend();
    }else if(this.scan.getState().status==='server_decision'){
      this.epoch++;
      void this.refresh(true);
    }else if(wasBusy){
      void this.refresh(); // Cancellation and read failures also finish the scan.
    }
  }
  private onSession(){
    const snapshot=this.session.capture();
    if(snapshot){
      const owner=`${snapshot.session.organizationId}/${snapshot.session.membershipId}/${snapshot.session.userId}`;
      if(owner!==this.owner){this.owner=owner;this.epoch++;this.readRevision=undefined;this.native.bind(owner);
        if(['saved_locally','synchronizing'].includes(this.scan.getState().status))this.native.awaitOwnCapture();
        void this.refresh();}
    }else if(['signed_out','unauthenticated','signing_in','enrollment_only'].includes(this.session.getState().status)){
      this.owner=null;this.epoch++;this.readRevision=undefined;this.native.clear();this.updateUi();
    }
  }
  private updateUi(offline=false){
    const stand=this.native.read();
    const stale=stand?.revision!==this.readRevision || !!stand?.pending;
    const blockedReason=stale&&offline?WAIT:null;
    const notificationsDenied=!!stand?.permissionAsked&&!stand.permissionGranted;
    if(this.state.blockedReason===blockedReason&&this.state.notificationsDenied===notificationsDenied)return;
    this.state={notificationsDenied,blockedReason};this.work.setCaptureBlockedReason(blockedReason);
    this.listeners.forEach(listener=>listener());
  }
  /** In the background only an own capture awaiting its result is reconciled; otherwise suspend() would turn live lock-screen buttons into "open app". */
  private mayRefresh(){
    return this.started&&!this.appCapture&&!this.scanBusy
      &&(this.appState.currentState!=='background'||this.native.read()?.ownCapturePending===true);
  }
  refresh(discardPending=false):Promise<void>{
    this.discardPendingRequested ||= discardPending;
    if(!this.mayRefresh())return Promise.resolve();
    if(this.refreshing){this.requested=true;return this.refreshing;}
    const run=async()=>{
      do {
        this.requested=false;
        const discard=this.discardPendingRequested,epoch=this.epoch;
        const published=await this.refreshOnce(discard);
        if(published&&epoch===this.epoch&&discard)this.discardPendingRequested=false;
      }while(this.requested&&this.mayRefresh());
    };
    this.refreshing=run().catch(()=>this.updateUi(true)).finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
  private async refreshOnce(discardPending:boolean){
    const snapshot=this.session.capture(),owner=this.owner,epoch=this.epoch;
    if(!snapshot||!owner)return;
    const current=()=>this.started&&!this.appCapture&&!this.scanBusy&&epoch===this.epoch&&this.owner===owner&&this.session.isCurrent(snapshot);
    const stand=this.native.read();
    if(!stand || stand.owner!==owner || !this.native.suspend())return;
    if(!await this.connectivity.get()){this.updateUi(true);return;}
    if(!await this.work.refreshPreservingActive() || !current())return;
    const after=this.native.read();
    if(!after || after.revision!==stand.revision)return; // A receiver result raced the read.
    if(after.pending&&!discardPending){this.updateUi();return;} // Opening the app never executes a pending command.
    this.readRevision=after.revision;
    const published=await this.publishOwnState(discardPending,current);
    this.updateUi();
    return published;
  }
  private async publishOwnState(discardPending:boolean,current:()=>boolean){
    const value=this.work.getState(),snapshot=this.session.capture(),owner=this.owner;
    if(value.status!=='ready'||!snapshot||!owner||!current())return;
    const stand=this.native.read();if(!stand?.revision||stand.owner!==owner)return;
    const pending=await this.offline.hasUnconfirmedCapture();if(!current())return;
    if(pending){this.native.awaitOwnCapture();return false;}
    const projection=ownLockScreenState(value.ownTime,stand.state);
    if(!this.native.project(owner,projection,stand.revision,discardPending))return;
    if(projection&&projection.status!=='stopped'){
      if(this.appState.currentState==='active')await this.native.ensurePermission();
      if(!current())return;
      if(!pending && await this.connectivity.get() && current()){
        const installationId=await this.offline.lockScreenInstallationId();if(!current())return;
        await issueCapability(this.auth,token=>this.native.issue(owner,token,{
          expectedMembershipId:snapshot.session.membershipId,timeEntryId:projection.timeEntryId,
          installationId,
        },stand.revision!),current);
        const issued=this.native.read()?.state;
        if(issued && (issued.timeEntryId!==projection.timeEntryId || issued.status!==projection.status
          || issued.breakStartedAt!==projection.breakStartedAt)) {
          this.readRevision=undefined;this.requested=true;
        }
      }
    }
    return current();
  }
  beforeCapture=async():Promise<boolean>=>{
    this.rejection=null;
    if(this.appCapture)return this.reject('Eine Erfassung läuft bereits. Bitte kurz warten.');
    if(this.scanBusy)return this.reject('Der Scan läuft. Beende ihn oder brich ihn ab.');
    this.appCapture=true;
    const epoch=this.epoch;
    if(!this.native.suspend()){this.appCapture=false;return this.reject('Der Stand ist gerade nicht verfügbar. Bitte erneut versuchen.');}
    const stand=this.native.read();
    if(!stand){this.appCapture=false;return this.reject('Der Stand ist gerade nicht verfügbar. Bitte erneut versuchen.');}
    if(stand.revision===this.readRevision&&!stand.pending&&!stand.ownCapturePending){
      if(this.native.awaitOwnCapture())return true;
      this.appCapture=false;return this.reject('Die Erfassung ist gerade nicht möglich. Bitte erneut versuchen.');
    }
    try {
      if(stand.ownCapturePending && await this.offline.hasUnconfirmedCapture())
        return this.reject('Deine letzte Erfassung wartet noch auf Bestätigung.',true);
      if(!await this.connectivity.get()){this.updateUi(true);return this.reject(WAIT,true);}
      if(stand.pending && !stand.ownCapturePending)await this.native.retry();
      const after=this.native.read();
      if(after?.pending || !await this.work.refreshPreservingActive() || epoch!==this.epoch)return this.reject(WAIT,true);
      const final=this.native.read();
      if(!final || final.revision!==after?.revision)return this.reject(WAIT,true);
      this.readRevision=final.revision;
      this.updateUi();
      // The pressed label belonged to an older state. Never toggle its opposite.
      return this.reject(CHANGED);
    } finally {
      this.appCapture=false;
      if(epoch===this.epoch)void this.refresh();
    }
  };
  afterCapture=async():Promise<void>=>{
    this.appCapture=false;
    if(!this.started)return;
    this.native.awaitOwnCapture();
    // A queued event is not a confirmed clock. Only a new successful read can replace this notice.
    await this.refresh(true);
    this.updateUi();
  };

}

export function ownLockScreenState(own:MobileOwnTimeQueryResponse,previous?:LockScreenState):LockScreenState|null{
  const record=own.activeRecord ?? (previous && previous.status!=='stopped' ? own.records.find(record=>record.timeRecordId===previous.timeEntryId) : undefined);
  if(!record?.targetId||!record.calendar)return null;
  return {timeEntryId:record.timeRecordId,status:record.stoppedAt?'stopped':record.breakStartedAt?'paused':'running',
    startedAt:record.startedAt,stoppedAt:record.stoppedAt,breakStartedAt:record.breakStartedAt??null,
    asOf:record.calendar.asOf,workDurationSeconds:record.calendar.workDurationSeconds,breakDurationSeconds:record.calendar.breakDurationSeconds,
    target:{targetType:record.targetType,targetId:record.targetId,displayName:record.targetDisplayName}};
}
