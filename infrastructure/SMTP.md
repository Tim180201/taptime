# Custom SMTP für Supabase Auth

Supabase versendet Auth-E-Mails direkt. SMTP-Zugangsdaten gehören deshalb **nicht** in die
TapTim.e-Serverkonfiguration und nicht ins Repository, sondern ausschließlich in Supabase:

`Dashboard → Authentication → SMTP Settings`

Für Brevo eintragen:

| Feld | Wert |
|---|---|
| Custom SMTP | aktiviert |
| Sender email | `no-reply@tb-infra.de` |
| Sender name | `TapTim.e` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Brevo **SMTP login** |
| Password | neu erzeugter Brevo **SMTP key** |

SMTP-Key und Login werden nur zwischen Brevo und Supabase übertragen. Nicht in Chat, `.env`,
Shell-Historie oder Git kopieren. Nach dem Speichern unter `Authentication → Rate Limits` die
projektweite E-Mail-Grenze prüfen; Supabase startet Custom SMTP mit 30 Nachrichten pro Stunde.

## DNS für `tb-infra.de`

In Brevo die Absenderdomain hinzufügen und die dort für dieses Konto erzeugten SPF- und
DKIM-Werte **wortgetreu** beim DNS-Provider setzen. Keine Schlüsselwerte aus Beispielen
übernehmen. Zusätzlich genau einen DMARC-TXT-Record auf `_dmarc.tb-infra.de` setzen; für die
Einführung genügt `p=none`, bis reale Zustellberichte eine strengere Policy erlauben.

Abschlussprüfung:

1. Brevo zeigt Domain, SPF und DKIM als authentifiziert.
2. `dig +short TXT tb-infra.de`, `dig +short TXT <brevo-dkim-host>` und
   `dig +short TXT _dmarc.tb-infra.de` liefern die veröffentlichten Werte.
3. Eine echte Passwortzurücksetzung erreicht ein fremdes Postfach und liegt nicht im Spam.
4. Die Nachrichtenkopfzeilen zeigen `spf=pass`, `dkim=pass` und `dmarc=pass`.

Beim späteren Produktnamenwechsel werden Absenderdomain, DNS und Supabase-Sender gemeinsam
umgestellt; die SMTP-Zugangsdaten bleiben davon unabhängig.
