import { PasswordResetPage } from '../src/PasswordResetPage';
import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { WelcomePage } from '../src/WelcomePage';
import { createApplicationPage } from '../src/ApplicationRoot';
import type { AdminWebCapability, AdminWebState } from '../src/contracts';
const organization = { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' };
const customer = {
  id: '40000000-0000-4000-8000-000000000001',
  displayName: 'Werkstatt',
  active: true,
};
const tag = {
  id: '50000000-0000-4000-8000-000000000001',
  displayName: 'Eingang',
  validationFingerprint: 'A1B2C3D4E5F6',
  assignmentState: 'assigned' as const,
  assignmentType: 'work' as const,
  targetCustomerId: customer.id,
  activeAssignmentId: '60000000-0000-4000-8000-000000000001',
};
const record = {
  timeRecordId: '80000000-0000-4000-8000-000000000001',
  employeeDisplayName: 'Employee Alpha',
  targetType: 'project' as const,
  targetDisplayName: 'Werkstatt',
  startedVia: null,
  stoppedVia: null,
  source: 'recovered' as const,
  status: 'stopped' as const,
  startedAt: '2026-07-20T08:00:00.000Z',
  stoppedAt: '2026-07-20T16:00:00.000Z',
  baseRowVersion: 0,
  effectiveRevisionNumber: 2,
  overlapsAnotherRecord: true,
};
const reviewItem = {
  employeeMembershipId: '70000000-0000-4000-8000-000000000001',
  reviewItemId: '90000000-0000-4000-8000-000000000001',
  source: 'offline_v2' as const,
  employeeDisplayName: 'Employee Alpha',
  targetType: 'project' as const,
  targetDisplayName: 'Werkstatt',
  triggerType: 'manual' as const,
  occurredAt: '2026-07-20T09:00:00.000Z',
  reviewReason: 'predecessor_requires_review',
  deviceSequence: 7,
  predecessorBlocked: true,
};
const readyState: Extract<AdminWebState, { readonly status: 'ready' }> = {
  role: 'administrator',
  status: 'ready',
  projection: {
    organization,
    customers: [customer],
    nfcTags: [tag],
    nextCursor: null,
    customersComplete: true,
    nfcTagsComplete: true,
  },
  employeeProjection: {
    organization,
    employeeMemberships: [{
      id: '70000000-0000-4000-8000-000000000001',
      displayName: 'Employee Alpha',
      role: 'employee',
      active: true,
      rowVersion: 1,
      location: null,
    }],
    nextCursor: null,
  },
  creating: false,
  creatingEmployee: false,
  invitation: null,
  reassignmentIntent: null,
  reassigning: false,
  locationsEnabled: false,
  availableSections: ['setup', 'employees', 'time_records', 'time_export', 'review_items'],
  managementScope: { kind: 'organization' },
  selectedLocation: null,
  assignableLocations: [],
  locationSetup: null,
  locationSetupBusy: false,
  timeRecords: [record],
  timeRecordsNextCursor: null,
  reviewItems: [reviewItem],
  reviewItemsNextCursor: null,
  sections: {
    setup: { status: 'ready' },
    employees: { status: 'ready' },
    timeRecords: { status: 'ready' },
    reviewItems: { status: 'ready' },
  },
  timeWindow: {
    fromInclusive: '2026-06-20T12:00:00.000Z',
    toExclusive: '2026-07-21T12:00:00.000Z',
  },
  timeReviewBusy: false,
  correctionIntent: null,
  adjudicationIntent: null,
  notice: null,
  completedAction: null,
};
class FakeCapability implements AdminWebCapability {
  state: AdminWebState;
  private readonly listeners = new Set<() => void>();
  constructor(state: AdminWebState) { this.state = state; }
  loadReviewDay = async (reviewItemId:string) => {
    if(this.state.status==='ready')this.emit({...this.state,reviewDay:{reviewItemId,status:'ready',value:{activeRecord:null,records:[],nextCursor:null,windowStartedAt:'2026-07-19T22:00:00.000Z',windowEndedAt:'2026-07-20T22:00:00.000Z'}}});
  };
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  emit(state: AdminWebState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  readCustomerHours = async (): Promise<import('@taptime/mobile-work-contract').CustomerHoursResult> => {
    if (variant==='customers-error') return {status:'unavailable'};
    const quotaVariant=variant.startsWith('quota-');
    const base={customerId:customer.id,displayName:'Werkstatt am Park',active:true,workDurationSeconds:quotaVariant?(variant==='quota-exceeded'?144000:129600):115200,running:true};
    const empty={...base,customerId:'40000000-0000-4000-8000-000000000002',displayName:'Kunde ohne Stunden',workDurationSeconds:0,running:false};
    const former={...base,customerId:'40000000-0000-4000-8000-000000000003',displayName:'Ehemaliger Kunde',active:false,workDurationSeconds:3600,running:false};
    const common={version:quotaVariant?'customer-hours.v2' as const:'customer-hours.v1' as const,asOf:'2026-09-23T12:00:00.000Z'};
    if(this.state.status==='ready' && this.state.role==='employee') return {status:'ready',value:{...common,scope:'self',customers:[base,empty,former].map(c=>({...c,days:c.workDurationSeconds?[{date:'2026-09-23',workDurationSeconds:c.workDurationSeconds,running:c.running}]:[]}))}};
    return {status:'ready',value:{...common,scope:'people',customers:variant==='customers-empty'?[]:[base,empty,former].map(c=>({...c,...(quotaVariant?{quotaSeconds:c.customerId===customer.id?144000:null,quotaStage:c.customerId!==customer.id?'none' as const:variant==='quota-exceeded'?'exceeded' as const:'warning' as const}:{}),people:c.workDurationSeconds?[{membershipId:'70000000-0000-4000-8000-000000000001',displayName:'Alex Beispiel',workDurationSeconds:c.workDurationSeconds,running:c.running}]:[]}))}};
  };
  setCustomerQuota = async () => ({status:'succeeded' as const});
  signIn = async () => undefined;
  requestPasswordReset = async () => undefined;
  completePasswordRecovery = async () => undefined;
  signOut = async () => undefined;
  refresh = async () => undefined;
  selectLocation = async () => undefined;
  setTimeWindow = async () => undefined;
  loadPersonTime = async (targetMembershipId:string,month:string) => {
    if(this.state.status==='ready' && this.state.calendar?.status==='ready')
      this.emit({...this.state,calendar:{...this.state.calendar,targetMembershipId,month}});
  };
  retrySection = async () => undefined;
  loadMore = async () => undefined;
  createCustomer = async () => undefined;
  createEmployeeInvitation = async () => undefined;
  revokeMembership = async () => undefined;
  changeMembershipRole = async () => undefined;
  loadMoreEmployees = async () => undefined;
  dismissInvitation = () => undefined;
  prepareReassignment = () => undefined;
  cancelReassignment = () => undefined;
  confirmReassignment = async () => undefined;
  prepareCorrection = () => undefined;
  cancelCorrection = () => undefined;
  confirmCorrection = async () => undefined;
  prepareAdjudication = () => undefined;
  cancelAdjudication = () => undefined;
  confirmAdjudication = async () => undefined;
  exportTimeRecords = async () => undefined;
  loadMoreTimeRecords = async () => undefined;
  loadMoreReviewItems = async () => undefined;
  refreshProjects = async () => undefined;
  refreshLocationSetup = async () => undefined;
  createLocation = async () => undefined;
  renameLocation = async () => undefined;
  deactivateLocation = async () => undefined;
  setHomeLocation = async () => undefined;
  setWorkLocation = async () => undefined;
  setManagementLocation = async () => undefined;
  setWorkTargetLocation = async () => undefined;
  setLocationsEnabled = async () => undefined;
}

// Only imported by the browser-test build. No fixture is reachable from src/main.tsx.
const variant = window.location.hash.slice(1) || (window as unknown as { layoutScenario: string }).layoutScenario;
const own = '10000000-0000-4000-8000-000000000001';
const person = readyState.employeeProjection.employeeMemberships[0]!;
const location = { id: '31000000-0000-4000-8000-000000000001', name: 'Standort am langen Beispielweg' };
const details = { origin: 'backfilled' as const, baseRowVersion: 0, effectiveRevisionNumber: 2,
  comment: 'Beim Kunden vor Ort', changed: true, change: { at: '2026-09-23T10:00:00.000Z', reason: 'Vergessenen Beginn berichtigt', actor: 'administration' as const }, overlapsAnotherRecord: true };
const entry = { ...record, calendar:{asOf:'2026-09-23T12:00:00.000Z',workDurationSeconds:5400,breakDurationSeconds:1800,breakIntervals:[{startedAt:'2026-09-23T09:00:00.000Z',stoppedAt:'2026-09-23T09:30:00.000Z'}]}, employeeDisplayName: 'Alexandra Beispiel', targetDisplayName: 'Werkstatt am Beispielweg',
  startedAt: '2026-09-23T08:00:00.000Z', stoppedAt: '2026-09-23T10:00:00.000Z', details };
let ready: Extract<AdminWebState, { status: 'ready' }> = { ...readyState,
  membershipId: own,
  projection: { ...readyState.projection, organization: { ...organization, name: 'Beispiel Gebäudereinigung' } },
  availableSections: ['setup','employees','time_records','time_export','review_items','own_time','manual_capture'],
  timeRecords: [entry],
  projects: [{ projectId: customer.id, displayName: 'Projekt Nord', active: true, rowVersion: 1 }], projectsNextCursor: null,
  workTargets: { status: 'ready', value: [{ targetType: 'customer', targetId: customer.id, displayName: 'Werkstatt am Beispielweg' }] },
  manual: { busy: false, pending: false, message: null },
  managedPeople: { month:'2026-09',status: 'ready', isRunning: null, value: { packageUsage:{packageSize:10,activeAccessCount:12}, serverTime: '2026-09-23T11:00:00.000Z', runningCount: 1, totalCount: 2, nextCursor: null,
    people: [{ membershipId: person.id, displayName: 'Alexandra Beispiel', role: 'employee', location, isRunning: true, runningSince: entry.startedAt, runningTargetDisplayName: entry.targetDisplayName },
      { membershipId: own, displayName: 'Martin Beispiel', role: 'administrator', location: null, isRunning: false, runningSince: null, runningTargetDisplayName: null }] } },
  calendar: { status: 'ready', targetMembershipId: window.location.pathname.includes('/beschaeftigte/') ? person.id : null, month: '2026-09',
    value: { records: [entry], activeRecord: null, nextCursor: null, windowStartedAt: '2026-08-31T22:00:00.000Z', windowEndedAt: '2026-09-23T12:00:00.000Z' } },
  assignableLocations: [location],
  locationSetup: { locations: [{ id: location.id, displayName: location.name, active: true, rowVersion: 1 }],
    memberships: [{ id: own, displayName: 'Martin Beispiel', role: 'administrator', homeLocationId: location.id, workLocationIds: [location.id], managementLocationIds: [] }],
    workTargets: [{ targetType: 'customer', targetId: customer.id, displayName: 'Werkstatt', locationId: location.id }], activationGaps: [] },
};
if (variant.startsWith('t110-next-')) {
  const step=Number(variant.slice('t110-next-'.length));
  ready={...ready,locationsEnabled:step>1,
    locationSetup:{...ready.locationSetup!,memberships:[{...ready.locationSetup!.memberships[0]!,role:'standortleitung',managementLocationIds:step>2?[location.id]:[]}]},
    projection:{...ready.projection,customers:step>3?[customer]:[],nfcTags:step>4?[tag]:[]},projects:[],
    employeeProjection:{...ready.employeeProjection,employeeMemberships:step>5?[person]:[]},timeRecords:[],reviewItems:[]};
}
if (variant==='t110-role') ready={...ready,roleAssignmentMembershipId:person.id,notice:{kind:'success',text:'Rolle geändert. Weisen Sie jetzt die Standorte zu, die diese Person verwalten darf.'}};
if (variant==='t110-review-context') ready={...ready,reviewDay:{reviewItemId:reviewItem.reviewItemId,status:'ready',value:{activeRecord:null,records:[record],nextCursor:null,windowStartedAt:'2026-07-19T22:00:00.000Z',windowEndedAt:'2026-07-20T22:00:00.000Z'}}};
if (variant==='departed') ready={...ready,managedPeople:{month:'2026-09',status:'ready',isRunning:null,value:{...ready.managedPeople!.value!,
  people:[...ready.managedPeople!.value!.people,{membershipId:'70000000-0000-4000-8000-000000000002',displayName:'Erika Ausgeschieden',
    role:'employee',location,isRunning:false,runningSince:null,runningTargetDisplayName:null,departedAt:'2026-09-01T12:00:00.000Z'}]}}};
if (['employees','manager','departed'].includes(variant)) ready={...ready,locationsEnabled:true,
  managedPeople:{...ready.managedPeople!,status:'ready',value:{...ready.managedPeople!.value!,
    people:ready.managedPeople!.value!.people.map((person,index)=>({...person,departedAt:person.departedAt??null,
      location:variant==='manager'?location:person.location,monthWorkDurationSeconds:index===0?129600:0}))}}};
if (['employee-revoke-running','employee-revoke-long'].includes(variant)) ready={...ready,calendar:{...ready.calendar!,status:'ready',value:{...ready.calendar!.value!,
  activeRecord:{...entry,status:'started',stoppedAt:null,startedAt:variant==='employee-revoke-long'?'2026-09-22T11:59:00.000Z':'2026-09-22T12:01:00.000Z'}}}};
if (variant==='review-location') ready={...ready,reviewItems:[{...reviewItem,reviewReason:'work_location_unavailable',predecessorBlocked:false}]};
if (variant==='customers-employee' || variant==='quota-employee') ready={...ready,role:'employee',availableSections:['own_time','manual_capture']};
if (variant==='customers-manager' || variant==='quota-manager') ready={...ready,role:'standortleitung',availableSections:['employees','own_time','manual_capture','review_items']};
if (['employee-calendar','employee-backfill','employee-comment','employee-void'].includes(variant)) ready = { ...ready, role: 'employee', availableSections: ['own_time','manual_capture'] };
if (variant.startsWith('manager')) ready = { ...ready, role: 'standortleitung', availableSections: ['employees','own_time','manual_capture','time_records','review_items'], locationsEnabled: true,
  selectedLocation: location, managementScope: { kind: 'locations', locations: [location, { ...location, id: '31000000-0000-4000-8000-000000000002', name: 'Nord' }] } };
if (variant.startsWith('invitation-')) ready = { ...ready, locationsEnabled: true, selectedLocation: null, assignableLocations: [location, { ...location, id: '31000000-0000-4000-8000-000000000002', name: 'Nord' }] };
if (variant === 'setup-targets-locations') ready = { ...ready, locationsEnabled: true,
  assignableLocations: [location, { ...location, id: '31000000-0000-4000-8000-000000000002', name: 'Nord' }] };
if (variant === 'payroll') ready = { ...ready, timeWindow: {fromInclusive:'2026-08-25T12:00:00.000Z',toExclusive:'2026-09-25T12:00:00.000Z'} };
if (variant === 'payroll-month') ready = { ...ready, timeWindow: {fromInclusive:'2026-08-31T22:00:00.000Z',toExclusive:'2026-09-30T22:00:00.000Z'} };
if (variant === 'five-areas') ready = { ...ready, availableSections: readyState.availableSections };
if (['time-stop','manager-time-stop','manager-own-stop'].includes(variant)) ready = { ...ready, calendar: { ...ready.calendar!, status: 'ready', value: { ...ready.calendar!.value!, records: [], activeRecord: { ...entry, status: 'started', stoppedAt: null } } } };
if (variant === 'empty') ready = { ...ready, employeeProjection: { ...ready.employeeProjection, employeeMemberships: [] }, managedPeople: { ...ready.managedPeople!, status: 'ready', value: { ...ready.managedPeople!.value!, people: [], totalCount: 0, runningCount: 0 } } };
if (variant === 'section-error') ready = { ...ready, sections: { ...ready.sections, employees: { status: 'unavailable', message: 'Die Verbindung ist unterbrochen. Bitte versuchen Sie es erneut.' } } };
if (variant === 'section-loading') ready = { ...ready, sections: { ...ready.sections, employees: { status: 'loading' } } };
if (variant === 'correction-confirm') ready = { ...ready, correctionIntent: { commandId: 'test', timeRecord: entry, startedAt: entry.startedAt, stoppedAt: entry.stoppedAt, reason: 'Vergessenen Beginn berichtigt' } };
if (['review-confirm','manager-review-confirm'].includes(variant)) ready = { ...ready, adjudicationIntent: { commandId: 'test', reviewItem, resolution: 'no_time_record_change', timeRecord: null, startedAt: null, stoppedAt: null, reason: 'Doppelten Vorgang geprüft' } };
if (variant === 'tag-confirm') ready = { ...ready, reassignmentIntent: { commandId: 'test', nfcTagId: tag.id, expectedActiveAssignmentId: tag.activeAssignmentId, targetCustomerId: customer.id } };
if (variant === 'manual-pending') ready = { ...ready, manual: { busy: false, pending: true, message: 'Wird gesichert …' } };
if (variant === 'notice-saved') ready = { ...ready, notice: { kind: 'success', text: 'Gespeichert.' } };
if (variant === 'notice-location') ready = { ...ready, notice: { kind: 'success', text: 'Hauptarbeitsstandort wurde zugewiesen.' } };
if (variant === 'notice-info') ready = { ...ready, notice: { kind: 'info', text: 'Änderung wurde verworfen.' } };
const authStates: Record<string, AdminWebState> = {
  login: { status: 'signed_out' }, 'login-error': { status: 'signed_out', notice: { kind: 'error', text: 'E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie Ihre Eingaben.' } },
  'forgot-password': { status: 'signed_out', notice: { kind: 'success', text: 'Wenn ein Zugang zu dieser E-Mail-Adresse besteht, wurde eine Nachricht zum Zurücksetzen verschickt.' } },
  'signing-in': { status: 'signing_in' }, recovery: { status: 'password_recovery', completing: false, notice: null },
  'recovery-employee': { status: 'password_recovery', completing:false,notice:null },
  'recovery-standortleitung': { status:'password_recovery',completing:false,notice:null },
  'recovery-administrator': { status:'password_recovery',completing:false,notice:null },
  'recovery-busy': { status: 'password_recovery', completing: true, notice: null }, paused: { status: 'organization_paused' },
  'recovery-success': { status: 'signed_out', passwordResetCompleted: true },
  forbidden: { status: 'forbidden', message: 'Für diesen Zugang ist die Verwaltung nicht verfügbar.' },
  unavailable: { status: 'unavailable', message: 'Die Verwaltung ist vorübergehend nicht erreichbar.' }, loading: { status: 'loading' },
};
const stateful = new FakeCapability(authStates[variant] ?? ready);
const capability: AdminWebCapability = Object.assign(stateful, { loadBackfillTargets: async () => ({ status: 'ready' as const, targets: [{targetType:'customer' as const,targetId:customer.id,displayName:'Werkstatt am Beispielweg'}] }), saveTimeEdit: async () => ({ status: 'unavailable' as const }) });
if(variant.endsWith('-void')) {
  const history:import('@taptime/mobile-work-contract').VoidedTimeRecord[]=[];
  Object.assign(capability,{loadVoidedTime:async()=>({status:'ready',records:[...history]}),
  saveTimeEdit:async(input:import('../src/timeEditing').TimeEditInput)=>{
    if(input.kind!=='void')return {status:'unavailable'};
    history.push({timeRecordId:entry.timeRecordId,targetDisplayName:entry.targetDisplayName,
      startedAt:entry.startedAt,stoppedAt:entry.stoppedAt!,voidedAt:'2026-09-23T12:00:00.000Z',actorDisplayName:'Martin Beispiel',reasonCode:input.reasonCode,reasonText:input.reasonText});
    ready={...ready,calendar:{...ready.calendar!,status:'ready',value:{...ready.calendar!.value!,records:[]}},notice:{kind:'success',text:'Zeiteintrag gelöscht.'}};
    stateful.emit(ready);
    return {status:'committed',timeRecordId:entry.timeRecordId,idempotentRetry:false};
  }} satisfies Pick<AdminWebCapability,'loadVoidedTime'|'saveTimeEdit'>);
}
capability.cancelCorrection = () => stateful.emit({ ...ready, correctionIntent: null });
capability.cancelAdjudication = () => stateful.emit({ ...ready, adjudicationIntent: null });
capability.cancelReassignment = () => stateful.emit({ ...ready, reassignmentIntent: null });
const root = createRoot(document.getElementById('root')!);
root.render(variant === 'configuration' ? createApplicationPage(null) : variant.startsWith('welcome')
  ? <WelcomePage invitation={variant === 'welcome-unavailable' ? null : { hasInvitation: variant !== 'welcome-invalid', setPassword: async () => variant === 'welcome-error' ? 'weak_password' : variant === 'welcome-busy' ? new Promise(() => {}) : 'succeeded' }} />
  : variant.startsWith('password-reset') ? <PasswordResetPage recovery={{hasRecovery: true, setPassword: async () => 'succeeded'}} />
  : <App administration={capability} accountInvitations={{ invite: async () => variant === 'invitation-busy' ? new Promise(() => {}) : ({ status: 'failed', code: 'invitation_needs_attention' }) }} />);
