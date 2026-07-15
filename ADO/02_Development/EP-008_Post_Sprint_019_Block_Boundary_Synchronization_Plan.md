# EP-008 Post-Sprint-019 Block-Boundary Synchronization Plan

Status: Completed — synchronization and closure CI passed; independent final review approved; Human accepted
Date: 2026-07-15
Owner: Technical Lead
Human Authority: Explicit Human Architect instruction to proceed on 2026-07-15
Exact baseline: `fda5e5b9e878311b0caa647c6b49ab14943b706e`
Synchronization publication: `d9060fe96bcb9d2e3282d5cb08a455d113b86307`
Synchronization CI: GitHub Actions run `29394356224` — ten of ten jobs passed
Closure publication: `9c9144fa468cbaa6d1195a172f92e746ad3eb265`
Closure CI: GitHub Actions run `29394550988` — ten of ten jobs passed
Independent Review: `ADO/05_Evidence/EP-008/EP-008_Post_Sprint_019_Independent_Final_Review.md`
Human Acceptance: `ADO/02_Development/EP-008_Post_Sprint_019_Human_Acceptance.md`
Production authority: Not granted
Engineering-slice authority: C3D/C3E remain separately gated

## 1. Purpose

Restore the active EP-008 Developer Implementation Manual and EP-009 readiness view to current
repository truth before entering another product Block. The work is documentation-only and follows
Core Roadmap v2 Section 9: full EP-008 synchronization is not required after every micro-sprint, but
is required at material Block boundaries or new architecture decisions.

## 2. Trigger findings

- **P1 documentation integrity:** EP-008 Chapters 00–03 stop at Development Sprint 019 and continue
  to present fake Auth, synchronous ports, missing Stop, missing physical NFC validation, absent
  backend/admin entry points and source-only typechecking as current reality.
- **P2 current-status contradiction:** `Project_Status.md` says the backend technology decision is
  deferred although accepted ADR-0008 fixes Supabase-managed PostgreSQL/Auth plus managed Node.
- **P3 readiness clarity:** the 2026-07-10 K1–K12 chronology is preserved correctly but its present
  tense can be mistaken for current backlog. EP-009 requires an evidence-triggered reassessment and
  dated roadmap update rather than rewriting the baseline.

## 3. Authorized scope

1. Add one concise post-Sprint-019 block-boundary reconciliation to each existing EP-008 Chapter
   00–03 and update its synchronization metadata.
2. Preserve the Sprint-001–019 text as historical evidence; mark the old Chapter-03 gap list
   explicitly historical.
3. Correct the ADR-0008 contradiction and the EP-008 synchronization statement in Project Status.
4. Create an additive EP-009 reassessment that dispositions K1–K12 and updates the qualitative
   readiness scorecard using repository evidence through C3C/E2A.
5. Add a dated Roadmap addendum, Decision Log entries, AVR tracking, ADO navigation and reproducible
   evidence.
6. Publish only after local consistency checks, explicit Technical-Lead approval and exact-head
   ten-job GitHub CI.

## 4. Non-goals

- No product code, tests, SQL, migration, dependency, workflow or runtime configuration changes.
- No new architecture, Feature Blueprint, Technical Specification, Business Rule or Development Task.
- No implementation or authorization of C3D, C3E, full offline sync, Blocks F–I or production.
- No rewriting or deleting dated sprint, assessment or external-review chronology.
- No creation of missing EP-008 Chapters 04–10; they remain a separately governed documentation
  backlog.
- No use of untracked `research/` as evidence or publication scope.

## 5. Acceptance criteria

- Every existing EP-008 chapter identifies exact synchronization baseline and current authority.
- Current guidance accurately reflects async ports, server-canonical lifecycle, B4/B5/B6/C2,
  Block-D Android NFC, E1/E2A and separate C3B/C3C planes.
- Historical current-state claims are explicitly bounded and no longer usable as present guidance.
- K1–K12 have one current, evidence-linked disposition and the ten-domain scorecard is extended,
  not recreated.
- Project Status no longer contradicts ADR-0008.
- C3D/C3E, production, two Supavisor modes, full offline, distribution and legal/commercial gates
  remain truthful and explicit.
- Changed ADO references resolve; Markdown/table structure and `git diff --check` pass.
- Only explicitly listed ADO files are staged; `research/` remains untouched.
- The publication commit and final closure-publication head each pass all ten GitHub CI jobs.

## 6. Closure strategy

The first ADO-only commit publishes the synchronized manual/reassessment and must pass exact-head CI.
A later ADO-only closure commit records that real commit/run and may be created only after both exist.
The closure commit must itself pass exact-head CI; its identifier is reported as final publication
evidence without recursively inventing another future identifier.

## 7. Completion record

The synchronization publication commit `d9060fe96bcb9d2e3282d5cb08a455d113b86307` was pushed to
`main`. GitHub Actions run `29394356224` is a completed `push` run bound to that exact SHA and passed
all ten jobs. This satisfies the first publication gate. The separate ADO-only closure publication
records that evidence; its own final SHA and exact-head CI run are reported after publication rather
than recursively embedded into another commit.

The independent external final review of closure head
`9c9144fa468cbaa6d1195a172f92e746ad3eb265` returned `APPROVED`. Its sole P3-labeled observation
concerned only SSH host-key configuration in the review sandbox; fresh HTTPS remote verification
passed, the review required no repository correction and the Technical Lead closed the observation
as not applicable to TapTim.e. Final open repository counts are P0/P1/P2/P3 = 0/0/0/0.

The Human Architect accepted the synchronized EP-008 Chapters 00–03 and the 2026-07-15 EP-009
Product Readiness Reassessment on 2026-07-15. C3D remains separately gated.
