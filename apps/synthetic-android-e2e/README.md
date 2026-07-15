# TapTim.e Synthetic Android E2E

Status: strictly local, synthetic and non-production test infrastructure

This Node-24 workspace runs the real C2/C3C HTTP router, B4 identity resolution, B5 tenant read
model, B6 lifecycle coordinator, C3C administration coordinator, Core `BusinessEngine` and
PostgreSQL migrations `001`–`007`. It adds only a local password/JWKS fixture, separate synthetic
Employee/Administrator identities and the retained one-shot Tag-A fixture-provisioning control used
by the earlier Block-D regression. It is not a production Auth provider, backend deployment or
Block-E synchronization implementation.

## Safety boundary

- Auth and C2 bind only `127.0.0.1`.
- PostgreSQL must use numeric loopback and the exact database name
  `taptime_synthetic_android_e2e`; setup fails before reset otherwise.
- Android reaches only those loopback ports over USB `adb reverse`; no LAN, tunnel or cloud
  resource is used.
- Runtime passwords, the asymmetric private key, access/refresh tokens and the operator-supplied
  password are memory-only and never printed.
- Both committed emails use the reserved `.invalid` domain. All IDs, Organization and Customer
  data are synthetic.
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
or production credential. The server prints only fixed readiness/operator events and sanitized
counts.

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
