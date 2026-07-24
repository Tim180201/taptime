# ADR-0016: Professional Mobile Productization

- Status: **ADO-ONLY CANDIDATE — INDEPENDENT REVIEW REQUIRED; EXECUTABLE IMPLEMENTATION UNAUTHORIZED**
- Date: 2026-07-24
- Candidate baseline commit: `4bfbf8eb39e46b073b18c8d7ab502add44ad47f0`
- Candidate baseline tree: `17b7c4a6a8ec1bbdce9de6c99d0863acf6c47854`
- Baseline CI: GitHub Actions `30093494886`, attempt 1, 12/12 successful
- Owner: Technical Lead
- Decision authority: Human Architect
- Roadmap: Development Assignment 5; Mobile portions of DT-090, DT-093–DT-096, DT-098 and DT-103
- Related: Product Vision, Product Principles, ADR-0003, ADR-0007–ADR-0009, ADR-0012,
  ADR-0014, ADR-0015, AVS-001
- Proposed implementation risk: AVS-001 **R3**

## 1. Context

The current Android product path already has real email/password authentication, authoritative
Membership resolution, native NFC capture, server-canonical lifecycle decisions, an encrypted
offline FIFO, background/foreground synchronization, Employee enrollment and protected
Administrator Tag setup.

Its React surface is still deliberately minimal:

- state switching is concentrated in `AppNavigator`;
- Login, enrollment, scan and setup use separate local styling rather than a coherent Mobile
  product system;
- the current scan screen shows only the latest outcome and aggregate queue state;
- there is no professional own-time view or separate synchronization view; and
- accessibility has focused labels but no complete navigation, screen-reader, scaling or Human
  acceptance matrix.

ADR-0003 already places an Employee own-time overview in v1. ADR-0008 explicitly grants current
Employees and Administrators access to their own TimeEntries and own synchronization state while
denying Employee Organization-wide time access. DA3 later made append-only corrections and
recovered records part of the effective time truth. The existing raw Employee RLS read omits that
effective overlay, while the existing effective reader is Administrator-only, Organization-wide
and exposes privileged correction metadata. Neither is a safe Mobile self-read boundary.

DA4's still-open Human browser gate does not block ADO-only DA5 preparation or independently
approved repository work. It remains a separate gate and receives no evidence from DA5.

## 2. Decision candidate

### DA5-P01 — Assignment and Roadmap boundary

DA5 SHALL productize the existing Android Mobile application and complete the Mobile-specific
parts of Roadmap DT-090, DT-093–DT-096, DT-098 and DT-103.

It may add the narrow backend read capability required for the already accepted own-time feature.
It SHALL NOT add a new lifecycle, correction, export, Membership, setup or authentication
capability.

### DA5-P02 — Server authority and One Tap remain unchanged

The server remains the only authority for Membership, Organization, Assignment and
Start/Stop/duplicate/rejection decisions. A Mobile scan is still one trigger whose meaning is
decided by the existing Business Engine.

DA5 adds no manual Start or Stop command. An active-session surface may explain that another scan
is required, but it may only start the existing NFC capture path. Pending, offline or local state
must never be presented as a server-confirmed Start or Stop.

### DA5-P03 — Role-safe Mobile information architecture

After authoritative session resolution, the primary product destinations SHALL be:

- **Erfassen** — the existing NFC scan path and latest truthful outcome;
- **Meine Zeiten** — the current actor's effective active record and bounded stopped history;
- **Synchronisierung** — safe local queue/review/protection state and the existing unchanged-evidence
  retry action; and
- **NFC-Einrichtung** — only for a current Administrator, preserving the existing protected Android
  setup capability.

The authority-free enrollment shell remains separate. The offline-capture shell exposes only
Erfassen and safe Synchronization status; it cannot expose server time history or Administrator
setup. Navigation state is memory-only and carries no credential, raw NFC value or authority.

### DA5-P04 — Dedicated effective own-time contract

DA5 SHALL introduce one dedicated authenticated read route:

