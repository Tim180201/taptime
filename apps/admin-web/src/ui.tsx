import { Children,cloneElement,isValidElement,useEffect, useState, type ReactNode, type RefObject } from 'react';
import type { SectionStatus } from './contracts';
import { MobileSheet, useCompactLayout } from './MobileSheet';

export function Panel({
  title,
  description,
  children,
  className = '',
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <section className={`panel ${className}`.trim()} aria-labelledby={`panel-${slug(title)}`}>
    <div className="panel-heading">
      <div>
        <h2 id={`panel-${slug(title)}`}>{title}</h2>
        {description === undefined ? null : <p className="muted">{description}</p>}
      </div>
    </div>
    {children}
  </section>;
}

export function SectionBoundary({
  state,
  onRetry,
  retryButtonRef,
  children,
}: {
  readonly state: SectionStatus;
  readonly onRetry: () => void;
  readonly retryButtonRef?: RefObject<HTMLButtonElement | null>;
  readonly children: ReactNode;
}) {
  if (state.status === 'loading') {
    return <div aria-busy="true">
      <div className="loading-preserved" aria-hidden="true">{children}</div>
      <DelayedSkeleton label="Daten werden geladen" />
    </div>;
  }
  if (state.status === 'unavailable') {
    return <div className="section-state section-error" role="alert" aria-live="assertive">
      <strong>Der Bereich konnte nicht geladen werden</strong>
      <p>{state.message}</p>
      <button ref={retryButtonRef} className="secondary" onClick={onRetry}>
        Bereich erneut laden
      </button>
    </div>;
  }
  return <>{children}</>;
}

export function DelayedSkeleton({
  label,
  rows = 4,
}: {
  readonly label: string;
  readonly rows?: number;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 1_000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div className="skeleton" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }, (_, index) => <span key={index} aria-hidden="true" />)}
  </div>;
}

export function CountTruth({
  count,
  noun,
  complete,
}: {
  readonly count: number;
  readonly noun: string;
  readonly complete: boolean;
}) {
  return <p className="count-truth">
    <strong>{count}</strong> {complete ? `${noun} vollständig geladen` : `${noun} bisher geladen`}
  </p>;
}

export function Confirmation({
  label,
  title,
  children,
  confirmLabel,
  busyLabel,
  busy,
  confirmDisabled = false,
  warning = false,
  trigger,
  onConfirm,
  onCancel,
}: {
  readonly label: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly busyLabel: string;
  readonly busy: boolean;
  readonly confirmDisabled?: boolean;
  readonly warning?: boolean;
  readonly trigger?: HTMLElement | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const compact = useCompactLayout();
  const content = <>
    <strong>{title}</strong>
    {children}
    <div className="confirmation-actions" data-confirm-actions>
      {warning?<button type="button" className="primary-action" data-cancel disabled={busy} onClick={onCancel}>Abbrechen</button>:null}
      <button type="button" className={warning?'warning-action':undefined} autoFocus={!warning} disabled={busy || confirmDisabled} aria-busy={busy} onClick={onConfirm}>
        {busy ? busyLabel : confirmLabel}
      </button>
      {!warning?<button className="secondary" disabled={busy} onClick={onCancel}>Abbrechen</button>:null}
    </div>
  </>;
  return compact || warning ? <MobileSheet safeConfirmation={warning} trigger={trigger} label={label} role="alertdialog" className="confirmation"
    busy={busy} onCancel={onCancel}>{content}</MobileSheet>
    : <aside className="confirmation" role="alertdialog" aria-label={label} aria-modal="false">{content}</aside>;
}

function slug(value: string): string {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}

export function DataTable({label,headers,children}:{label:string;headers:readonly (string|{label:string;numeric:boolean})[];children:ReactNode}) {
  return <div className="table-scroll" role="region" tabIndex={0} aria-label={label}><table aria-label={label}>
    <thead><tr>{headers.map((h,i)=><th key={i} scope="col" className={typeof h!=='string'&&h.numeric?'numeric':undefined}>{typeof h==='string'?h:h.label}</th>)}</tr></thead>
    <tbody>{Children.map(children,row=>isValidElement<{children?:ReactNode}>(row)?cloneElement(row,{},Children.map(row.props.children,(cell,index)=>{
      const header=headers[index];return isValidElement<{'data-label'?:string}>(cell)&&header?cloneElement(cell,{'data-label':typeof header==='string'?header:header.label}):cell;
    })):row)}</tbody></table></div>;
}
export function Person({name}:{name:string}) {
  return <span className="person"><span className="avatar" aria-hidden="true">{name.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join('')}</span><span>{name}</span></span>;
}
export function Pill({kind,children}:{kind?:'running'|'notice'|'error';children:ReactNode}) {
  return <span className={`pill${kind?' pill-'+kind:''}`}>{kind?<span className="status-dot" aria-hidden="true"/>:null}{children}</span>;
}
export function EmptyState({children,action}:{children:ReactNode;action?:ReactNode}) {
  return <div className="empty"><p>{children}</p>{action}</div>;
}
export function Metric({label,value,action,notice=false}:{label:string;value:ReactNode;action?:ReactNode;notice?:boolean}) {
  return <article className="metric-card"><span>{label}</span><strong className={notice?'notice-number':undefined}>{value}</strong>{action}</article>;
}
