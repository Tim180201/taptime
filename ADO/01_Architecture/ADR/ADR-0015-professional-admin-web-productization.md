# ADR-0015: Professional Admin Web Productization

- Status: **HUMAN ACCEPTED — IMPLEMENTATION AUTHORIZED ON EXACT BASELINE**
- Date: 2026-07-23
- Candidate baseline commit: `166de1b149a202092443e02c61761887fde8268d`
- Candidate baseline tree: `95355924c6ea65162de80cbbefaac6facc254b08`
- Human-accepted implementation baseline commit: `d9892435acbf7f45a96a9a01c8331afceb65f6f1`
- Human-accepted implementation baseline tree: `693bc9a5ca1c0d414ff196f9dfa3352757e45701`
- Baseline CI: GitHub Actions `30000921765`, attempt 1, 12/12 successful
- Owner: Technical Lead
- Decision authority: Human Architect
- Related: ADR-0011, ADR-0013, ADR-0014, DA4 authorization candidate, AVS-001

## 1. Context

The existing Admin Web is a secure but deliberately minimal single-page operator surface. It
already reaches the accepted C3/DA2/DA3 capabilities for:

- Administrator sign-in and current Membership resolution;
- Customer creation, safe Tag projection and explicit Tag reassignment;
- one-time Employee invitation and Employee projection;
- bounded TimeEntry overview, append-only correction and CSV export; and
- bounded review-evidence projection and append-only adjudication.

The complete UI lives in one `App.tsx`; there is no application shell, route model, component
system, interactive browser test boundary, automated accessibility check or visual acceptance
gate. More importantly, TimeRecord and review-item responses expose continuation cursors, while
the current Web client requests only the first 100 rows and discards the cursor. The current UI can
therefore look complete while being incomplete.

DA4 productizes this accepted capability set. It does not create new business or backend
capabilities.

## 2. Proposed decision

### DA4-P01 — Assignment and Roadmap boundary

DA4 is the professional Admin Web productization assignment. It covers the existing Admin Web
surface and the Admin-specific portions of Roadmap candidates DT-091, DT-093 and DT-097–DT-100.
It also includes Admin-only copy polish from DT-103 where needed for safe operation.

The Roadmap labels remain planning labels; closure is limited to the exact later evidenced scope.

### DA4-P02 — Existing capability set only

DA4 may reorganize and present only already accepted C3D/C3E1/C3E2/DA2/DA3 capabilities. It SHALL
add no schema, migration, backend route, API field, database role, RLS policy, business rule,
Membership operation, Customer/Tag CRUD operation or automatic lifecycle decision.

The existing Admin Web capability/coordinator/client boundary remains the only product-operation
entry point. Presentation components do not call `fetch`, Supabase or backend code directly.

### DA4-P03 — Information architecture and safe navigation

The professional shell SHALL provide five primary views:

1. **Übersicht** — loaded-data metrics, freshness and safe operational status;
2. **Einrichtung** — Customers, safe Tags and explicit reassignment;
3. **Beschäftigte** — Employee projection and one-time invitation;
4. **Arbeitszeiten** — bounded effective records, correction and CSV export; and
5. **Prüfungen** — review evidence and adjudication.

Only a fixed allow-listed view slug may be reflected in the URL fragment. IDs, filters, timestamps,
commands, credentials, invitation secrets, tenant data and privileged form content SHALL NOT enter
the URL. Invalid view slugs resolve to Übersicht. Browser back/forward SHALL remain deterministic.

### DA4-P04 — Locale, timezone and timestamp truth

The v1 UI language and formatting locale are German (`de-DE`). Canonical API and CSV timestamps
remain UTC and unchanged.

Human-visible timestamps use the browser's valid IANA timezone and display that timezone or its
offset explicitly. If it cannot be established safely, display falls back to UTC. Correction and
adjudication inputs are interpreted in the same visibly declared zone and must round-trip without
normalization drift; invalid or non-existent local timestamps fail before command preparation.
Ambiguous daylight-saving timestamps fail closed rather than silently choosing an offset.

The existing rolling, bounded 31-day window remains unchanged in DA4. User-selectable date ranges
or Organization timezone configuration require a later product decision.

### DA4-P05 — Complete bounded data presentation

Setup, Employee, TimeRecord and review-item pagination SHALL be explicit. For TimeRecords and
review items, the client/coordinator SHALL retain the server continuation cursor and offer
deterministic load-more behavior until the cursor is null.

Counts and empty states SHALL distinguish **loaded rows** from a proven complete result. No metric,
filter or message may imply a tenant total while another page exists. Server order is retained.
Search, arbitrary sorting and advanced filtering are excluded from DA4.

### DA4-P06 — Section recovery and stale-response safety

After authenticated authority is established, each primary data area SHALL expose its own loading,
empty, unavailable and retry state. A failure in one read area must not silently present stale data
as current or unnecessarily erase safe data from another successful area.

Every request result is bound to the active session/Membership generation. Sign-out, identity
replacement, forbidden authority or a newer refresh invalidates older results before they can
restore privileged state.

