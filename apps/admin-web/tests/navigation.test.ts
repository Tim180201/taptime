import { describe, expect, it } from 'vitest';
import { adminViews, canonicalViewHash, viewFromHash } from '../src/navigation';

describe('Admin Web safe fragment navigation', () => {
  it('allows exactly the five accepted slugs', () => {
    expect(adminViews.map((view) => view.slug)).toEqual([
      'uebersicht',
      'einrichtung',
      'beschaeftigte',
      'arbeitszeiten',
      'pruefungen',
    ]);
    for (const view of adminViews) {
      expect(viewFromHash(canonicalViewHash(view.slug))).toBe(view.slug);
    }
  });

  it('maps IDs, form values, nested paths and malformed fragments to Übersicht', () => {
    for (const unsafe of [
      '#record=123',
      '#pruefungen/customer-id',
      '#email@example.test',
      '#invitation_secret',
      '#',
      '',
    ]) expect(viewFromHash(unsafe)).toBe('uebersicht');
  });
});
