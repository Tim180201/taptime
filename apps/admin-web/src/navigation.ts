export const adminViews = [
  { slug: 'uebersicht', label: 'Übersicht' },
  { slug: 'einrichtung', label: 'Einrichtung' },
  { slug: 'beschaeftigte', label: 'Beschäftigte' },
  { slug: 'arbeitszeiten', label: 'Arbeitszeiten' },
  { slug: 'pruefungen', label: 'Prüfungen' },
] as const;

export type AdminView = (typeof adminViews)[number]['slug'];
export type TimeRecordStatusFilter = 'alle' | 'laufend' | 'abgeschlossen';
export type CaptureTypeFilter = 'alle' | 'gescannt' | 'manuell-erfasst';

const allowedViews = new Set<string>(adminViews.map((view) => view.slug));
const allowedStatuses = new Set<string>(['alle', 'laufend', 'abgeschlossen']);
const allowedCaptureTypes = new Set<string>(['alle', 'gescannt', 'manuell-erfasst']);

export interface AdminRoute {
  readonly view: AdminView;
  readonly month: string | null;
  readonly status: TimeRecordStatusFilter;
  readonly captureType: CaptureTypeFilter;
}

export function routeFromLocation(pathname: string, search: string): AdminRoute {
  const candidate = pathname.replace(/^\/+|\/+$/g, '');
  const view = allowedViews.has(candidate) ? candidate as AdminView : 'uebersicht';
  if (view !== 'arbeitszeiten') return defaultRoute(view);
  const parameters = new URLSearchParams(search);
  const month = validMonth(parameters.get('monat'));
  const statusCandidate = parameters.get('status') ?? 'alle';
  const captureCandidate = parameters.get('erfassungsart') ?? 'alle';
  return Object.freeze({
    view,
    month,
    status: allowedStatuses.has(statusCandidate)
      ? statusCandidate as TimeRecordStatusFilter
      : 'alle',
    captureType: allowedCaptureTypes.has(captureCandidate)
      ? captureCandidate as CaptureTypeFilter
      : 'alle',
  });
}

export function canonicalRoutePath(route: AdminRoute): string {
  const pathname = canonicalViewPath(route.view);
  if (route.view !== 'arbeitszeiten') return pathname;
  const parameters = new URLSearchParams();
  if (route.month !== null) parameters.set('monat', route.month);
  if (route.status !== 'alle') parameters.set('status', route.status);
  if (route.captureType !== 'alle') parameters.set('erfassungsart', route.captureType);
  const search = parameters.toString();
  return search.length === 0 ? pathname : `${pathname}?${search}`;
}

export function canonicalViewPath(view: AdminView): `/${AdminView}` {
  return `/${view}`;
}

export function defaultRoute(view: AdminView): AdminRoute {
  return Object.freeze({ view, month: null, status: 'alle', captureType: 'alle' });
}

export function monthTimeWindow(month: string): {
  readonly fromInclusive: string;
  readonly toExclusive: string;
} | null {
  if (validMonth(month) === null) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  return Object.freeze({
    fromInclusive: new Date(Date.UTC(year!, monthNumber! - 1, 1)).toISOString(),
    toExclusive: new Date(Date.UTC(year!, monthNumber!, 1)).toISOString(),
  });
}

export function monthLabel(month: string): string {
  const window = monthTimeWindow(month);
  return window === null
    ? month
    : new Intl.DateTimeFormat('de-DE', {
        month: 'long', year: 'numeric', timeZone: 'UTC',
      }).format(new Date(window.fromInclusive));
}

function validMonth(value: string | null): string | null {
  if (value === null || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2200 ? value : null;
}
