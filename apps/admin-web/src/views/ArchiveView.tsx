import { useState } from 'react';
import { businessDay, formatZonedDateTime } from '@taptime/core';
import { useSearchPages } from '../../../mobile/src/search/useSearchPages';
import type { ArchivePerson, ArchiveTarget } from '@taptime/mobile-work-contract';
import type { AdminWebCapability, AdminWebState } from '../contracts';
import { canonicalRoutePath, defaultRoute, type AdminRoute } from '../navigation';
import { PageHeader } from '../PageHeader';
import { SearchField, SearchStatus } from '../SearchControls';
import { DataTable, EmptyState, Person } from '../ui';
import { navigateFromLink } from '../viewHelpers';

type Props = { state: Extract<AdminWebState, { status: 'ready' }>; administration: AdminWebCapability;
  route: AdminRoute; navigate: (route: AdminRoute) => void };
export default function ArchiveView(props: Props) {
  const [refresh, setRefresh] = useState(0);
  const tab = props.route.archiveTab ?? 'mitarbeiter';
  return <><PageHeader organization={props.state.projection.organization.name} title="Archiv"
    subtitle="Ehemalige Mitarbeiter und gelöschte Kunden und Projekte." onRefresh={() => setRefresh(value => value + 1)}/>
    <div className="setup-tabs" role="tablist" aria-label="Archivbereiche">
      {(['mitarbeiter', 'ziele'] as const).map((value, index) => <button type="button" key={value} role="tab"
        id={`archive-tab-${value}`} aria-controls={`archive-panel-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
        onClick={() => props.navigate({ ...props.route, archiveTab: value })} onKeyDown={event => {
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? 1 - index : null;
          if (next !== null) { event.preventDefault(); const button = event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]!; button.click(); button.focus(); }
        }}>{value === 'mitarbeiter' ? 'Ehemalige Mitarbeiter' : 'Gelöschte Kunden und Projekte'}</button>)}
    </div>
    <section role="tabpanel" id={`archive-panel-${tab}`} aria-labelledby={`archive-tab-${tab}`}>
      <ArchiveList key={`${tab}/${refresh}`} {...props} tab={tab}/>
    </section>
  </>;
}
function ArchiveList({ state, administration, route, navigate, tab }: Props & { tab: 'mitarbeiter' | 'ziele' }) {
  const people = tab === 'mitarbeiter';
  const locationId = state.selectedLocation?.id ?? null;
  const list = useSearchPages<{ items: readonly (ArchivePerson | ArchiveTarget)[]; nextCursor: string | null }, ArchivePerson | ArchiveTarget>(async (search, cursor) => {
    const result = people
      ? await administration.queryArchive?.('people', { search, cursor, locationId, membershipId: null })
      : await administration.queryArchive?.('targets', { search, cursor, locationId });
    if (result?.status !== 'ready' || !result.value) return { status: result?.status ?? 'unavailable' };
    return { status: 'ready', value: { items: 'people' in result.value ? result.value.people : result.value.targets, nextCursor: result.value.nextCursor } };
  }, value => value.items, row => 'membershipId' in row ? row.membershipId : `${row.targetType}/${row.targetId}`,
  [administration, state.membershipId, state.role, state.managementScope, locationId, tab]);
  const link = (row: ArchivePerson | ArchiveTarget) => {
    if ('targetType' in row && row.targetType === 'project') return null;
    const month = row.lastStartedAt ? businessDay(Date.parse(row.lastStartedAt)).slice(0, 7) : null;
    const destination: AdminRoute = 'membershipId' in row
      ? { ...defaultRoute('beschaeftigte', locationId), personId: row.membershipId, month }
      : { ...defaultRoute('kunden', locationId), customerId: row.targetId, month };
    return <a className="text-button" href={canonicalRoutePath(destination)} onClick={event => navigateFromLink(event, destination, navigate)}>Zeiten ansehen ›</a>;
  };
  return <>
    <SearchField value={list.input} onChange={list.setSearch}/>
    <SearchStatus state={list.state} onRetry={list.pager.retry} onClear={() => list.setSearch('')}/>
    {list.state.items.length ? <DataTable label={people ? 'Ehemalige Mitarbeiter' : 'Gelöschte Kunden und Projekte'}
      headers={people ? ['Person', 'Standort', 'Ausgeschieden', 'Letzte Zeit', 'Zeiten'] : ['Name', 'Art', 'Standort', 'Gelöscht', 'Letzte Zeit', 'Zeiten']}>
      {list.state.items.map(row => <tr key={'membershipId' in row ? row.membershipId : `${row.targetType}/${row.targetId}`}>
        <td>{'membershipId' in row ? <Person name={row.displayName ?? 'Name fehlt'}/> : row.displayName}</td>
        {'targetType' in row ? <td>{row.targetType === 'customer' ? 'Kunde' : 'Projekt'}</td> : []}
        <td>{row.location?.name ?? '–'}</td>
        <td>{formatZonedDateTime('revokedAt' in row ? row.revokedAt : row.deactivatedAt)}</td>
        <td>{row.lastStartedAt ? formatZonedDateTime(row.lastStartedAt) : '–'}</td>
        <td>{link(row)}</td>
      </tr>)}
    </DataTable> : list.state.status === 'ready' && !list.state.search ? <EmptyState>{people ? 'Noch niemand im Archiv.' : 'Noch nichts gelöscht.'}</EmptyState> : null}
    {list.state.nextCursor ? <button className="text-button" disabled={list.state.busy} onClick={() => void list.pager.loadMore()}>Weitere laden</button> : null}
  </>;
}
