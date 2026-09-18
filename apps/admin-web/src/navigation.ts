import { BUSINESS_TIME_ZONE } from '@taptime/core';
import { parseZonedLocalTimestamp } from './timeZone';
import type { AdministrationSection } from './contracts';

export const adminViews = [
  { slug: 'uebersicht', label: 'Übersicht' },
  { slug: 'beschaeftigte', label: 'Beschäftigte' },
  { slug: 'pruefungen', label: 'Prüfungen' },
  { slug: 'meine-zeiten', label: 'Meine Zeiten' },
  { slug: 'manuell', label: 'Manuell' },
  { slug: 'einrichtung', label: 'Einrichtung' },
  { slug: 'lohnexport', label: 'Lohnexport' },
] as const;

export type AdminView = (typeof adminViews)[number]['slug'];
export type TimeRecordStatusFilter = 'alle' | 'laufend' | 'abgeschlossen';
export type CaptureTypeFilter = 'alle' | 'gescannt' | 'manuell-erfasst';

const allowedViews = new Set<string>(adminViews.map((view) => view.slug));
const allowedStatuses = new Set<string>(['alle', 'laufend', 'abgeschlossen']);
const allowedCaptureTypes = new Set<string>(['alle', 'gescannt', 'manuell-erfasst']);

export interface AdminRoute {
  readonly view: AdminView;
  readonly personId?: string;
  readonly locationId: string | null;
  readonly month: string | null;
  readonly status: TimeRecordStatusFilter;
  readonly captureType: CaptureTypeFilter;
}

export function routeFromLocation(pathname: string, search: string): AdminRoute {
  const raw = pathname.replace(/^\/+|\/+$/g, '');
  const personId = raw.startsWith('beschaeftigte/') ? validLocationId(raw.slice('beschaeftigte/'.length)) : null;
  const candidate = personId !== null ? 'beschaeftigte' : raw === 'arbeitszeiten' ? 'lohnexport' : raw;
  const view = allowedViews.has(candidate) ? candidate as AdminView : 'uebersicht';
  const parameters = new URLSearchParams(search);
  const locationId = validLocationId(parameters.get('standort'));
  if (view !== 'lohnexport') return { ...defaultRoute(view, locationId), month: validMonth(parameters.get('monat')), ...(personId === null ? {} : {personId}) };
  const month = validMonth(parameters.get('monat'));
  const statusCandidate = parameters.get('status') ?? 'alle';
  const captureCandidate = parameters.get('erfassungsart') ?? 'alle';
  return Object.freeze({
    view,
    locationId,
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
  const pathname = route.view === 'beschaeftigte' && route.personId
    ? `${canonicalViewPath(route.view)}/${route.personId}` : canonicalViewPath(route.view);
  const parameters = new URLSearchParams();
  if (route.locationId !== null) parameters.set('standort', route.locationId);
  if (route.month !== null) parameters.set('monat', route.month);
  if (route.view !== 'lohnexport') {
    const search = parameters.toString();
    return search.length === 0 ? pathname : `${pathname}?${search}`;
  }
  if (route.month !== null) parameters.set('monat', route.month);
  if (route.status !== 'alle') parameters.set('status', route.status);
  if (route.captureType !== 'alle') parameters.set('erfassungsart', route.captureType);
  const search = parameters.toString();
  return search.length === 0 ? pathname : `${pathname}?${search}`;
}

export function canonicalViewPath(view: AdminView): `/${AdminView}` {
  return `/${view}`;
}

export function defaultRoute(view: AdminView, locationId: string | null = null): AdminRoute {
  return Object.freeze({ view, locationId, month: null, status: 'alle', captureType: 'alle' });
}

export function visibleAdminViews(
  availableSections: readonly AdministrationSection[],
): readonly (typeof adminViews)[number][] {
  return adminViews.filter((view) => {
    switch (view.slug) {
      case 'uebersicht': return availableSections.includes('employees');
      case 'beschaeftigte': return availableSections.includes('employees');
      case 'pruefungen': return availableSections.includes('review_items');
      case 'einrichtung': return availableSections.includes('setup');
      case 'lohnexport': return availableSections.includes('time_export');
      case 'meine-zeiten': return availableSections.includes('own_time');
      case 'manuell': return availableSections.includes('manual_capture');
    }
  });
}

export function monthTimeWindow(month: string): {
  readonly fromInclusive: string;
  readonly toExclusive: string;
} | null {
  if (validMonth(month) === null) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = monthNumber === 12
    ? `${year! + 1}-01`
    : `${year}-${String(monthNumber! + 1).padStart(2, '0')}`;
  const fromInclusive = parseZonedLocalTimestamp(`${month}-01T00:00`);
  const toExclusive = parseZonedLocalTimestamp(`${nextMonth}-01T00:00`);
  if (fromInclusive === null || toExclusive === null) return null;
  return Object.freeze({ fromInclusive, toExclusive });
}

export function monthLabel(month: string): string {
  const window = monthTimeWindow(month);
  return window === null
    ? month
    : new Intl.DateTimeFormat('de-DE', {
        month: 'long', year: 'numeric', timeZone: BUSINESS_TIME_ZONE,
      }).format(new Date(window.fromInclusive));
}

function validMonth(value: string | null): string | null {
  if (value === null || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2200 ? value : null;
}

function validLocationId(value: string | null): string | null {
  return value !== null
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
    ? value : null;
}
