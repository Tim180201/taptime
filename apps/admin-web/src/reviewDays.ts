import { useEffect, useRef, useState } from 'react';
import { REVIEW_DAYS_MAXIMUM_CASES } from '@taptime/time-review-contract';
import type { AdminWebCapability, AdminWebState, ReviewDayState, SafeReviewItem } from './contracts';
type Ready = Extract<AdminWebState, { status: 'ready' }>;
const authorityOf = (state: Ready) => JSON.stringify([state.membershipId, state.role, state.managementScope, state.selectedLocation?.id]);
interface Entry { readonly item: SafeReviewItem; day: ReviewDayState; }

/** View-owned cache: created on mount, replaced on authority/row refresh, removed on unmount. */
export function useReviewDays(state: Ready, administration: AdminWebCapability) {
  const authority = authorityOf(state);
  const cache = useRef({ authority, entries: new Map<string, Entry>() });
  const alive = useRef(true);
  const [revision, redraw] = useState(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; cache.current = { authority: '', entries: new Map() }; }; }, []);
  useEffect(() => {
    if (cache.current.authority !== authority) cache.current = { authority, entries: new Map() };
    if (state.sections.reviewItems.status !== 'ready' || !administration.loadReviewDays) return;
    const current = cache.current;
    for (const [id, entry] of current.entries) if (!state.reviewItems.includes(entry.item)) current.entries.delete(id);
    const missing = state.reviewItems.filter(item => !current.entries.has(item.reviewItemId));
    for (let offset = 0; offset < missing.length; offset += REVIEW_DAYS_MAXIMUM_CASES) {
      const batch = missing.slice(offset, offset + REVIEW_DAYS_MAXIMUM_CASES);
      const entries = batch.map(item => {
        const entry: Entry = { item, day: { reviewItemId: item.reviewItemId, status: 'loading', value: null } };
        current.entries.set(item.reviewItemId, entry); return entry;
      });
      void (async () => {
        let response: Readonly<Record<string, ReviewDayState>> = {};
        try { response = await administration.loadReviewDays!(batch.map(item => item.reviewItemId)); } catch { /* Per-case retry below. */ }
        const latest = administration.getState();
        if (!alive.current || cache.current !== current || latest.status !== 'ready' || authorityOf(latest) !== authority) return;
        for (const entry of entries) {
          const id = entry.item.reviewItemId;
          if (current.entries.get(id) !== entry || !latest.reviewItems.includes(entry.item)) continue;
          const day = response[id];
          entry.day = day?.reviewItemId === id && day.status !== 'loading' ? day : {
            reviewItemId: id, status: 'unavailable', value: null,
            message: 'Die Tageszeiten konnten nicht vollständig geladen werden. Bitte versuchen Sie es erneut.',
          };
        }
        redraw(value => value + 1);
      })();
    }
    if (missing.length) redraw(value => value + 1);
  }, [administration, authority, state.reviewItems, state.sections.reviewItems.status, revision]);
  return {
    day(item: SafeReviewItem): ReviewDayState | undefined {
      if (!administration.loadReviewDays) return state.reviewDay?.reviewItemId === item.reviewItemId ? state.reviewDay : undefined;
      const entry = cache.current.authority === authority ? cache.current.entries.get(item.reviewItemId) : undefined;
      return entry?.item === item ? entry.day : undefined;
    },
    retry(id: string) { cache.current.entries.delete(id); redraw(value => value + 1); },
  };
}
