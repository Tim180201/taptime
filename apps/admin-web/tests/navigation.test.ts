import { describe, expect, it } from 'vitest';
import {
  adminViews,
  canonicalRoutePath,
  defaultRoute,
  monthTimeWindow,
  monthLabel,
  routeFromLocation,
} from '../src/navigation';

describe('Admin Web address navigation', () => {
  it('allows exactly the five accepted slugs', () => {
    expect(adminViews.map((view) => view.slug)).toEqual([
      'uebersicht',
      'einrichtung',
      'beschaeftigte',
      'arbeitszeiten',
      'pruefungen',
    ]);
    for (const view of adminViews) {
      expect(routeFromLocation(canonicalRoutePath(defaultRoute(view.slug)), '').view)
        .toBe(view.slug);
    }
  });

  it('maps IDs, form values and nested paths to Übersicht', () => {
    for (const unsafe of [
      '/record=123',
      '/pruefungen/customer-id',
      '/email@example.test',
      '/invitation_secret',
      '',
    ]) expect(routeFromLocation(unsafe, '').view).toBe('uebersicht');
  });

  it('keeps safe time filters in the address and derives an exact month window', () => {
    const route = routeFromLocation(
      '/arbeitszeiten',
      '?monat=2026-08&status=abgeschlossen&erfassungsart=gescannt',
    );
    expect(canonicalRoutePath(route)).toBe(
      '/arbeitszeiten?monat=2026-08&status=abgeschlossen&erfassungsart=gescannt',
    );
    expect(monthTimeWindow('2026-08')).toEqual({
      fromInclusive: '2026-07-31T22:00:00.000Z',
      toExclusive: '2026-08-31T22:00:00.000Z',
    });
  });

  // D-056: a payroll month starts at Berlin midnight, including both DST changes.
  it.each([
    ['2026-03', '2026-02-28T23:00:00.000Z', '2026-03-31T22:00:00.000Z', 31 * 24 - 1],
    ['2026-10', '2026-09-30T22:00:00.000Z', '2026-10-31T23:00:00.000Z', 31 * 24 + 1],
  ] as const)('uses Berlin midnight for %s and the actual elapsed hours', (month, from, to, hours) => {
    const window = monthTimeWindow(month)!;
    expect(window).toEqual({ fromInclusive: from, toExclusive: to });
    expect(Date.parse(window.toExclusive) - Date.parse(window.fromInclusive))
      .toBe(hours * 60 * 60 * 1_000);
  });

  it('assigns 00:30 Berlin on September 1 to September, never August', () => {
    const event = '2026-08-31T22:30:00.000Z';
    const months = ['2026-08', '2026-09'].filter((month) => {
      const window = monthTimeWindow(month)!;
      return event >= window.fromInclusive && event < window.toExclusive;
    });
    expect(months).toEqual(['2026-09']);
  });

  it('keeps month labels and the year rollover in Berlin', () => {
    expect(monthLabel('2026-08')).toBe('August 2026');
    expect(monthTimeWindow('2026-12')).toEqual({
      fromInclusive: '2026-11-30T23:00:00.000Z',
      toExclusive: '2026-12-31T23:00:00.000Z',
    });
    for (const value of ['2026-13', '1999-12', '2201-01', 'invalid']) {
      expect(monthTimeWindow(value)).toBeNull();
    }
  });

  it('keeps only a canonical Location identifier in every real address', () => {
    const locationId = '31000000-0000-4000-8000-000000000001';
    const route = routeFromLocation('/beschaeftigte', `?standort=${locationId}`);
    expect(route.locationId).toBe(locationId);
    expect(canonicalRoutePath(route)).toBe(`/beschaeftigte?standort=${locationId}`);
    expect(routeFromLocation('/beschaeftigte', '?standort=Berlin').locationId).toBeNull();
  });
});
