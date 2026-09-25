// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FeedbackBand } from '../src/viewHelpers';
afterEach(cleanup);
it.each([
  'Gespeichert.', 'Standort wurde angelegt.', 'Standort wurde umbenannt.', 'Standort wurde stillgelegt.',
  'Heimatstandort wurde zugewiesen.', 'Arbeitszuweisung wurde vergeben.', 'Arbeitszuweisung wurde widerrufen.',
  'Verwaltungszuweisung wurde vergeben.', 'Verwaltungszuweisung wurde widerrufen.',
  'Arbeitsziel wurde einem Standort zugewiesen.', 'Standort-Funktion wurde eingeschaltet.', 'Standort-Funktion wurde ausgeschaltet.',
  'Falls das Konto existiert, wurde eine Wiederherstellungs-E-Mail versendet.',
  'Das Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.',
  'Kunde wurde sicher angelegt.', 'Projekt wurde sicher angelegt.', 'Projekt wurde deaktiviert.',
  'Einladung wurde einmalig erzeugt.', 'Zugang wurde entzogen.', 'Rolle wurde geändert.',
  'NFC-Tag wurde sicher neu zugeordnet.', 'Die Zuordnung war bereits korrekt.',
  'Die Arbeitszeit wurde korrigiert. Die ursprüngliche Fassung bleibt erhalten.',
  'Die Entscheidung wurde gespeichert.', 'Die CSV-Datei wurde erstellt und heruntergeladen.',
  'Ein beliebig umformulierter Erfolg.',
])('renders the successful result “%s” as Erledigt', text => {
  render(<FeedbackBand message={{kind:'success',text}}/>);
  expect(screen.getByRole('status')).toHaveTextContent('Erledigt');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('uses the result kind even if an error happens to have familiar success wording', () => {
  render(<FeedbackBand message={{kind:'error',text:'Gespeichert.'}}/>);
  expect(screen.getByRole('alert')).toHaveTextContent('Die Aktion wurde nicht abgeschlossen');
});
it('presents informational results without announcing a failure or success', () => {
  render(<FeedbackBand message={{kind:'info',text:'Wird gesichert …'}}/>);
  expect(screen.getByRole('status')).toHaveTextContent('Hinweis');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
