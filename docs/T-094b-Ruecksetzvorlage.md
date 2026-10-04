# Taptura · Passwort zurücksetzen

**Erst nach dem Deploy von T-094b** im Supabase-Dashboard unter
**Authentication → Email Templates → Reset Password** einsetzen. Absendername: **Taptura**.
Site URL unter URL Configuration: `https://admin.tb-infra.de` **ohne abschließenden Schrägstrich**,
damit der Link genau `/passwort-neu` enthält. Die Redirect-Liste bleibt unverändert.

**Betreff:** Ihr neues Passwort für Taptura

**Inhalt (HTML):**

```html
<h2>Neues Passwort für Taptura</h2>
<p>Sie haben ein neues Passwort für Ihren Zugang angefordert.</p>
<p>Öffnen Sie die Webseite und setzen Sie dort Ihr neues Passwort. Danach können Sie sich in der App oder im Browser anmelden.</p>
<p><a href="{{ .SiteURL }}/passwort-neu#token_hash={{ .TokenHash }}&amp;type=recovery">Neues Passwort setzen</a></p>
<p>Der Link ist eine Stunde gültig und kann nur einmal benutzt werden. Ist er abgelaufen, fordern Sie in der App oder auf der Anmeldeseite unter „Passwort vergessen“ einen neuen an.</p>
<p>Falls Sie kein neues Passwort angefordert haben, können Sie diese Nachricht ignorieren.</p>
<p>Taptura</p>
```

Die Platzhalter unverändert übernehmen. Der Token steht nur hinter `#` und wird nicht an den
Webserver gesendet. Erst das Absenden des neuen Passworts prüft ihn bei Supabase mit `recovery`;
ein Vorabruf des Mail-Links verbraucht ihn nicht. Kein zusätzlicher Bestätigungslink und kein
`ConfirmationURL`-Link. Link-Tracking für diese Mails bleibt abgeschaltet wie bei Einladungen.

Die Vorlage legt der Product Owner nach dem Deploy an, pflegt sie bei Änderungen und entfernt
sie bei Ablösung. Development hält diese Datei mit dem ausgelieferten Ablauf konsistent.
Vor der Umstellung verschickte Links werden weiter unterstützt; verbrauchte Links zeigen den
Hinweis zum erneuten Anfordern. Zur Abnahme aus App und Web je eine neue Mail anfordern, am
Handy öffnen, das Passwort setzen und anschließend anmelden. Denselben Link erneut öffnen
und absenden: Der Hinweis „abgelaufen oder schon benutzt“ muss erscheinen.

Quellen: [Supabase-Mailvorlagen](https://supabase.com/docs/guides/auth/auth-email-templates),
[Supabase-Recovery-Verifikation](https://supabase.com/docs/reference/javascript/auth-verifyotp).
