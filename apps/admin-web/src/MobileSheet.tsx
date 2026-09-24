import { useEffect, useRef, useState, type ReactNode } from 'react';

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
export function MobileSheet({ label, children, onCancel, busy = false, role = 'dialog', className = '' }: {
  label: string;
  children: ReactNode;
  onCancel: () => void;
  busy?: boolean;
  role?: 'dialog' | 'alertdialog';
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`mobile-sheet ${className}`} role={role}
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
