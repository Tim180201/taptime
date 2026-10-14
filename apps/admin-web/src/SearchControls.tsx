import type { SearchState } from '../../mobile/src/search/search';
export function SearchField({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  return <label>Suchen<input type="search" aria-label="Suchen" placeholder="Name eingeben" maxLength={80} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}/></label>;
}
export function SearchStatus({state,onClear,onRetry}:{state:SearchState<unknown,unknown>;onClear?:()=>void;onRetry:()=>void}) {
  return <>
    {state.failed?<div role="alert"><p>Die Daten konnten nicht geladen werden.</p><button type="button" onClick={onRetry}>Erneut versuchen</button></div>:null}
    {state.status==='loading'?<p role="status">Wird geladen …</p>:state.status==='ready'?<>
      <p role="status" aria-live="polite">{state.nextCursor!==null?'mehr als ':''}{state.items.length} Treffer</p>
      {state.items.length===0&&state.search?<div><p>{`Keine Treffer für „${state.search}“`}</p><button type="button" onClick={onClear}>Suche löschen</button></div>:null}
    </>:null}
  </>;
}
