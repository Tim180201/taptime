# Taptura · Einladung

Im Supabase-Dashboard unter **Authentication → Email Templates → Invite user** eintragen.
Absendername in **SMTP Settings**: **Taptura**.

**Betreff:** Ihre Einladung zu Taptura

**Inhalt (HTML):**

```html
<h2>Willkommen bei Taptura</h2>
<p>Ihr Betrieb hat Sie zu Taptura eingeladen.</p>
<p>Legen Sie Ihr Passwort fest. Danach können Sie sich in der App mit Ihrer E-Mail-Adresse und Ihrem Passwort anmelden.</p>
<p><a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&amp;type=invite">Passwort setzen</a></p>
<p>Falls Sie diese Einladung nicht erwartet haben, können Sie diese Nachricht ignorieren.</p>
<p>Taptura</p>
```

Der einzige Link führt zur freigegebenen `/willkommen`-Adresse. Die Platzhalter unverändert
übernehmen. Der Teil nach `#` wird nicht an den Webserver gesendet. Erst „Passwort setzen“ löst
die Einladung ein; ein Abruf durch einen Mail-Linkscanner verbraucht sie nicht.
Keinen Einladungscode und keinen zusätzlichen Bestätigungslink ergänzen.

Quelle: [Supabase-Mailvorlagen](https://supabase.com/docs/guides/auth/auth-email-templates)
(`RedirectTo`, `TokenHash`, Invite-Verifikation, Link-Prefetch und abgeschaltetes Mail-Tracking).
Die Vorlage legt der Product Owner an, pflegt sie und entfernt sie bei Ablösung; Development
hält diese Datei mit dem ausgelieferten Ablauf konsistent.
