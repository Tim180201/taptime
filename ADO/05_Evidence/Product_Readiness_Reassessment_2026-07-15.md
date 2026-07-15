# Product Readiness Reassessment — 2026-07-15

Status: Independent Final Review Approved — additive EP-009 reassessment, Human acceptance pending
Assessment Date: 2026-07-15
Owner: Technical Lead
Repository Baseline: `fda5e5b9e878311b0caa647c6b49ab14943b706e`
Extends: `ADO/05_Evidence/Product_Readiness_Assessment.md` and
`ADO/05_Evidence/Product_Readiness_Roadmap.md`
Authority: EP-009 continuous evidence-triggered reassessment
Production authority: Not granted

## 1. Trigger and method

The 2026-07-07 Assessment is the immutable baseline. EP-009 requires an additive reassessment when
material evidence changes. Since that baseline, Core Roadmap v2 Blocks A, B1–B6, C1/C2, D, E1, the
narrow E2A slice and C3A–C3C completed their recorded repository scopes. This reassessment evaluates
only what that tracked evidence changes; it does not recreate the baseline or infer market, legal,
production or customer validation that does not exist.

Evidence sources are current tracked ADO, source/workspace inventory, accepted ADRs and exact-head CI
through baseline `fda5e5b9e878311b0caa647c6b49ab14943b706e`. Untracked `research/` is excluded and
was not read.

## 2. K1–K12 current disposition

| Finding | Current disposition | Evidence and remaining boundary |
|---|---|---|
| K1 hard-coded Mobile demo composition | **Closed for approved product scope** | C1/C2 and Block D compose real Auth, C2 transport and NFC product flow. C3D setup UI remains separate. |
| K2 real NFC adapter bypassed | **Closed for approved Android set** | Block D routes `RnNfcScanAdapter` through the product path; Galaxy A33/Android 15/NTAG213 validation passed. Broader Android/iOS fleet coverage remains open. |
| K3 no Stop lifecycle | **Closed** | Block A implements engine-driven Start/Stop plus duplicate/other-target/inconsistent-state handling. |
| K4 fake Authentication | **Closed for repository product scope** | C1 uses Supabase email/password and secure refresh restoration; B4 resolves current identity/Membership. No production Auth project is deployed. |
| K5 no backend/tenant isolation | **Closed for repository implementation** | B1–B6/C2 provide PostgreSQL schema, tenant-qualified integrity, forced RLS, distinct roles and authenticated server coordinators. Production cloud and Supavisor gates remain. |
| K6 fake synchronization only | **Open — materially advanced** | E1 provides one durable exact lifecycle outbox record and E2A narrow defer-only retry evidence. Multi-context/multi-event/background/full-offline synchronization remains open. |
| K7 synchronous effectful ports | **Closed** | Block B2 migrated all twelve effectful ports and consumers to awaited Promise contracts. |
| K8 no CI | **Closed** | Block A added push/PR CI; the current workflow has ten jobs. |
| K9 tests excluded from TypeScript checking | **Closed** | The build `tsconfig.json` remains source-only by design; the Core `typecheck` script uses `tsconfig.typecheck.json` and includes source plus tests. |
| K10 unsafe legacy file persistence | **Open but removed from the product Mobile authority path** | Legacy file adapters retain their disclosed single-writer/recovery limits. Product Mobile lifecycle evidence uses platform-secure E1 storage and server persistence. |
| K11 no installable build/distribution path | **Partially advanced; Block G open** | Android package/EAS configuration and integrity-verified internal APK/device evidence exist. Pilot/store signing, release accounts, channels and distribution operations do not. |
| K12 legal/privacy elapsed-time work | **Open** | No external legal/privacy approval, production-personal-data authority or complete commercial compliance package exists. |

## 3. Updated qualitative scorecard

The rating definitions remain those in the baseline Assessment: Emerging, Developing, Established and
Advanced. A changed rating requires evidence; unchanged ratings are retained explicitly.

| Readiness domain | 2026-07-07 | 2026-07-15 | Evidence-based rationale |
|---|---|---|---|
| Engineering Readiness | Established | **Established** | Much stronger implementation, security and CI evidence exists, but production operations/distribution and open roadmap Blocks prevent Advanced. |
| Product Readiness | Emerging | **Developing** | Real Auth, NFC Start/Stop, backend/tenant foundation and normal setup backend exist; complete setup UI, Membership flow, sync, correction/export and polished UI remain. |
| Business Readiness placeholder | Emerging | **Emerging** | No accepted ICP, pricing validation, pilot strategy or market-validation artifact is introduced by repository engineering evidence. |
| Commercial Readiness | Emerging | **Emerging** | Pricing, packaging, billing, sales process and commercial validation remain absent. |
| Legal & Compliance Readiness | Emerging | **Emerging** | External legal/privacy, employment/works-council and production-data decisions remain open. |
| Deployment Readiness | Emerging | **Developing** | Internal Android EAS/APK and physical evidence exist; no deployed backend, environment-separated release pipeline or store/pilot distribution exists. |
| Technical Operations Readiness | Emerging | **Developing** | Ten-job CI and production-shaped server workspaces exist; deployment, monitoring, incident response, backup/recovery and production secrets/IAM remain open. |
| Customer Readiness | Emerging | **Developing** | C3B/C3C provide bootstrap and normal setup backend primitives; code-edit-free Admin UI, Employee Membership setup, reassignment and end-to-end human validation remain open. |
| Support Readiness | Emerging | **Emerging** | No accepted support channel, ownership model, runbook or pilot communication process exists. |
| Scaling Readiness | Emerging | **Developing** | PostgreSQL tenant constraints/RLS and extensive concurrency/race tests exist; no live cloud/Supavisor proof, load test, capacity model or horizontal-scaling evidence exists. |

No domain is rated Advanced. Engineering remains the only Established domain. Ratings are repository
readiness, not a claim of commercial or production readiness.

## 4. Current critical path

1. **C3D:** first safe Admin Web plus protected Android Administrator NFC capture.
2. **C3E:** identity-first Employee Membership setup and explicit reassignment.
3. **Block E outside E2A:** supported synchronization, then export and minimum operations.
4. **Blocks F/G:** correction/audit/admin usability and real pilot distribution.
5. **Block H plus parallel elapsed-time work:** legal/privacy/commercial readiness before production
   personal data or paying customers.

This preserves Core Roadmap v2 ordering. The governance maintenance that produced this reassessment
must close before C3D so the developer manual and readiness view do not compound stale claims.

## 5. Explicit non-claims

- No live Supabase project, production Node service, production database or production user data is
  proven by local/synthetic server evidence.
- The two external Supavisor modes remain unverified.
- Internal EAS/APK installation is not pilot/store distribution.
- Android evidence on one approved device/tag set is not full Android or iOS compatibility.
- C3C backend closure is not a code-edit-free operational setup flow.
- E2A is not full offline synchronization.
- This reassessment is not legal, commercial, customer or market validation.

## 6. Review and next update

Technical-Lead review, both exact-head publication CI gates and independent external final review
have approved the repository-evidence accuracy. The independent review confirmed all K1–K12
dispositions and the complete scorecard with no open repository P0/P1/P2/P3 after disposition; see
`ADO/05_Evidence/EP-008/EP-008_Post_Sprint_019_Independent_Final_Review.md`.

Human acceptance is still required before this reassessment is promoted as an accepted Product
Readiness baseline. The next reassessment trigger is a material readiness change such as completed
C3D/C3E, supported pilot distribution, production deployment evidence, legal review or real pilot
outcomes.
