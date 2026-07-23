export const adminViews = [
  { slug: 'uebersicht', label: 'Übersicht' },
  { slug: 'einrichtung', label: 'Einrichtung' },
  { slug: 'beschaeftigte', label: 'Beschäftigte' },
  { slug: 'arbeitszeiten', label: 'Arbeitszeiten' },
  { slug: 'pruefungen', label: 'Prüfungen' },
] as const;

export type AdminView = (typeof adminViews)[number]['slug'];

const allowedViews = new Set<string>(adminViews.map((view) => view.slug));

export function viewFromHash(hash: string): AdminView {
  const candidate = hash.startsWith('#') ? hash.slice(1) : hash;
  return allowedViews.has(candidate) ? candidate as AdminView : 'uebersicht';
}

export function canonicalViewHash(view: AdminView): `#${AdminView}` {
  return `#${view}`;
}
