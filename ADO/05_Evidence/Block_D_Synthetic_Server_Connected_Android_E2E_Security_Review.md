# Block D — Synthetic Server-connected Android E2E Security Review

Status: Technical-Lead Approved after Three Blocking Corrections — Awaiting GitHub CI and Physical E2E

Date: 2026-07-14

Scope: local non-production test infrastructure only

Authority: Human Architect instruction for the synthetic server-connected Android E2E slice

## 1. Review statement

This review evaluates only the newly added local test harness, Android synthetic build variant and
operator workflow. It does not approve production Auth, deployment, C3 administration, Block-E
offline synchronization or production personal data.

No external cloud, public tunnel, remote database, real person record or production credential was
created or used. Technical-Lead review is complete and authorizes commit/push after the corrections
in Section 4. A Human/delegated physical run remains mandatory before any server-connected NFC
result is claimed.

## 2. Trust boundaries and protected values

```text
physical tag
  -> Android NFC process (raw UID only inside native/adapter boundary)
  -> canonical payload inside private ProductScanOrchestrator/C2 request
  -> USB adb reverse
  -> host-loopback synthetic Auth and real C2 API
  -> four distinct least-privilege PostgreSQL logins
  -> disposable synthetic-only database
```

Protected values are the physical raw UID/canonical payload, password, private signing key,
access/refresh tokens, PostgreSQL runtime passwords and provider/database failure details. None is
allowed in React state, UI, terminal status, diagnostics or ADO Evidence.

The shortened 12-character SHA-256 validation fingerprint is deliberately non-authoritative. It is
accepted only as a local operator correlation value for the one-shot physical fixture assignment;
it is never treated as authentication or stored as the server lookup key.

## 3. Security findings and disposition

| ID | Review point | Result | Evidence / disposition |
|---|---|---|---|
| D-E2E-S01 | Network exposure | Passed in code/config | Auth, C2 and PostgreSQL require numeric loopback. Android uses USB `adb reverse`; the installer requires an empty initial table, verifies exactly the two approved mappings and removes both on installation failure. Successful runs expose a mandatory exact cleanup command. No LAN bind, tunnel or cloud fallback exists. |
| D-E2E-S02 | Android plaintext scope | Passed in config | Only the distinct synthetic package receives a Network Security Configuration with base cleartext denied and a `127.0.0.1` exception. Product runtime configuration independently rejects remote HTTP. |
| D-E2E-S03 | Authentication integrity | Passed in automated test | Password is scrypt-verified; RS256 key is generated per process; C2 retrieves the issuer-bound JWKS and verifies exact claims. The real Mobile email/password adapter and refresh rotation are exercised; no static bearer bypass exists. |
| D-E2E-S04 | Identity and tenant authority | Passed in automated test | Issuer/subject resolves through B4 to the seeded User and active Employee Membership; requested Organization remains non-authoritative. B5/B6 use their existing RLS and server Membership resolution. |
| D-E2E-S05 | Runtime least privilege | Passed in automated test | Session, read, lifecycle and provisioner logins are distinct, `NOINHERIT`, non-superuser, non-`BYPASSRLS`, non-role-creator and have no direct table access after `RESET ROLE`; exact parent-role graphs are asserted. |
| D-E2E-S06 | Controlled Tag-A provisioning | Passed in automated test | No HTTP/Admin endpoint exists. A terminal-local one-shot arm requires Tag A's shortened fingerprint. A mismatching Tag B remains unresolved and does not consume the arm. The matching canonical payload is inserted through a separate Administrator login, active Administrator Membership, transaction-local context, existing RLS and atomic audit triggers. |
| D-E2E-S07 | Provisioning/lifecycle separation | Passed in automated test | The provisioning capture always returns C2's generic not-resolved response and produces zero WorkEvents, Decisions, Receipts or TimeEntries. Only the next normal product scan can enter B6/Core. |
| D-E2E-S08 | Server decision provenance | Passed in automated test | The first post-provision command returns genuine `time_entry_started`; a second command six seconds later returns genuine `time_entry_stopped`. Database evidence proves two WorkEvents/Decisions/Receipts and one reciprocally linked stopped TimeEntry. Mobile source remains free of `BusinessEngine` and Start/Stop selection. |
| D-E2E-S09 | Disclosure control | Passed in source/test review | Safe diagnostics are a closed enum with no request values. Operator status contains counts only. Product UI uses existing generic German outcomes. No UID, canonical payload, token, password or provider/database exception is printed. |
| D-E2E-S10 | Destructive setup guard | Passed in automated test | Reset requires PostgreSQL on numeric loopback, exact database name `taptime_synthetic_android_e2e`, matching server address/current database and a role-capable local installer. Remote, `localhost`-named and wrong-database URLs fail before reset. |
| D-E2E-S11 | Cleanup | Passed in automated teardown and compiled startup/stop check | Normal shutdown closes terminal input, HTTP servers and runtime pools, drops the disposable schema/ledger and generated runtime logins, then closes the installer pool. A separate fail-closed device helper removes only reverse ports `54321` and `3000`, refuses unexpected targets and never uses `--remove-all`. Crash recovery still requires dropping/recreating the dedicated database before reuse. |
| D-E2E-S12 | External-resource gate | Passed | Build/run helpers contain no EAS, tunnel, cloud or remote-host command. No such resource was created during implementation. |
| D-E2E-S13 | Existing native project protection | Passed after Technical-Lead correction | The original clean-prebuild helper could delete an existing untracked `apps/mobile/android` directory. The approved helper refuses both tracked and untracked native directories and no longer uses Expo's destructive `--clean` flag. |
| D-E2E-S14 | Continuous regression gate | Passed in workflow review; remote run pending | A dedicated PostgreSQL `17.10` GitHub Actions job now runs the synthetic harness tests-inclusive Typecheck, all five direct-database tests and build on every push/PR to `main`. |

