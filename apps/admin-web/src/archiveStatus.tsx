import { useEffect, useState } from 'react';
import type { ArchiveTargetId } from '@taptime/mobile-work-contract';
import type { AdminWebCapability } from './contracts';

/** Status is volatile and bound to the current actor, scope and loaded identifiers. */
export function useArchiveStatus(administration: AdminWebCapability, membershipIds: readonly string[], targets: readonly ArchiveTargetId[] = [], context = '') {
  const current = administration.queryArchive ? administration.getState() : null;
  const allowed = current?.status === 'ready' && current.role !== 'employee';
  const authority = allowed ? [current.membershipId, current.projection.organization.id, current.role, current.managementScope, current.selectedLocation?.id] : null;
  const key = JSON.stringify([authority, [...new Set(membershipIds)].sort(),
    [...new Map(targets.map(target => [`${target.targetType}/${target.targetId}`, target])).values()].sort((a, b) => a.targetId.localeCompare(b.targetId)), context]);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; people: string[]; targets: string[]; failed: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setState(null);
    if (!allowed || !administration.queryArchive) return;
    const [, people, targetIds] = JSON.parse(key) as [unknown, string[], ArchiveTargetId[], string];
    void (async () => {
      const archivedPeople: string[] = [], archivedTargets: string[] = [];
      try {
        const ids: (string | ArchiveTargetId)[] = [...people, ...targetIds];
        for (let offset = 0; offset < ids.length; offset += 200) {
          const batch = ids.slice(offset, offset + 200);
          const result = await administration.queryArchive!('status', {
            membershipIds: batch.filter((id): id is string => typeof id === 'string'),
            targets: batch.filter((id): id is ArchiveTargetId => typeof id !== 'string'),
          });
          if (cancelled) return;
          if (result.status !== 'ready' || !result.value) throw new Error('Archive status unavailable');
          archivedPeople.push(...result.value.people.filter(person => person.archived).map(person => person.membershipId));
          archivedTargets.push(...result.value.targets.filter(target => target.archived).map(target => `${target.targetType}/${target.targetId}`));
        }
        if (!cancelled) setState({ key, people: archivedPeople, targets: archivedTargets, failed: false });
      } catch { if (!cancelled) setState({ key, people: [], targets: [], failed: true }); }
    })();
    return () => { cancelled = true; };
  }, [administration, key, retry, allowed]);
  const visible = state?.key === key ? state : null;
  return {
    person: (id: string | undefined) => !!id && !!visible?.people.includes(id),
    target: (type: string, id: string | null | undefined) => !!id && !!visible?.targets.includes(`${type}/${id}`),
    notice: visible?.failed ? <p role="status">Archivmarkierungen konnten nicht geladen werden. <button className="text-button" onClick={() => setRetry(value => value + 1)}>Erneut versuchen</button></p> : null,
  };
}
