import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type DependencyList } from 'react';
import { SearchPager, normalizeSearch, type PageResult } from './search';

export function useSearchPages<P extends {readonly nextCursor:string|null},T>(read:(search:string|null,cursor:string|null)=>Promise<PageResult<P>>,
  items:(page:P)=>readonly T[],identity:(item:T)=>string,dependencies:DependencyList,enabled=true) {
  const latest=useRef({read,items,identity});latest.current={read,items,identity};
  const pager=useMemo(()=>new SearchPager<P,T>((s,c)=>latest.current.read(s,c),p=>latest.current.items(p),i=>latest.current.identity(i)),dependencies);
  const state=useSyncExternalStore(pager.subscribe,pager.getState,pager.getState);
  const [input,setInput]=useState('');
  useEffect(()=>setInput(''),[pager]);
  useEffect(()=>{if(enabled&&(pager.getState().status!=='ready'||pager.getState().busy))void pager.refresh();return()=>pager.dispose();},[pager,enabled]);
  return {state,pager,input,setSearch:(value:string)=>{setInput(value);pager.search(value);}};
}

export function useDebouncedSearch(input:string) {
  const [search,setSearch]=useState(()=>normalizeSearch(input));
  useEffect(()=>{const timer=setTimeout(()=>setSearch(normalizeSearch(input)),300);return()=>clearTimeout(timer);},[input]);
  return search;
}
