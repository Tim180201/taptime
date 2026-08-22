# Block E2A — Warm-Session Deferred Offline Capture Physical Validation Evidence

Status: PASSED — Human Physical Android Validation and Independent Final Review Approved
Date: 2026-07-14
Owner/Test Operator: Human Architect under Technical-Lead guidance
Authorized Baseline: `9f2f922fd46e33cb9d53d80e4a7dbedb73653ad1`
Validated Implementation Commit: `4b5ecdc7d6605db3e231f9ead966ebf104900a30`
GitHub Actions: Run `29348512506` — all eight jobs passed for the validated implementation commit
Authority: ADR-0010 and the Block E2A authorization

## 1. Truthful result

The Human Architect completed the mandatory E2A physical flow on the approved Samsung Galaxy A33
5G / Android 15 and NTAG213 Tag A. An online scan first produced a genuine server-canonical Start.
While the same authenticated app session remained warm, the Mobile API transport was then made
unreachable by removing only its approved USB reverse mapping. Scanning the same tag created one
immutable version-2 outbox record and presented only a pending-transmission message; it did not
claim Start or Stop and did not change server state.

After a real Android process force-stop and restart, restoration of the Mobile API transport and
session context exposed the same protected pending record. The explicit retry submitted only the
unchanged command. The server durably stored deferred WorkEvent, received SyncReceipt and AuditEvent
evidence, returned the exact durable-deferred acknowledgement and did not evaluate a second
canonical lifecycle decision or stop/mutate the active TimeEntry.

This proves the authorized warm-session, same-context, one-record E2A path in the strictly local
synthetic environment. The transport interruption was a controlled removal of C2 reachability at
the application boundary, not airplane mode or a device-wide radio outage. It therefore does not
prove arbitrary offline networking, cold-start offline resolution, automatic synchronization,
multiple queued events, production infrastructure, iOS or full Block E.

## 2. Bound implementation and device

