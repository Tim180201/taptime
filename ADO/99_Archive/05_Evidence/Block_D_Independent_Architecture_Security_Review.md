# Block D Independent Architecture and Security Review

Status: Approved with One Non-blocking P3 — Technical Lead Disposition Complete
Review Date: 2026-07-14
Reviewer: Independent Claude review supplied by the Human Architect
Reviewed Branch: `main`
Reviewed Base Commit: `4f540ca648b9ef98c5ad4ccf3798e0279fc8bb6c`
Reviewed Head Commit: `ac5eeba116f6405e61ee26651eb9026799f2a712`
Approval Authorities: Independent Security Reviewer, Technical Lead and Human Architect

## 1. Scope and provenance

The independent reviewer inspected the complete post-C2 Block-D range
`4f540ca..ac5eeba`: 60 changed files with 5,963 insertions and 172 deletions. The tracked working
tree and exact HEAD were verified. The untracked `research/` directory was excluded and was neither
read nor changed.

The review covered ADR-0009, both Block-D authorizations, the synthetic E2E plan and evidence, the
Technical-Lead Security Review, the complete NFC adapter/orchestrator/product composition, Auth and
session wiring, the full synthetic Android E2E workspace, Android build/install/disconnect tooling,
the network-security plugin, physical-validation runtime, tests and all eight CI jobs. The existing
Technical-Lead review was treated as a claim set and independently checked against source.

The reviewer independently ran Core Typecheck and 288/288 tests, Mobile Typecheck and 253/253 tests,
and the synthetic workspace Typecheck. Without a local PostgreSQL instance the synthetic test file
reported two passed guards and three skipped PostgreSQL cases. GitHub Actions runs `29329906106`,
`29333578360` and `29335248482` were independently confirmed successful with all eight expected
jobs; the last run is bound to reviewed HEAD `ac5eeba`.

## 2. Independent verdict

Verdict: **APPROVED WITH NON-BLOCKING FINDINGS**.

No P0, P1 or P2 finding was identified. One documentation-only P3 was reported. The reviewer found
no test double, alternative composition root, authority bypass, tenant leak, network escape or
Mobile-owned Start/Stop decision that undermines the claimed product path. Block D may close after
Technical Lead disposition of the P3. C3 and Block E are not authorized by this verdict.

## 3. Finding and Technical Lead disposition

### D-FINAL-01 — P3 — Synthetic test-count wording overstated direct PostgreSQL coverage

The synthetic test file contains five `it()` cases. Three cases are inside the PostgreSQL-gated
suite: exact runtime role graphs, real Mobile authentication/session refresh, and the complete
unassigned/provision/Start/Stop path. Two cases are outside that suite: the numeric-loopback
database URL guard and a static Mobile lifecycle-authority source guard.

Several evidence statements described all five as direct PostgreSQL tests. The independent sandbox
confirmed the distinction by running the suite without PostgreSQL: two guards passed and the three
database cases were skipped.

Disposition: **Accepted and corrected during Block-D closure.** All affected current Block-D
governance/evidence claims now state the exact composition: five automated tests, comprising three
direct PostgreSQL integration cases and two non-database safety/source guards. No product or test
code change is required. The finding is non-blocking and closed.

## 4. Independently confirmed architecture and security boundaries

The reviewer confirmed that:

- `RnNfcScanAdapter.scan()` is the sole Android product capture path and the shared ADR-0009 codec
  alone creates `nfc:uid:v1:<UPPERCASE_HEX>`; no NDEF/manual/demo fallback enters the product path;
- native capture is single-flight, binds `capturedAt` in the discovery callback and drains
  registration/cancellation/late-callback races before safe reuse;
- User, Organization, Membership and session-generation boundaries are checked after every async
  boundary, while foreign ambiguous evidence is hidden in `protected_pending`;
- React receives no token, provider, native manager or privileged transport capability, and Mobile
  does not import the `BusinessEngine` or decide Start/Stop;
- the synthetic fixture uses real scrypt password checking, timing-safe comparison, ephemeral RS256
  signing/JWKS, `.invalid` identity data and no secret/token/private-key logging;
- Auth, C2 and PostgreSQL remain numeric-loopback-only; Android has one cleartext exception for
  `127.0.0.1`, a distinct package and exactly two guarded USB reverse mappings;
- install failure and normal completion remove only the approved mappings, preserving unrelated
  mappings and refusing unexpected initial/target state;
- PostgreSQL migrations remain exactly `001`–`005`; four runtime logins remain non-inheriting,
  non-superuser, non-`BYPASSRLS` and without direct table access;
- fingerprint-bound provisioning creates one Tag, one Assignment and two administrative
  AuditEvents with no lifecycle evidence; the following scans delegate Start/Stop only through
  C2/B4/B5/B6 and the unchanged Core `BusinessEngine`;
- the native-project guard refuses existing tracked or untracked Android output, and the build
  helper restores tracked `package.json` content byte-for-byte in `finally`;
- CI uses loopback PostgreSQL 17 with host networking, builds required declarations before
  Typecheck, runs the three PostgreSQL cases plus both guards, and retains every backend/Mobile/Core
  regression gate.

## 5. Physical evidence assessment

The reviewer found the Human evidence internally consistent with source, automated behavior and
the recorded database transitions: Galaxy A33 5G (`SM_A336B`), Android 15, two NTAG213 tags,
synthetic APK 1.0.0/code 1/target SDK 36, recorded APK hash, Tag-B unassigned presentation,
fingerprint-bound Tag-A provisioning with zero lifecycle mutation, server-confirmed Start and Stop,
final 2 WorkEvents/2 Decisions/2 Receipts/1 stopped TimeEntry/4 AuditEvents, no sensitive disclosure,
normal server shutdown, scoped reverse cleanup and an empty final reverse table. No repeat physical
run was requested because no contradiction was found.

## 6. Accepted limitations

The independent environment lacked PostgreSQL/Docker and could not rerun the three database cases
or B1/B3–B6/C2 database suites locally. Exact successful GitHub runs and independent Core/Mobile
execution compensate for that environment limit. An `esbuild` executable architecture mismatch in
the review sandbox is likewise not a repository finding because the exact CI jobs passed.

Supabase Cloud, Supavisor modes, production TLS/secrets/observability/deployment, broad Android
device coverage, iOS, C3, Block E, production personal data and the existing dependency findings
remain separately gated or accepted out of scope.

## 7. Closure recommendation

Close Block D after recording D-FINAL-01's precise test composition. This review does not authorize
C3, Block E, cloud deployment, production credentials/data, a broad device fleet or a new Business
Rule. The Human Architect retains authority to select and authorize the next roadmap slice.