### DA4-P07 — Privileged action contract

Customer creation, invitation creation, reassignment, correction, adjudication and export retain
their current server-confirmed semantics. In particular:

- reassignment shows Tag label/fingerprint and current-to-target change before final confirmation;
- correction and adjudication show selected evidence, before/after values and verbatim reason;
- command IDs and prepared intents survive only the exact confirmation/retry lifecycle;
- cancel discards the prepared intent;
- no optimistic success is shown; and
- conflict, unavailable and authorization failures remain disclosure-safe.

DA4 SHALL not add bulk actions or reduce an explicit confirmation to a single accidental click.

### DA4-P08 — Accessibility, responsive and browser target

The implementation target is WCAG 2.2 AA for every DA4 flow. Semantic landmarks, headings, labels,
instructions, error association, status announcements, keyboard operation, visible focus, logical
focus return and non-color-only meaning are mandatory.

The shell must remain usable from 320 CSS pixels through desktop widths and at 200% zoom. Automated
interaction/accessibility tests cover the supported DOM behavior. Human V5 checks current stable
Safari and Chromium at representative narrow, tablet and desktop widths; Firefox receives an
automated or manual smoke check before closure.

### DA4-P09 — Repository-local design system

DA4 uses a small repository-local Admin design system: semantic color/spacing/type/elevation tokens
and reusable form, button, notice, card, table and confirmation primitives. The visual direction is
calm, high-contrast and operational, preserving the existing TapTim.e green/neutral identity and
using warning/error colors only semantically.

No runtime UI framework, remote font, remote asset, analytics SDK or design-system service is
introduced. Focused test-only accessibility and interaction dependencies are permitted only after
lockfile review.

### DA4-P10 — Browser session, secret and download boundary

Supabase access/refresh tokens remain memory-only. Reload starts signed out. Tokens and privileged
data never enter browser storage, URLs, rendered diagnostics, analytics or application logs.

The Employee invitation secret is shown exactly once, only in the Beschäftigte view, and is
destroyed on dismiss, expiry, navigation away, sign-out, identity/authority change or replacement.
DA4 adds no clipboard/copy control.

CSV remains backend-generated under ADR-0013. The browser may download only the committed response
and must not persist or reconstruct export contents elsewhere.

### DA4-P11 — Explicit exclusions

DA4 excludes:

- analytics, KPI dashboards, charts and aggregate business metrics;
- batch review, bulk correction, generic CRUD and audit-history read models;
- Organization rename/suspension, Customer/Tag update/delete/unassign and Membership role/revoke;
- new authentication persistence, provider signup or account recovery;
- Mobile productization, public website and cross-surface redesign;
- production resources/data, deployment, distribution, signing and hosting;
- payroll, billing, retention or legal/privacy approval; and
- access to `research/`.

### DA4-P12 — Verification and Human acceptance

DA4 is AVS R3 because it changes privileged Administrator, personal-time, session and disclosure
surfaces. Implementation requires V0–V4, independent exact-SHA review and a separately authorized
local Human V5 functional/visual/browser gate using synthetic data.

The V5 gate is not an NFC Physical Gate and requires no Mobile/device/Tag change while DA4 remains
inside this ADR.

## 3. Component boundary

Expected implementation is confined to:

- Admin Web presentation components, shell, navigation, styles and safe view state;
- narrowly required Admin Web capability/coordinator/client pagination and stale-response state;
- Admin Web tests and focused test-only dependencies; and
- truthful ADO/evidence updates.

Backend, schema, neutral contracts, Mobile, CI workflow selection and production configuration are
expected to remain byte-identical. Any discovered need outside this boundary stops implementation
and triggers renewed impact analysis and authority.

## 4. Consequences

### Positive

- every accepted Administrator capability becomes findable and operable without one long page;
- privileged operations retain their exact safety ceremonies;
- loaded versus complete data becomes truthful;
- session replacement and partial failures become explicit; and
- accessibility and browser behavior gain repeatable evidence.

### Negative

- the Admin Web state model and tests become larger;
- memory-only authentication still requires sign-in after reload;
- the fixed 31-day window and absent advanced filters remain visible limitations; and
- professional UI evidence adds a Human browser gate.

## 5. Review triggers

Renewed architecture and Human review are required if implementation needs:

- any backend/schema/API/contract/role/RLS change;
- persistent browser authentication or privileged browser storage;
- new business operations, bulk behavior, totals, analytics or time-range semantics;
- raw NFC payload, clipboard secret handling or relaxed confirmation;
- a runtime UI/analytics dependency; or
- production, deployment, hosting or distribution.

## 6. Current authority

The Human Architect accepted ADR-0015 and DA4-P01–P12 on exact commit
`d9892435acbf7f45a96a9a01c8331afceb65f6f1`, tree
`693bc9a5ca1c0d414ff196f9dfa3352757e45701`, after exact-head CI `30000921765`, attempt 1,
passed 12/12. The Human separately authorized DA4 Workstreams A–D and AVS V0–V4 on that exact
baseline.

Human V5, production, production data, deployment and distribution remain separately unauthorized.