```text
POST /v1/mobile/own-time/query
```

Its exact closed request contains only:

```text
expectedMembershipId, limit, cursor
```

`expectedMembershipId` is compare-only and comes from the private current session. `limit` is
1–20. `cursor` is `null` or an opaque versioned cursor of at most 256 ASCII characters.

One read-only transaction returns:

- `activeRecord`: zero or one current-Organization/current-User effective active record,
  independently of the history window; and
- `records`: newest-first effective stopped records whose effective start is within the rolling
  server-time 31-day window, plus `nextCursor` and the server window bounds.

Each safe record contains only:

```text
timeRecordId, customerDisplayName, status, startedAt, stoppedAt
```

The opaque `timeRecordId` is presentation/reconciliation identity, never authority. The response
omits Organization, User, Membership and Customer IDs; source/revision/overlap, reasons, actors,
audit/review evidence, WorkEvent/Receipt details and NFC data. Duration is derived for display and
is never stored or transported as an independent fact.

Corrected canonical and recovered records use ADR-0014 effective values. Recovered records remain
stopped. The existing database invariant is stated precisely: at most one `started` TimeEntry per
`(organization_id, user_id)`. DA5 makes no global cross-Organization active-record claim.

### DA5-P05 — Self-only authority and isolated capability

Every query SHALL verify the access token and resolve the exact current IdentityBinding, User,
Organization, Membership and role in the same read-only database transaction. The server derives
Organization/User/role; no request may select any of them.

Both existing v1 roles may read only their own effective time. A stale, absent, revoked or
mismatched Membership fails closed. The query predicate includes the exact server-resolved
Organization and User.

Migration `013` SHALL add a dedicated `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` own-time reader
capability and narrowly owned `SECURITY DEFINER` function. The runtime receives execute-only access
through a distinct validated pool. It gains no direct revision/audit read, Administrator function,
broad table grant or write capability. Existing raw self-RLS and Administrator DA3 functions are
not broadened or reused as the Mobile boundary.

### DA5-P06 — Active-session and own-time truth

The active-session card is derived only from `activeRecord`, never from the bounded history page,
the last scan result or local queue state. It shows Customer, server-confirmed start time and the
instruction to scan the relevant Tag again; it does not predict that a later scan will necessarily
stop.

History shows the rolling 31-day effective stopped records newest first, distinguishes loaded from
complete state and offers deterministic load-more while `nextCursor` is present. Corrections or
recovered provenance are not exposed in DA5; the Employee sees the current effective result.
Totals, overtime, payroll, rounding, approval and editable time are excluded.

### DA5-P07 — Synchronization and protected-evidence truth

DA5 productizes the existing ADR-0012/DA3 state vocabulary without changing it:

- locally saved and pending evidence remains visibly unconfirmed;
- synchronization progress and safe queue count remain explicit;
- `review_pending`, protected storage and identity-mismatch states retain their fail-closed copy;
- manual retry can only resend the exact unchanged queue head through the existing scheduler; and
- no UI may delete, reorder, edit, rebind, bypass or mark evidence successful.

The UI SHALL NOT promise a background completion time.

### DA5-P08 — Mobile-local design and German presentation

DA5 uses a small repository-local Mobile design system with semantic color, spacing, type, radius
and state tokens plus reusable screen, card, notice, field, button, navigation and empty/error
primitives. It introduces no runtime UI framework, remote font, remote asset, analytics SDK or
design-system service.

The v1 Mobile language/locale is German (`de-DE`). Human-visible timestamps use the valid device
IANA timezone and visibly identify the zone or offset; invalid/unavailable timezone information
falls back to UTC. Canonical API timestamps remain UTC.

The design system is Mobile-local. It may preserve the accepted green/neutral TapTim.e direction
but does not silently create a shared cross-surface design-system authority or redesign Admin Web.

### DA5-P09 — Native accessibility and responsive target

