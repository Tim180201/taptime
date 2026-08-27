import { describe, expect, it } from 'vitest';
import {
  adminViews,
  canonicalRoutePath,
  defaultRoute,
  monthTimeWindow,
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
      fromInclusive: '2026-08-01T00:00:00.000Z',
      toExclusive: '2026-09-01T00:00:00.000Z',
    });
  });

  it('keeps only a canonical Location identifier in every real address', () => {
    const locationId = '31000000-0000-4000-8000-000000000001';
    const route = routeFromLocation('/beschaeftigte', `?standort=${locationId}`);
    expect(route.locationId).toBe(locationId);
    expect(canonicalRoutePath(route)).toBe(`/beschaeftigte?standort=${locationId}`);
    expect(routeFromLocation('/beschaeftigte', '?standort=Berlin').locationId).toBeNull();
  });
});
