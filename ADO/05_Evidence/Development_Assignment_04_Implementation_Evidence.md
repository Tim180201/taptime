# Development Assignment 4 — Local Implementation Evidence

- Status: **LOCAL IMPLEMENTATION CANDIDATE — AVS V0–V3 GREEN; V4 AND INDEPENDENT EXACT-SHA REVIEW PENDING**
- Date: 2026-07-23
- Authorized baseline commit: `d9892435acbf7f45a96a9a01c8331afceb65f6f1`
- Authorized baseline tree: `693bc9a5ca1c0d414ff196f9dfa3352757e45701`
- Authorized baseline CI: GitHub Actions `30000921765`, attempt 1, 12/12 successful
- Risk class: AVS-001 R3
- Authorized: DA4 Workstreams A–D and AVS V0–V4
- Unauthorized: Human V5, production, production data, deployment and distribution

## Implemented scope

The focused Admin Web candidate implements the Human-accepted ADR-0015/DA4-P01–P12 boundary:

- five allow-listed fragment views: Übersicht, Einrichtung, Beschäftigte, Arbeitszeiten and
  Prüfungen, with invalid fragments resolving to Übersicht and no privileged values in URLs;
- a repository-local semantic component/token layer, visible focus, keyboard operation,
  accessible status/error patterns and responsive behavior from 320 CSS pixels;
- German `de-DE` display using the valid browser IANA timezone or UTC fallback, with invalid,
  non-existent and ambiguous local command timestamps rejected before preparation;
- explicit setup/employee pagination and retained server cursors with deterministic load-more for
  TimeRecords and review items, including loaded-versus-complete truth;
- independent section loading/unavailable/retry state and session-generation plus refresh-epoch
  protection for reads and every privileged result;
- unchanged server-confirmed create/invite/reassign/correct/adjudicate/export semantics,
  confirmation intent lifecycle, source/revision/status/overlap evidence and CSV v1 boundary; and
- one-time invitation destruction on dismiss, expiry, navigation, sign-out, identity change or
  replacement, including pending-response navigation tombstones.

Backend, schema, migrations, neutral contracts, Mobile, CI workflow and runtime configuration are
unchanged. Added packages are test-only Admin Web dependencies.

## Technical-Lead correction round

The first integrated candidate was corrected before final verification to:

1. bind all privileged request results to both active generation and refresh epoch;
2. invalidate a still-pending invitation response when navigation leaves Beschäftigte;
3. convert thrown reads into section-local unavailable state and safely accept either of the two
   initial Organization projections while failing closed on disagreement; and
4. remove the password from React state and the DOM immediately when sign-in starts.

Regression tests cover each corrected boundary. No open local P0–P3 finding remains.

## AVS V0–V3

Final fresh local verification on Node 24:

| Surface | Result |
|---|---:|
| Core | 290/290 |
| Mobile | 421/421 |
| Admin Web | 82/82 |
| Offline synchronization contract | 7/7 |
| TimeEntry export contract | 10/10 |
| Time review contract | 5/5 |
| Administration contract | 4/4 |
| Backend API | 224/224 |
| **Explicitly counted total** | **1,043 passed, 0 failed** |

Additionally passed:

- every exposed workspace tests-inclusive typecheck and production build;
- Admin Web focused correction matrix 59/59 and production build;
- Android Expo export;
- Admin-Web-scoped dependency audit with zero vulnerabilities;
- lockfile dev-only classification for Testing Library, jsdom and axe-core;
- diff, whitespace, changed-boundary and protected-path checks; and
- automated local browser smoke: semantic German sign-in, zero console warnings/errors and no
  horizontal overflow at 320 CSS pixels.

The repository-wide audit still reports the previously disclosed 11 moderate Expo/Xcode toolchain
advisories; the Admin Web scope contributes none. A preliminary full-regression invocation used the
wrong workspace start directory and noncanonical Node version, was stopped, corrected and is not
counted as evidence.

## Current gate

The Technical Lead approves the local implementation candidate with zero open P0–P3 findings.
Focused publication, complete exact-head GitHub Actions and an independent read-only exact-SHA
implementation review remain mandatory. DA4 and the related Roadmap candidates are not closed.
Human V5, production, production data, deployment and distribution remain separately unauthorized.

## Independent review round 1 and local correction

Independent read-only review of publication `37d158f36375dec5e8c16c7df0f7e35e1a3963b5`,
tree `ffc8f90dac2b2618603d6c9f33b94584fe42b151`, exact-head CI `30004127796`, attempt 1,
12/12, returned `CHANGES_REQUESTED` with five P2 findings and no P0/P1/P3:

- exact millisecond and verbatim-reason confirmation display;
- one central declared/interpreted browser-timezone context;
- newest attempted rolling window retained across failed refresh, section retry and export;
- at least 3:1 non-text contrast for focus and control boundaries; and
- logical focus return after privileged intent removal.

The focused local correction changes only nine Admin Web source/test files and adds regressions for
all five findings. Fresh V0–V3 results are reflected above. The Technical Lead finds the local
correction complete with zero open local P0–P3; correction publication, fresh exact-head CI and a
fresh independent exact-SHA re-review remain mandatory.
