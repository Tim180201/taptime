import { canonicalRoutePath, defaultRoute, type AdminRoute } from '../navigation';
import { navigateFromLink } from '../viewHelpers';
export function MissingNameNotice() {
  return <div className="feedback-band access-notice" role="status">Bei mindestens einer Person fehlt der Name. In der CSV bleibt er dann leer. Namen bei der Person ergänzen.</div>;
}
export function MissingNameLink({ membershipId, locationId, month, navigate }: {
  membershipId: string; locationId: string | null; month: string; navigate?: (route: AdminRoute) => void;
}) {
  const route = { ...defaultRoute('beschaeftigte', locationId), personId: membershipId, month };
  return <a className="access-notice" href={canonicalRoutePath(route)} onClick={event => { if (navigate) navigateFromLink(event, route, navigate); }}>Name fehlt</a>;
}
