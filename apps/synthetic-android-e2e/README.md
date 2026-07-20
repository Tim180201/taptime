# TapTim.e Synthetic Android E2E

Status: strictly local, synthetic and non-production test infrastructure

This Node-24 workspace runs the real C2/C3C HTTP router, B4 identity resolution, B5 tenant read
model, B6 lifecycle coordinator, C3C administration coordinator, Core `BusinessEngine` and
PostgreSQL migrations `001`–`009`. It composes C3E1 through two additional isolated invitation and
redemption logins, two pre-existing reserved-domain provider identities without User/Binding/
Membership rows and a strictly local pre-commit interruption control. The earlier C3D identities,
physical setup path and retained one-shot Tag-A fixture-provisioning regression remain available.
It is not a production Auth provider, backend deployment or Block-E synchronization implementation.

## Safety boundary

- Auth and C2 bind only `127.0.0.1`.
- PostgreSQL must use numeric loopback and the exact database name
  `taptime_synthetic_android_e2e`; setup fails before reset otherwise.
- Android reaches only those loopback ports over USB `adb reverse`; no LAN, tunnel or cloud
  resource is used.
- Runtime passwords, the asymmetric private key, access/refresh tokens and the operator-supplied
  password are memory-only and never printed.
- All committed emails use the reserved `.invalid` domain. All IDs, Organization, Membership and
  Customer data are synthetic.
- The two C3E1 enrollment identities exist only in the local Auth fixture at startup. No User,
  IdentityBinding or Membership is seeded for either identity.
- The operator may pause exactly the next real C3E1 redemption at the final pre-commit boundary and
  abort it without committing. The pause auto-aborts after eight seconds and never prints the
  invitation secret, token, provider subject or generated database IDs.
- The physical canonical payload is never displayed or logged. PostgreSQL stores it only because
  the actual B5 lookup requires the assignment key.
- `research/` is outside this workspace and outside the slice.

## Prerequisites

- Node `24.17.0` and the repository dependencies installed from `package-lock.json`;
- local PostgreSQL 17 with a dedicated disposable database and a local installer role allowed to
  create roles;
- for the C3D physical run: local Android SDK/JDK, one USB-debug-authorized Android device, NFC
  enabled and one synthetic-test NTAG213;
- only for replaying the retained Block-D legacy checklist: its second validated NTAG213 and the
  previously recorded 12-character validation fingerprint. Never enter or record a raw UID.

## Start the local server environment

Create the dedicated database on host loopback. The exact local installer URL depends on the local
PostgreSQL installation; this example uses the current operating-system user and no remote host:

```bash
createdb -h 127.0.0.1 taptime_synthetic_android_e2e
export TAPTIME_SYNTHETIC_E2E_DATABASE_URL="postgresql://$USER@127.0.0.1:5432/taptime_synthetic_android_e2e"
read -s TAPTIME_SYNTHETIC_E2E_PASSWORD
export TAPTIME_SYNTHETIC_E2E_PASSWORD
npm run build --workspace=@taptime/synthetic-android-e2e
npm start --workspace=@taptime/synthetic-android-e2e
```

The password must be a newly chosen 16–256 character synthetic-test value. Do not reuse any real
or production credential. The server prints the Administrator, existing Employee and two
pre-Membership `.invalid` emails plus only fixed readiness/operator events and sanitized counts.

For the C3D browser surface, start a second terminal after the harness reports ready:

```bash
VITE_TAPTIME_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY=sb_publishable_taptime_synthetic_android_e2e \
TAPTIME_API_PROXY_TARGET=http://127.0.0.1:3000 \
npm run dev --workspace=@taptime/admin-web -- --host 127.0.0.1 --strictPort
```

Open only `http://127.0.0.1:5173`. The browser and both backend services remain host-loopback-only.

## Build and connect the real Android product composition

The local build creates the distinct application `com.tim180201.mobile.synthetic`, embeds the real
`ProductMobileApp`/`ProductMobileRuntime`, and permits Android cleartext only for `127.0.0.1`. It
does not use EAS or another remote build service. It refuses to run if `apps/mobile/android`
already exists, even when that directory is untracked, so a pre-existing native project is never
deleted or replaced automatically.

```bash
npm run android:synthetic-e2e:build --workspace=@taptime/mobile
npm run android:synthetic-e2e:install --workspace=@taptime/mobile
```

The install helper requires exactly one authorized device and an initially empty reverse table,
installs the local release APK and verifies that exactly these mappings exist. If installation
fails, it removes the two mappings it created:

