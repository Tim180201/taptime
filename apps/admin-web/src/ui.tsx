import type { ReactNode, RefObject } from 'react';
import type { SectionStatus } from './contracts';

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
    return <div className="section-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> Daten werden sicher geladen …
    </div>;
  }
  if (state.status === 'unavailable') {
    return <div className="section-state section-error" role="alert">
      <strong>Bereich derzeit nicht verfügbar</strong>
      <p>{state.message}</p>
      <button ref={retryButtonRef} className="secondary" onClick={onRetry}>
        Erneut versuchen
      </button>
    </div>;
  }
  return <>{children}</>;
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
  onConfirm,
  onCancel,
}: {
  readonly label: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly busyLabel: string;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  return <aside className="confirmation" role="alertdialog" aria-label={label} aria-modal="false">
    <strong>{title}</strong>
    {children}
    <div className="confirmation-actions">
      <button autoFocus disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button>
      <button className="secondary" disabled={busy} onClick={onCancel}>Abbrechen</button>
    </div>
  </aside>;
}

function slug(value: string): string {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}
