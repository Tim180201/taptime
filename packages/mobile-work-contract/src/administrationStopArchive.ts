import { isAdministrationStopResult } from './administrationStop.js';

export const ADMINISTRATION_ARCHIVE_PENDING = 'Wird gesichert …';
export const ADMINISTRATION_ARCHIVE_TIMEOUT = 'Noch nicht extern gesichert — bitte später prüfen';

/** Poll the same command for at most three minutes. A local commit is not a saved acknowledgement. */
export async function awaitAdministrationStopArchive<T extends { readonly status: string }>(
  initial: T,
  retry: () => Promise<T>,
  isCurrent: () => boolean,
  onPending: () => void,
): Promise<T> {
  if (!isAdministrationStopResult(initial) || initial.status !== 'committed' || initial.offsiteArchived) return initial;
  onPending();
  const deadline = Date.now() + 180_000;
  while (isCurrent() && Date.now() < deadline) {
    await new Promise<void>(resolve => setTimeout(resolve, Math.min(5_000, deadline - Date.now())));
    if (!isCurrent() || Date.now() >= deadline) break;
    try {
      const result = await retry();
      if (isAdministrationStopResult(result) && result.status === 'committed' && result.offsiteArchived) return result;
      if (result.status === 'authority_rejected') return result;
    } catch {
      // The stop already committed; a transport failure cannot undo that fact.
    }
  }
  return initial;
}