| Item | Recorded evidence |
|---|---|
| Repository commit | `4b5ecdc7d6605db3e231f9ead966ebf104900a30` |
| Implementation CI | GitHub Actions run `29348512506`; exact head SHA above; eight of eight jobs passed |
| Device | Samsung Galaxy A33 5G, model `SM-A336B` |
| Operating system | Android 15, SDK 35 |
| Physical tag | Human-Architect-confirmed NTAG213 Tag A |
| Safe operator binding | Shortened SHA-256 validation fingerprint `B55E8B6AEB30`; no raw UID recorded |
| Android package | `com.tim180201.mobile.synthetic` |
| App version | `1.0.0`, version code `1`; min SDK 24, target SDK 36 |
| APK | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`; 69,592,419 bytes |
| APK SHA-256 | `fa969435ec8d6f95160e74e4a1fe8dbf315b33834192094bd3cfb20ad9be5af4` |
| Runtime transport | USB reverse for Auth `tcp:54321` and Mobile API `tcp:3000`; only `tcp:3000` was removed for the E2A interruption |
| Data environment | Strictly local synthetic PostgreSQL/runtime; no production or real-person data |

## 3. Physical sequence and observations

| Step | Observation | Server evidence |
|---|---|---|
| Clean synthetic start | The compiled synthetic environment reported ready and exposed only the guarded Tag-A arm/status/stop operator commands. | Initial status was zero for all evidence/configuration counters. |
| Negative control | The first physical Tag-A capture displayed `Tag nicht zugeordnet`. | No Tag, Assignment, lifecycle or audit evidence was created. |
| Controlled provisioning | The operator armed only fingerprint `B55E8B6AEB30`; the next Tag-A capture still displayed the generic unassigned result. | Exactly 1 Tag, 1 Assignment and 2 AuditEvents; zero WorkEvents, Decisions, Receipts and TimeEntries. |
| Online seed action | The following Tag-A scan displayed `Arbeitszeit gestartet` / `Der Server hat den Start bestätigt.` | Exactly 1 WorkEvent, 1 CanonicalDecision, 1 synchronized SyncReceipt and 1 active TimeEntry. This also seeded the one-slot same-session context. |
| API transport interruption | Without killing the app, only `adb reverse tcp:3000` was removed; Auth reverse `tcp:54321` remained. The same physical Tag A was scanned. | Counts remained unchanged, proving the capture did not reach or mutate the server during the interruption. |
| Truthful local acknowledgement | Mobile displayed `Übertragung noch offen` and `Der Scan ist sicher auf diesem Gerät vorgemerkt. Es können ausschließlich dieselben unveränderten Daten erneut gesendet werden – auch nach einem App-Neustart.` | No local Start/Stop claim and no server-side second decision or TimeEntry mutation. A second scan remained blocked by the occupied record. |
| Real process restart | Android stopped package `com.tim180201.mobile.synthetic` with `am force-stop`; the package was relaunched while C2 remained unreachable. | Mobile initially displayed `Sitzungskontext vorübergehend nicht verfügbar.` No evidence was submitted or deleted. |
| Pending-record recovery | After restoring `tcp:3000` and retrying session resolution, Mobile again displayed the exact pending copy and the action `Unveränderte Daten erneut senden`. | This demonstrated physical process-restart protection for the already captured version-2 record. |
| Exact explicit retry | The operator selected only `Unveränderte Daten erneut senden`. | The server accepted the exact retained command through the dedicated defer-only route. |
| Durable deferred result | Mobile displayed `Scan sicher gespeichert` and `Der Server hat die Scan-Evidenz gespeichert. Deine Arbeitszeit wurde noch nicht verändert und wartet auf eine sichere Prüfung.` | One additional WorkEvent, one received SyncReceipt and one LifecycleDeferred AuditEvent were durable; no second CanonicalDecision and no TimeEntry stop/mutation occurred. |

## 4. Exact final server trace

The final sanitized harness status was:

```text
{"provisioning":"disarmed","auditEvents":4,"canonicalDecisions":1,"nfcAssignments":1,"nfcTags":1,"stoppedTimeEntries":0,"syncReceipts":2,"timeEntries":1,"workEvents":2}
```

Database aggregates independently exposed by the guarded local harness were:

| Trace | Exact result |
|---|---|
| SyncReceipt statuses | `received = 1`, `synchronized = 1` |
| Audit event types | `LifecycleDeferred = 1`, `LifecycleEvaluated = 1`, `NfcTagAssigned = 1`, `NfcTagRegistered = 1` |
| TimeEntry state | `started = 1`; stopped entries `0`; rows with a stop WorkEvent ID `0` |
| Canonical decisions | `1`, belonging only to the initial online Start |
| WorkEvents | `2`: the initial canonical action and the later defer-only evidence action |

The delta from the online seed state to the final state is therefore exactly:

```text
WorkEvent +1
received SyncReceipt +1
LifecycleDeferred AuditEvent +1
CanonicalDecision +0
TimeEntry +0
stopped TimeEntry +0
```

That delta is the required evidence that the cached-context path stored evidence without granting
Mobile lifecycle authority or silently converting the action into a Stop.

## 5. Cleanup evidence

- The guarded runtime command returned `synthetic_e2e_stopped`.
- The scoped Mobile disconnect helper returned `synthetic_e2e_loopback_reverse_removed`.
- `adb reverse --list` was empty after cleanup.
- The synthetic password and database URL shell variables were unset.
- PostgreSQL cleanup proved `to_regnamespace('taptime_server') IS NULL`.
- The count of generated synthetic runtime roles was `0`.

No production environment, production secret, remote service or real personal data was used.

## 6. Gate disposition and remaining limits

The physical Android observations required for the narrow E2A implementation are complete for the
recorded device, tag, APK and controlled C2 interruption. The test additionally closes E1's recorded
physical process-restart evidence gap for this version-2 E2A path: the already captured command
survived an Android force-stop/relaunch and remained protected until exact explicit retry.

This evidence does not upgrade the route into client/device attestation and does not prove that a
physical NFC scan occurred to any remote verifier. The endpoint remains an authenticated,
tenant-checked, authority-reducing ingestion route. The following remain open:

- DT-060–DT-062 and Block E as a whole;
- cold-start offline context resolution and persisted authorization/configuration leases;
- more than one pending event, automatic/background retry and reconciliation administration;
- airplane-mode, broad Android device/fleet, iOS, production cloud and production-data validation;
- post-revocation, retention/erasure and support-operated reconciliation policies.

The independent final review found the physical sequence, database delta, cleanup and narrow
transport-loss claim internally consistent and returned `APPROVED` with no open P0/P1/P2/P3.
Governance may therefore use this record to close only the authorized E2A scope.
