import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.matchMedia?.('(max-width: 1023px)').matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 1023px)');
    if (!query) return;
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return compact;
}

/** Native modal semantics provide focus containment and an inert background. */
export function MobileSheet({ label, children, onCancel, busy = false, role = 'dialog', className = '', safeConfirmation = false, trigger }: {
  trigger?: HTMLElement | null;
  safeConfirmation?: boolean;
  label: string;
  children: ReactNode;
  onCancel: () => void;
  busy?: boolean;
  role?: 'dialog' | 'alertdialog';
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const previous = trigger ?? document.activeElement as HTMLElement | null;
    if (safeConfirmation) {
      const box=previous?.getBoundingClientRect();
      dialog.dataset.actionsAt=box&&box.height>0&&box.top+box.height/2>window.innerHeight/2?'start':'end';
    }
    dialog.showModal();
    if (safeConfirmation) dialog.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
    return () => {
      dialog.close();
      queueMicrotask(() => { if (previous?.isConnected) previous.focus({ preventScroll: true }); });
    };
  }, []);
  return <dialog ref={ref} className={`mobile-sheet ${safeConfirmation?'safe-confirmation':''} ${className}`} role={role}
    aria-label={label} aria-modal="true" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
      ) ?? []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }} onCancel={event => {
      event.preventDefault();
      if (!busy) onCancel();
    }}>{children}</dialog>;
}

export function ResponsiveSheet(props: Parameters<typeof MobileSheet>[0]) {
  return useCompactLayout() ? <MobileSheet {...props} /> : <>{props.children}</>;
}