Every DA5 flow SHALL provide native semantic roles/labels, logical screen-reader order, live status
announcements, non-color-only meaning, visible focus where applicable, at least 48-by-48 dp touch
targets, text scaling without clipped essential content and contrast equivalent to WCAG 2.2 AA.
Reduced-motion settings are respected; essential meaning never depends on animation.

The target is Android portrait usability from 320 dp through the supported tablet width and at
200% font scaling. Automated component/presenter checks are necessary but do not replace the
separately authorized Human Android V5.

### DA5-P10 — Session, secret and capture ownership

Existing security boundaries remain unchanged:

- access tokens and passwords remain memory/private-auth only;
- only the rotating refresh token uses SecureStore;
- sign-out/session replacement invalidates stale screen requests and clears privileged presentation;
- the invitation secret remains volatile and never enters storage, logs, URLs or clipboard
  automation;
- canonical NFC payload lifetime remains inside the protected coordinator/transport boundary; and
- lifecycle scan and Administrator capture retain exclusive native NFC ownership and cancellation.

Own-time and synchronization presentation components receive narrow state/actions only. They do not
receive tokens, pools, raw transport or database handles.

### DA5-P11 — Explicit exclusions

DA5 excludes:

- manual time entry, manual Start/Stop, correction, export, team/Organization time and audit views;
- totals, overtime, payroll, rounding, breaks, approvals, scheduling or analytics;
- new Customer/Tag/Membership operations, auth providers, signup, reset or identity linking;
- remote deletion/repair/rebinding of local evidence or changed offline policy;
- iOS/Web NFC, broad device support claims or a new trigger type;
- DA6 production-like operations/observability/backup, DA7 signing/distribution and DA8 website;
- production resources/data, deployment, distribution, pilot operations or legal/privacy approval;
  and
- access to `research/`.

### DA5-P12 — Verification and Human acceptance

DA5 is R3 because it adds a tenant/self-data capability and changes Mobile authentication,
personal-time, NFC, offline/protected-state and accessibility surfaces.

Implementation requires AVS V0–V4, direct PostgreSQL role/RLS/function-owner and tenant-negative
tests, complete affected contract/backend/API/Mobile verification, one complete local candidate
regression, exact-head CI and independent exact-SHA implementation review with zero open P0–P3.

A fresh synthetic Android Human V5 on an exact reviewed artifact is separately authorized only
after V0–V4. It must cover authentication/enrollment, role-safe navigation, own-time/effective
active/history truth, online and offline Scan outcomes, synchronization/protected states,
Administrator setup preservation, TalkBack/text scaling/layout, lifecycle cancellation and complete
cleanup. It remains a Human/hardware stop.

## 3. Expected component boundary

Expected implementation is limited to:

- one neutral own-time contract package;
- migration `013` plus isolated own-time role/function tests;
- one own-time backend coordinator/pool and the exact API route;
- Mobile runtime capability/coordinator, product shell, screens, local design primitives and tests;
- narrowly necessary CI selection/commands for the new workspaces; and
- concise evidence/status synchronization where repository truth materially changes.

Core BusinessEngine, existing lifecycle/offline/setup/enrollment contracts, migrations `001`–`012`,
Admin Web Product behavior and all production/deployment configuration remain unchanged.

## 4. Review triggers

Renewed architecture and Human review are required before:

- any Employee read beyond the exact current actor or effective time result;
- any write, correction, export, manual lifecycle action or cross-Organization historical access;
- any new duration, overlap, payroll, rounding or active-session Business Rule;
- any weakened offline/protected-state, credential, NFC ownership or session boundary;
- any runtime UI/analytics dependency or shared cross-surface design-system authority; or
- any production, deployment, signing or distribution action.

## 5. Current authority

The Human Architect instructed the Technical Lead to continue the Roadmap autonomously through
independently approved work and to stop at the next Human/hardware gate. This document is the
Technical Lead's exact ADO-only candidate on the verified baseline above.

Before an independent read-only pre-implementation review returns `APPROVED` with zero open P0–P3,
no source, schema, dependency, workflow, build or executable change is authorized. Human V5,
production, production data, deployment and distribution remain separately unauthorized.
