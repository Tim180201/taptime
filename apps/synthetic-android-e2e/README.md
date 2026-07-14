# TapTim.e Synthetic Android E2E

Status: strictly local, synthetic and non-production test infrastructure

This Node-24 workspace runs the real C2 HTTP router, B4 identity resolution, B5 tenant read model,
B6 lifecycle coordinator, Core `BusinessEngine` and PostgreSQL migrations `001`–`005`. It adds only
a local password/JWKS fixture and a one-shot Tag-A fixture-provisioning control. It is not a
production Auth provider, backend deployment, C3 administration API or Block-E synchronization
implementation.

## Safety boundary

- Auth and C2 bind only `127.0.0.1`.
- PostgreSQL must use numeric loopback and the exact database name
  `taptime_synthetic_android_e2e`; setup fails before reset otherwise.
- Android reaches only those loopback ports over USB `adb reverse`; no LAN, tunnel or cloud
  resource is used.
- Runtime passwords, the asymmetric private key, access/refresh tokens and the operator-supplied
  password are memory-only and never printed.
- The committed email uses the reserved `.invalid` domain. All IDs, Organization and Customer data
  are synthetic.
- The physical canonical payload is never displayed or logged. PostgreSQL stores it only because
  the actual B5 lookup requires the assignment key.
- `research/` is outside this workspace and outside the slice.

## Prerequisites

- Node `24.17.0` and the repository dependencies installed from `package-lock.json`;
- local PostgreSQL 17 with a dedicated disposable database and a local installer role allowed to
  create roles;
- for the physical run only: local Android SDK/JDK, one USB-debug-authorized Android device, NFC
  enabled and the two previously validated NTAG213 tags;
- the 12-character value labelled `PRÜF-FINGERPRINT · SHA-256 GEKÜRZT` for physical Tag A from the
  existing validation app. Do not enter or record a raw UID.

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

## Human physical E2E checklist

Use the synthetic email printed by the harness and the synthetic password supplied at startup.
Do not capture the login screen or terminal while entering the password.

1. Scan physical NTAG213 Tag B. The product screen must report `Tag nicht zugeordnet`; terminal
   `status` must still show zero tags, assignments and lifecycle evidence.
2. In the harness terminal enter `arm-tag-a <12-HEX-PRÜF-FINGERPRINT>` using Tag A's shortened
   validation fingerprint, never its UID.
3. Scan Tag B once more as a negative control. It remains unassigned and the arm remains active.
4. Scan Tag A once to consume the controlled provisioning capture. The product deliberately returns
   the same generic unassigned presentation and sends no lifecycle evidence. The terminal emits
   only `tag_a_assigned`; `status` shows one Tag, one Assignment, two administrative AuditEvents and
   zero WorkEvents/Decisions/Receipts/TimeEntries.
5. Scan Tag A again. This is the first lifecycle scan and must show server-confirmed
   `Arbeitszeit gestartet`.
6. Wait at least six seconds, then scan Tag A again. The Core rule treats scans less than five
   seconds apart as duplicates; after six seconds the server must show `Arbeitszeit gestoppt`.
7. Run terminal `status`. Expected final sanitized counts are one stopped TimeEntry, two WorkEvents,
   two Decisions, two Receipts and four AuditEvents.
8. Confirm that the app and terminal showed no raw UID/canonical payload, access/refresh token,
   database/provider error or real person data.
9. Stop the harness. Normal shutdown removes the disposable schema, synthetic tenant data and its
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
C2/B4/B5/B6/Core path. It proves the unassigned/provision/Start/Stop sequence, exact role graphs,
Administrator-RLS audit evidence and the absence of lifecycle mutation during provisioning.