## 4. Technical-Lead findings and corrections

| Finding | Initial risk | Correction | Disposition |
|---|---|---|---|
| D-E2E-TL01 | `expo prebuild --clean` could remove an existing untracked native Android project despite the tracked-file guard | Removed `--clean`; added an exact existing-directory refusal before prebuild | Closed; blocking |
| D-E2E-TL02 | Successful installation left reverse mappings active with cleanup only described manually | Added a mandatory printed command and a scoped helper that validates/removes only `54321` and `3000` | Closed; blocking |
| D-E2E-TL03 | The real five-case PostgreSQL harness was not itself enforced by GitHub Actions | Added an isolated PostgreSQL 17 CI job for Typecheck, 5/5 tests and build | Closed in workflow; remote execution pending |

## 5. Deliberate limitations

- The local Auth component is a cryptographically real synthetic password/JWT/JWKS fixture, not a
  Supabase Cloud or full GoTrue conformance environment. It proves the Mobile adapter and B4 trust
  path without static-token injection; it does not prove provider availability, email delivery,
  hosted rate controls or cloud operations.
- USB debugging grants the development host a powerful device trust relationship. The run must use
  a controlled engineering device/host, and both reverse mappings must be removed afterward.
- Loopback HTTP contains only synthetic data and is isolated from the LAN, but it is still
  plaintext. A compromised host/device could observe it. This exception must never enter a
  production package or real-data environment.
- A process/host crash can leave the disposable schema and generated login roles until the
  dedicated test database is dropped or the next guarded setup resets it.
- The one-shot provisioning wrapper is test-fixture infrastructure, not a reusable product command
  or C3 design. It must be deleted or remain isolated when a real administration flow is later
  authorized.
- The existing eleven moderate dependency findings remain open; no audit fix was applied.
- Supabase Cloud, Supavisor, production TLS/secrets/observability, C3, Block E and production data
  remain unverified and unauthorized.
- This implementation environment had no Android SDK/JDK/ADB or attached device. The APK install,
  reverse mapping and physical Tag-B/Tag-A UI outcomes remain unobserved in this task until a
  properly equipped Human/delegated run occurs.

## 6. Review conclusion

After the three corrections above, the implementation is appropriately fail-closed for a
disposable synthetic test harness and does not weaken the product C2/B3–B6 boundaries. Technical
Lead verdict: `APPROVED` for commit/push. GitHub CI and the physical server-connected checklist
remain open; this review is not a physical-result claim or an independent third-party approval.

Primary platform references:

- Android local-server access and `adb reverse`:
  `https://developer.android.com/develop/ui/views/layout/webapps/access-local-server`
- Android Network Security Configuration:
  `https://developer.android.com/privacy-and-security/security-config`
