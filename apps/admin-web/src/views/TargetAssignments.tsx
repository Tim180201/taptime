import {useEffect,useRef,useState} from 'react';
import type {TargetAssignmentChangeResult,TargetAssignmentItem,TargetAssignmentQueryResponse} from '@taptime/mobile-work-contract';
import {useSearchPages} from '../../../mobile/src/search/useSearchPages';
import type {PageResult} from '../../../mobile/src/search/search';
import type {AdminWebCapability} from '../contracts';
import {assignmentMessage,type AssignmentPair,type AssignmentSelector} from '../targetAssignments';
import {SearchField,SearchStatus} from '../SearchControls';
import {ResponsiveSheet} from '../MobileSheet';

type Choice={key:string;displayName:string;assigned:boolean;pair:AssignmentPair};
type Outcome={choice:Choice;status:TargetAssignmentChangeResult['status']};
type TargetSnapshot={members:Set<string>;firstPage:TargetAssignmentQueryResponse};
export default function TargetAssignments(props:{administration:AdminWebCapability;selector:AssignmentSelector;personName?:string;targetName?:string}) {
  const state=props.administration.getState();
  const authority=state.status==='ready'?JSON.stringify([state.membershipId,state.role,state.managementScope,state.selectedLocation]):'';
  return <AssignmentSection key={`${authority}/${JSON.stringify(props.selector)}`} {...props}/>;
}
function AssignmentSection({administration,selector,personName}:{administration:AdminWebCapability;selector:AssignmentSelector;personName?:string;targetName?:string}) {
  const byPerson='membershipId' in selector;
  const title=byPerson?'Kunden und Projekte':'Mitarbeiter',action=`${title} zuordnen`;
  const [forbidden,setForbidden]=useState(false),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[outcomes,setOutcomes]=useState<Outcome[]>([]);
  const [selected,setSelected]=useState<Map<string,Choice>>(new Map());
  const alive=useRef(true),working=useRef(false);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const refreshedFirstPage=useRef<TargetAssignmentQueryResponse|null>(null);
  const list=useSearchPages<TargetAssignmentQueryResponse,TargetAssignmentItem>(async(search,cursor)=>{
    const firstPage=refreshedFirstPage.current;refreshedFirstPage.current=null;
    const result=firstPage&&search===null&&cursor===null?{status:'ready' as const,value:firstPage}
      :await administration.readTargetAssignments?.({...selector,search,cursor})??{status:'unavailable'};
    if(alive.current&&(result.status==='forbidden'||result.status==='authority_rejected'))setForbidden(true);
    return result;
  },p=>p.items,i=>i.assignmentId,[administration],!!administration.readTargetAssignments);
  // One unsearched target snapshot is shared by every membership search page.
  const assignedPeople=useRef<Promise<TargetSnapshot>|null>(null);
  const readAssignedPeople=():Promise<TargetSnapshot>=>{
    if(assignedPeople.current)return assignedPeople.current;
    const snapshot=(async()=>{
      const members=new Set<string>(),cursors=new Set<string>();let cursor:string|null=null;
      let firstPage:TargetAssignmentQueryResponse|undefined;
      do {
        const result:PageResult<TargetAssignmentQueryResponse>|undefined=await administration.readTargetAssignments?.({...selector,search:null,cursor});
        if(!alive.current||result?.status!=='ready'||!result.value)throw new Error('Assignment state unavailable');
        firstPage??=result.value;
        for(const item of result.value.items){
          if(!('membershipId' in item))throw new Error('Unexpected assignment selector');
          members.add(item.membershipId);
        }
        cursor=result.value.nextCursor;
        if(cursor&&cursors.has(cursor))throw new Error('Repeated assignment cursor');
        if(cursor)cursors.add(cursor);
      }while(cursor!==null);
      return {members,firstPage:firstPage!};
    })();
    assignedPeople.current=snapshot;
    void snapshot.catch(()=>{if(assignedPeople.current===snapshot)assignedPeople.current=null;});
    return snapshot;
  };
  const choices=useSearchPages<{items:Choice[];nextCursor:string|null;firstPage?:TargetAssignmentQueryResponse},Choice>(async(search,cursor)=>{
    if(byPerson) {
      const result=await administration.querySearch?.('backfill_targets',{targetMembershipId:selector.membershipId,search,cursor});
      if(result?.status!=='ready'||!result.value)return {status:'unavailable'};
      return {status:'ready',value:{nextCursor:result.value.nextCursor,items:result.value.targets.flatMap(t=>t.targetType==='general_work'?[]:[{
        key:`${t.targetType}:${t.targetId}`,displayName:t.displayName,assigned:'assignedToPerson' in t&&t.assignedToPerson,
        pair:{membershipId:selector.membershipId,targetType:t.targetType,targetId:t.targetId,assigned:true}}])}};
    }
    const state=administration.getState();if(state.status!=='ready')return {status:'authority_rejected'};
    const [result,snapshot]=await Promise.all([
      administration.querySearch?.('memberships',{search,cursor,locationId:state.selectedLocation?.id??null}),
      readAssignedPeople(),
    ]);
    if(result?.status!=='ready'||!result.value)return {status:'unavailable'};
    const people=result.value.employeeMemberships.filter(p=>p.active&&(state.role==='administrator'||p.role==='employee'&&p.id!==state.membershipId));
    return {status:'ready',value:{firstPage:snapshot.firstPage,items:people.map(p=>({key:p.id,displayName:p.displayName,assigned:snapshot.members.has(p.id),
      pair:{...selector,membershipId:p.id,assigned:true}})),nextCursor:result.value.nextCursor}};
  },p=>p.items,i=>i.key,[administration,open],open);
  const run=async(entries:Choice[])=>{
    if(working.current)return;working.current=true;setBusy(true);
    try {
      for(const choice of entries) {
        if(!alive.current)break;
        let result:TargetAssignmentChangeResult;
        try {result=await administration.changeTargetAssignment?.(choice.pair)??{status:'unavailable'};}catch{result={status:'unavailable'};}
        if(!alive.current)break;
        setOutcomes(old=>[...old.filter(o=>o.choice.key!==choice.key),{choice,status:result.status}]);
        if(result.status==='succeeded')setSelected(old=>{const next=new Map(old);next.delete(choice.key);return next;});
      }
      if(alive.current){
        assignedPeople.current=null;
        if(open&&!byPerson){
          await choices.pager.refresh();
          // Share the refreshed first target page with the unsearched visible list.
          // A searched list still needs its own filtered response.
          refreshedFirstPage.current=choices.pager.getState().value?.firstPage??null;
        }
        if(alive.current)await list.pager.refresh();
        if(alive.current&&open&&byPerson)await choices.pager.refresh();
      }
    }finally{refreshedFirstPage.current=null;working.current=false;if(alive.current)setBusy(false);}
  };
  const remove=(item:TargetAssignmentItem):Choice=>({key:item.assignmentId,displayName:item.displayName,assigned:true,pair:byPerson&&'targetId' in item
    ?{membershipId:selector.membershipId,targetType:item.targetType,targetId:item.targetId,assigned:false}
    :{...selector as {targetType:'customer'|'project';targetId:string},membershipId:(item as {membershipId:string}).membershipId,assigned:false}});
  const results=<div role="status" aria-live="polite">{outcomes.map(o=><div key={o.choice.key}>
    {o.status==='forbidden'||o.status==='unauthorized'||o.status==='target_not_selectable'&&byPerson?<p>{o.choice.displayName}</p>:null}
    <p>{assignmentMessage(o.status,o.status==='target_not_selectable'&&byPerson?personName??'Dieser Mitarbeiter':o.choice.displayName,o.choice.pair.assigned,o.choice.pair.targetType)}</p>
    {o.status==='unavailable'?<button type="button" disabled={busy} onClick={()=>void run([o.choice])}>Erneut versuchen · {o.choice.displayName}</button>:null}</div>)}</div>;
  if(forbidden||!administration.readTargetAssignments)return null;
  return <section className="target-assignments" aria-label={title}>
    <h3>{title}</h3><SearchField value={list.input} onChange={list.setSearch} disabled={busy}/>
    <SearchStatus state={list.state} onRetry={list.pager.retry} onClear={()=>list.setSearch('')}/>
    <ul className="assignment-list">{list.state.items.map(i=><li key={i.assignmentId}><span>{i.displayName}</span><button type="button" disabled={busy} aria-label={`Entfernen · ${i.displayName}`} onClick={()=>void run([remove(i)])}>Entfernen</button></li>)}</ul>
    {list.state.nextCursor?<button type="button" disabled={busy||list.state.busy} onClick={()=>void list.pager.loadMore()}>Weitere laden</button>:null}
    <button type="button" disabled={busy||list.state.status!=='ready'} onClick={()=>{assignedPeople.current=null;setOpen(true);setSelected(new Map());setOutcomes([]);}}>{action}</button>
    {!open?results:null}
    {open?<ResponsiveSheet label={action} busy={busy} onCancel={()=>setOpen(false)}><div className="assignment-picker">
      <h3>{action}</h3><SearchField value={choices.input} onChange={choices.setSearch} disabled={busy}/>
      <SearchStatus state={choices.state} onRetry={choices.pager.retry} onClear={()=>choices.setSearch('')}/>
      <fieldset disabled={busy}><legend>{title} auswählen</legend>
        {choices.state.items.map(choice=><label className="assignment-choice" key={choice.key}><input type="checkbox"
          checked={choice.assigned||selected.has(choice.key)} disabled={choice.assigned||choices.state.busy||choices.state.failed}
          onChange={e=>{const checked=e.target.checked;setSelected(old=>{const next=new Map(old);if(checked)next.set(choice.key,choice);else next.delete(choice.key);return next;});}}/>
          <span>{choice.displayName}{choice.assigned?' · zugeordnet':''}</span></label>)}
      </fieldset>
      {choices.state.nextCursor?<button type="button" disabled={busy||choices.state.busy} onClick={()=>void choices.pager.loadMore()}>Weitere laden</button>:null}
      <p>{selected.size} ausgewählt</p>
      <button type="button" disabled={busy||selected.size===0||choices.state.busy||choices.state.failed} onClick={()=>void run([...selected.values()])}>Auswahl zuordnen</button>
      {results}<button type="button" disabled={busy} onClick={()=>setOpen(false)}>Auswahl schließen</button>
    </div></ResponsiveSheet>:null}
  </section>;
}
