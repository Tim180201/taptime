import {createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
export const HeaderOutlet = createContext<HTMLElement|null>(null);
export function PageHeader({organization,title,subtitle,actions,onRefresh,refreshDisabled=false}:{organization?:string;title:string;subtitle?:ReactNode;actions?:ReactNode;onRefresh:()=>void;refreshDisabled?:boolean}) {
  const host=useContext(HeaderOutlet),heading=useRef<HTMLHeadingElement>(null);
  useLayoutEffect(()=>{
    // A lazy page can finish while a sheet opens. Preserve its opener and modal focus.
    if(!document.querySelector('dialog[aria-modal="true"]'))heading.current?.focus({preventScroll:true});
  },[title,host]);
  useEffect(()=>{
    const keyboard=()=>document.documentElement.setAttribute('data-keyboard','true');
    const pointer=()=>document.documentElement.removeAttribute('data-keyboard');
    document.addEventListener('keydown',keyboard);document.addEventListener('pointerdown',pointer);
    return()=>{document.removeEventListener('keydown',keyboard);document.removeEventListener('pointerdown',pointer);};
  },[]);
  const content=<><div className="workspace-title"><p className="eyebrow organization-eyebrow">{organization}</p><h1 ref={heading} tabIndex={-1}>{title}</h1>{subtitle?<div className="page-subtitle">{subtitle}</div>:null}</div>
    <div className="header-actions">{actions}<button type="button" className="icon-button" disabled={refreshDisabled} title="Alle Bereiche aktualisieren" aria-label="Alle Bereiche aktualisieren" onClick={onRefresh}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M19 11a7 7 0 0 0-12-5M5 13a7 7 0 0 0 12 5"/></svg></button></div></>;
  return host?createPortal(content,host):<header className="workspace-header">{content}</header>;
}
