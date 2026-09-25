import { BUSINESS_TIME_ZONE } from '@taptime/core';

/** Labels the same window the coordinator sends to the export endpoint. */
export function exportPresentation(
  window: { readonly fromInclusive: string; readonly toExclusive: string },
  monthSelected: boolean,
): { readonly label: string; readonly hint: string } {
  const from = new Date(window.fromInclusive);
  const to = new Date(window.toExclusive);
  if (monthSelected) {
    const month = new Intl.DateTimeFormat('de-DE', {
      timeZone: BUSINESS_TIME_ZONE, month: 'long', year: 'numeric',
    }).format(from);
    return { label: `CSV ${month} herunterladen`, hint: 'Alle Einträge des Monats, unabhängig von den Filtern.' };
  }
  const date = new Intl.DateTimeFormat('de-DE', {
    timeZone: BUSINESS_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const fromDate = date.format(from), toDate = date.format(to);
  const sameYear = date.formatToParts(from).find(part => part.type === 'year')?.value
    === date.formatToParts(to).find(part => part.type === 'year')?.value;
  const start = sameYear ? fromDate.slice(0, -4) : fromDate;
  return {
    label: `CSV ${start}–${toDate} herunterladen`,
    hint: 'Letzte 31 Tage, unabhängig von den Filtern. Für die Lohnabrechnung einen Monat wählen.',
  };
}
