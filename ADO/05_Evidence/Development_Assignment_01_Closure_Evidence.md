# Development Assignment 1 — Closure Evidence

Date: 2026-07-21
Owner: Human Architect + Technical Lead
Status: **COMPLETED FOR AUTHORIZED LOCAL SCOPE — CLOSURE PUBLICATION EXACT-HEAD CI 10/10**

## 1. Closure boundary

Development Assignment 1 is approved for closure only for its authorized local Android,
repository and synthetic-server scope. The closure-approved boundary is DT-060–DT-062:

- real synchronization gateway;
- offline-to-server synchronization flow; and
- retry and idempotency rules.

The closure includes the Human-accepted ADR-0012 policy, approved Workstreams A–E, every published
correction, the sixth complete fresh Human Physical Gate A–E and the independent final closure
review. It does not include production resources/data, deployment, distribution, iOS/Web NFC,
review adjudication, setup/export Assignment 2 or Assignments 3–8.

## 2. Exact closure chain

| Boundary | Exact binding |
|---|---|
| Product | `48a21a7ed75c3ab3b15fec93669b5ca2d87d5a30`, tree `7c053beeb0c9ef550216bd1dad0a59fc226866a6` |
| Artifact correction | `0fdddbce53369e3c73f345eee1c077226a40797f`, tree `62b5efc4efd36da1fbd0e6f2058a448aabd1ab1a` |
| Artifact review publication | `1527855b3db4bf387e4efc9e09691a15d588408b`, tree `1bc2511a540944901e10566fca914f1fab70ee13` |
| Physical authorization baseline | `0e2590b67ad42b5aace8834090dd1412a59845c1`, tree `23fc9d312341e26c973cc4941fcc6d66b0aef648` |
| Physical evidence publication | `8d5b2bb35d59cc00b2f5f518c06f09aa0d881723`, tree `592f9da6a0e8bed14107975b1073d23a9dce4717` |
| Physical evidence CI | Run `29836085810`, attempt 1, push to exact head `8d5b2bb`, 10/10 successful |
| Final independent review | `APPROVED`, zero open P0/P1/P2/P3 |
| Closure publication | `715889ea0e410337bc695b0277730ad585a4c5a1`, tree `b9fc3ac46b1e808193c4532efdc98ab5e91a5e8e` |
| Closure publication CI | Run `29837556200`, attempt 1, push to exact head `715889e`, 10/10 successful |

## 3. Permanent artifact manifest

This repository stores the disclosure-safe manifests, not the APK binaries.

### Failed fifth-run evidence artifact — prohibited for use

| Property | Manifest value |
|---|---|
| Exact bytes | 95,425,607 |
| SHA-256 | `4239f6c609430d3926dbfc053c7ad0688a4022903eef8a3ffe1ebeece2356b7c` |
| Runtime verification | Rejected: required synthetic Auth URL, API URL and publishable key absent |
| Disposition | Historical failure evidence only; not used by the sixth run |

### Runtime-complete sixth-run artifact

| Property | Manifest value |
|---|---|
| Exact bytes | 95,425,695 |
| SHA-256 | `aa081fca431174cf90698b4afaaa5c1f5f28ed976c54cda7a74df72a49d5ffbf` |
| Package | `com.tim180201.mobile.synthetic` |
| Version | Code 1 / name `1.0.0` |
| Signature scheme | APK Signature Scheme v2, valid |
| Signer certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Runtime verification | Exact synthetic Auth URL, API URL and publishable key present in one Hermes bundle |
| Backup/transfer boundary | `android:allowBackup=false`; full-backup and data-extraction exclusions verified |
| Gate binding | Host and pulled installed-device APK matched byte-for-byte before first launch |
| Gate result | Sixth complete fresh Human Physical Gate A–E passed |

No secret runtime value is recorded here. The manifest records only the fact that the three exact
authorized values passed deterministic verification.

## 4. Acceptance completion

All Authorization Section 10 conditions are satisfied:

- architecture and numeric policies independently approved and Human accepted;
- exact implementation baseline separately authorized;
- Workstreams A–E implemented and reviewed;
- persist-first FIFO shared by online/offline scans;
- cold-start exact-lease offline capture proven;
- multi-event restart persistence and automatic ordered synchronization proven;
- server-canonical authority, historical configuration and sequence review proven;
- lost-response idempotency and durable review outcomes proven;
- migration, SQLCipher and Android background boundaries verified;
- automated suites and exact-head CI green at every required decision point;
- sixth complete fresh Human Physical Gate A–E passed; and
- final independent closure review returned `APPROVED` with zero open P0/P1/P2/P3.

## 5. Remaining boundary

Closure publication `715889ea0e410337bc695b0277730ad585a4c5a1`, tree
`b9fc3ac46b1e808193c4532efdc98ab5e91a5e8e`, passed exact-head GitHub Actions run
`29837556200`, attempt 1, ten of ten. Development Assignment 1 and DT-060–DT-062 are completed for
the authorized local Android/repository/synthetic-server scope. No additional implementation or
Human physical gate is required for DA1 unless a new finding is raised.

Production resources/data, deployment and distribution remain unauthorized. Development Assignment
2 requires its own candidate, independent pre-implementation review, exact baseline and separate
Human authorization.