```text
device 127.0.0.1:54321 -> host 127.0.0.1:54321 (synthetic Auth/JWKS)
device 127.0.0.1:3000  -> host 127.0.0.1:3000  (real C2 API)
```

Confirm with `adb reverse --list`. Remove exactly the two mappings after the run with:

```bash
npm run android:synthetic-e2e:disconnect --workspace=@taptime/mobile
```

The disconnect helper preserves unrelated reverse mappings and fails closed if either approved
device port points to an unexpected host port.

## Human C3D physical E2E checklist

Use the two synthetic `.invalid` emails printed by the harness and the single synthetic password
supplied at startup. Do not capture the login screen or terminal while entering the password.

1. Sign in on Android as the synthetic Employee. Confirm that `NFC-Einrichtung` is absent, then
   sign out. This is the Employee-denial observation; do not seed or mutate Memberships manually.
2. Sign in to Admin Web as the synthetic Administrator. Create one uniquely named Customer and
   confirm that only safe Organization/Customer fields are shown.
3. Sign in on Android as the same Administrator, open `NFC-Einrichtung`, refresh and select the new
   Customer.
4. Start one NFC setup capture without presenting a Tag. Force-stop and restart the app. Confirm
   that no Tag/Assignment/administration receipt was created and that the restored Administrator
   session reloads the safe setup projection.
5. Select the Customer again, enter a synthetic Tag label and capture/register/assign one physical
   NTAG213. Confirm `Tag erfolgreich zugeordnet` and record only the 12-character labelled
   validation fingerprint.
6. Refresh Admin Web and Android. Confirm matching label, fingerprint and assigned Customer without
   any raw UID/canonical payload.
7. Switch Android to `Zeiterfassung` and scan the same Tag. Confirm server-backed
   `Arbeitszeit gestartet`. Wait at least six seconds, scan again and confirm
   `Arbeitszeit gestoppt`.
8. Run terminal `status`. Expected fresh-run counts are two Customers, one Tag, one Assignment, two
   administration receipts, two WorkEvents, two Decisions, two lifecycle Receipts, one stopped
   TimeEntry and five AuditEvents.
9. Confirm that Web, app and terminal showed no raw UID/canonical payload, access/refresh token,
   database/provider error or real-person data. Sign out of Web and Android.
10. Stop the harness. Normal shutdown removes the disposable schema, synthetic tenant data and its
    generated runtime logins. Then run the mandatory disconnect helper above. After a process or
    host crash, drop the dedicated disposable database before the next run.

Only a Human Architect or delegated tester may mark the physical observations as passed. Automated
tests and a build alone do not close the server-connected physical gate.

## Human C3E1 identity/device checklist

Run this only after independent approval and exact-head CI for both the C3E1 implementation and
this harness delta. Bind the evidence to both exact SHAs/runs. Use one physical NTAG213 containing
only synthetic validation data. Never record its raw UID or canonical payload.

Controlled fresh-run prerequisite, before checklist item 1:

- Start with the disposable database freshly reset by this harness.
- Sign in on Android as the synthetic Administrator, open `NFC-Einrichtung`, assign the physical
  Tag to the seeded `Synthetic Android Customer` with label `C3E1 Existing Tag`, then sign out.
- Run terminal `status`. It must show one Customer, one Tag, one Assignment, one administration
  receipt, two AuditEvents, zero lifecycle rows and zero C3E1 invitation/redemption rows.

Then complete every observation in order:

1. Sign in to Admin Web as the synthetic Administrator. Create one invitation with display name
   `C3E1 Physical Employee`. Confirm the one-time secret is exactly 43 characters and leave this
   browser-only disclosure open until the reuse check is complete. Do not copy it into a URL,
   terminal, file, screenshot, persistent note or automated evidence.
2. Confirm the secret is absent from the URL, browser storage, terminal output, logs, safe Employee
   projection and every sanitized `status` result. The status must show one active invitation, one
   invitation receipt, no redemption receipt and still only two Users/Bindings/Memberships.
3. On Android choose `Mit Einladung beitreten` for the first pre-Membership enrollment email. It
   must show `Als Beschäftigter beitreten`, with no Organization, User, Membership, role, product
   scan screen or `NFC-Einrichtung` authority.
4. Enter the fixed public negative test value
   `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`. Confirm `Diese Einladung ist nicht verfügbar`.
   Terminal `status` must be unchanged from item 2.
