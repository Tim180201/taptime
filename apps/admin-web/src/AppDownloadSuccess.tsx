import { APP_URL } from '../../../shared/product';

export function AppDownloadSuccess() {
  return <>
    <p role="status">Ihr Passwort ist eingerichtet. Laden Sie jetzt die App und melden Sie sich dort mit Ihrer E-Mail-Adresse und diesem Passwort an.</p>
    <a className="button-link" href={APP_URL} rel="noreferrer">App laden</a>
  </>;
}