5. In the terminal run `arm-redemption-interruption`. Enter the real one-time secret on Android and
   press `Einladung sicher einlösen`. Wait for terminal event `redemption_paused`, force-stop the
   app, then run `abort-redemption`. Confirm `redemption_interrupted` and an unchanged status: no
   User, Binding, Membership, consumed invitation or redemption receipt was partially committed.
6. Restart Android. The volatile enrollment intent must not restore authority. Choose
   `Mit Einladung beitreten` again with the first enrollment identity, enter the same real secret
   and complete redemption. Confirm normal `/v1/session` resolves the new Employee, the normal scan
   surface appears and `NFC-Einrichtung` remains absent.
7. Scan the already assigned physical Tag. Confirm `Arbeitszeit gestartet`, wait at least six
   seconds, scan it again and confirm `Arbeitszeit gestoppt`.
8. Sign out. Choose `Mit Einladung beitreten` with the second pre-Membership identity and enter the
   already consumed secret. Confirm the same disclosure-safe unavailable message, no authority and
   no additional User/Binding/Membership/receipt/audit row. Sign out.
9. Refresh Admin Web. Confirm exactly one projected `C3E1 Physical Employee`, discard any remaining
   browser disclosure and verify no invitation secret in the projection or storage. Final terminal
   status must show one Customer, one Tag, one Assignment, one administration receipt, two
   WorkEvents, two Decisions, two lifecycle Receipts, one stopped TimeEntry, six AuditEvents, three
   Users/Bindings/Memberships, two active Employee Memberships, one consumed invitation, one
   invitation receipt, one redemption receipt and zero active invitations.
10. Confirm that Web, Android and terminal disclosed no raw UID/canonical NFC payload, access or
    refresh token, invitation secret outside its intended one-time Web/secure Android inputs,
    database/provider error, private key, password or real-person data. Sign out of Web and Android.
11. Stop the harness. Confirm schema/migration cleanup and generated runtime-login removal, then run
    the scoped disconnect helper. Confirm ports 54321/3000/5173 have no listener and the two
    approved reverse mappings are absent.

Only Human observations can pass this checklist. A failed or interrupted observation invalidates
the run; restart from the controlled prerequisite on a fresh disposable database. C3E2, production,
deployment/distribution, Web/iOS NFC and real-person data remain outside this gate.

## DA1 Gate-C response-drop helper

The private Node-24 helper provides the one-shot, disclosure-safe lost-response fault required by
Development Assignment 1 Gate C. It binds only `127.0.0.1:3001`, forwards only to the existing
`127.0.0.1:3000` synthetic API, withholds the first complete synchronized response for the exact
`POST /v1/lifecycle-events/offline` route and blocks every later request until explicit transport
restoration. It never prints request or response data, headers, tokens, device serials or internal
identifiers.

Build the exact reviewed harness before using either command:

```bash
npm run build --workspace=@taptime/synthetic-android-e2e
npm run gate-c:response-drop --workspace=@taptime/synthetic-android-e2e
```

The interactive helper requires exactly one active `adb devices -l` device entry proven as USB,
rejects TCP/Wireless ADB and emulators, and owns only the temporary Android API reverse swap from
direct `tcp:3000 -> tcp:3000` to proxy `tcp:3000 -> tcp:3001`. Use `restore` after the fixed
successful drop event. If the helper process terminates before normal restoration, use the
idempotent, ownership-checking recovery command. It also restores the exact temporarily missing API
mapping that can result if the process dies between its scoped remove and add commands:

```bash
npm run gate-c:transport-restore --workspace=@taptime/synthetic-android-e2e
```

The normative prerequisites, safe-event interpretation, abort conditions, exact-count evidence and
cleanup sequence are in
`ADO/04_Operations/Development_Assignment_01_Gate_C_Response_Drop_Runbook.md`. This helper grants no
physical-gate, production, deployment or distribution authority.

## Automated verification

With the dedicated PostgreSQL URL set:

```bash
npm run typecheck --workspace=@taptime/synthetic-android-e2e
npm test --workspace=@taptime/synthetic-android-e2e
npm run build --workspace=@taptime/synthetic-android-e2e
```

The integration suite uses the real Mobile email/password adapter, asymmetric tokens and the real
C2/C3C/B4/B5/B6/Core paths. It proves separate Employee/Administrator authority, real Customer
creation and atomic Tag provisioning, the legacy unassigned/provision/Start/Stop regression, exact
role graphs, Administrator-RLS audit evidence and the absence of lifecycle mutation during setup.
The separate credential-free latch suite proves eight-second autoabort, paused shutdown, safe-event
callback isolation, pre-hook delegate-failure disarm, double-abort safety and single-attempt claiming.
