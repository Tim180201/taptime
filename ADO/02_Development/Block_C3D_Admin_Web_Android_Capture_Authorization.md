# Block C3D — Admin Web and Protected Android Capture Authorization

Status: **AUTHORIZED FOR REPOSITORY IMPLEMENTATION**
Authorization Date: 2026-07-15
Exact Baseline: `316f017973fbba18a58c2340c9c79a28f06573e5`
Human Authority: Human Architect explicitly instructed the Technical Lead to start C3D
Owner: Technical Lead
Governing Architecture: Accepted ADR-0011, FB-002 v1.2 and TS-002 v1.3
Codex Effort: Extra High
Production authority: Not granted
C3E authority: Not granted

## 1. Objective

Implement the first real setup user interface without changing C3C's accepted server contract:

1. a responsive Admin Web application that authenticates a current Administrator, reads the safe
   setup projection and creates Customers; and
2. a protected Android Administrator flow that selects a projected Customer, accepts a Tag display
   label, performs native NFC capture and submits the canonical payload directly to C3C.

The slice must make the existing C3B/C3C setup path operational while preserving server-derived
identity, Membership, role and tenant authority.

## 2. Authorized implementation

### Admin Web

- add one dedicated `apps/admin-web` workspace using React and TypeScript;
- use Supabase email/password authentication with an in-memory browser session only: no access or
  refresh token in React state, application storage, URL, logs or rendered output;
- require the C2 `/v1/session` result to be a current Administrator before any setup operation;
- call the existing C3C create-Customer and setup-projection routes only;
- use same-origin `/v1` requests; local development may use a Vite server-side loopback proxy, but
  browser code receives no backend credential or arbitrary API origin selector;
- display Organization name, Customer names/status, Tag labels, assignment state and the explicitly
  labelled 12-character validation fingerprint;
- provide accessible loading, error, empty, validation and sign-out states; and
- never accept, display, copy, persist or transport a raw/canonical NFC payload.

### Protected Android capture

- add a React-facing administration facade containing safe setup state/actions only;
- derive exact Organization, User, Membership and Administrator role from the current private Mobile
  session snapshot;
- let React provide only projected Customer ID and Tag display label;
- perform native capture and C3C provision submission inside one non-React coordinator;
- keep the canonical NFC payload ephemeral inside that coordinator/transport call only;
- generate a cryptographically secure command UUID and submit the current expected Membership ID;
- invalidate or reject work across sign-out, refresh, Membership/Organization/role replacement,
  navigation cancellation and runtime stop;
- never persist the canonical payload or place it in React state, presentation, diagnostics, audit
  copy or retry storage; and
- refresh and present only the safe C3C setup projection/result after success.

## 3. Required architecture and security invariants

1. C3C remains the only setup-write authority; Web/Mobile never call Core administration services.
2. No client chooses Organization, role or Membership. Expected Membership is compare-only and
   derived from the current authenticated session.
3. The Admin Web cannot provision Tags. Web NFC, UID copy/paste and browser pairing tokens are
   prohibited.
4. Android is a supported-client boundary, not device attestation or proof of physical origin.
5. Raw canonical payload lifetime ends when the one coordinator operation settles or is invalidated.
6. Lifecycle scanning and administration capture must not consume the same native capture
   concurrently or submit one capture into both server paths.
7. Exact C3C result vocabulary and disclosure boundaries remain unchanged; provider/database/raw
   transport details are never shown.
8. UI pagination is bounded by the existing global C3C cursor/limit contract.
9. Customer/Tag name validation uses the accepted `taptime-name-v1` contract; no uniqueness is
   inferred from display names.
10. No new database migration, backend route, broad role, generic CRUD or product Business Rule is
    authorized by C3D.

## 4. Mandatory verification

- Admin Web configuration validation, memory-only Auth, authority rejection and sign-out tests;
- Admin Web create/projection response parsing, bounded response, exact-key and safe-error tests;
- responsive production build plus accessibility-oriented rendered-state checks;
- Android administration transport and coordinator success/error/replay/session-replacement tests;
- explicit source guards proving raw payload/token absence from React/Web/persistence/logging;
- native NFC single-owner concurrency, cancellation, timeout and runtime-stop tests;
- complete Mobile, backend API, C3C administration-contract and workspace regression checks;
- Android product bundle/export; and
- exact-head GitHub CI after Technical-Lead approval.

## 5. Human/physical closure gate

Before C3D closure, the Human Architect must complete one controlled sequence on the approved
environment:

1. bootstrap or reuse the synthetic Organization/Administrator;
2. sign in to Admin Web and create a Customer;
3. observe the safe setup projection without raw UID disclosure;
4. sign in as the same Administrator on Android;
5. select that Customer, enter a Tag label and capture/register/assign one physical NTAG213;
6. confirm the safe label, fingerprint and assignment state in Web/Android; and
7. use the same Administrator product flow to scan Start then Stop.

This gate proves only the recorded local/synthetic Web plus Galaxy A33/Android 15/NTAG213 setup
flow. It is not production deployment, public hosting, Store distribution, broad browser/device
compatibility or production-personal-data authority.

## 6. Explicit non-goals

- C3E Employee identity provisioning, invitations, Membership CRUD, role changes or reassignment;
- implicit Tag reassignment, delete/update, Organization suspension or generic Admin CRUD;
- Web/iOS NFC, NDEF writing, raw UID copy/paste or pairing-token fallback;
- durable raw-payload retry, background provisioning or full offline setup;
- production Supabase/Node/database resources, monitoring, backup, IAM or personal data;
- Store/pilot distribution, legal/commercial readiness, billing, support or final UI/UX
  productization; and
- any use of untracked `research/`.

## 7. Pre-implementation Technical-Lead review

The Technical Lead reviewed the accepted C3A contract, C3C routes/results, current private Mobile
session/transport composition and native NFC lifecycle. The review identified native-capture
cross-use, browser-token persistence, session replacement and raw-payload lifetime as the principal
C3D risks. Sections 2–4 make each one an explicit fail-closed design/test gate.

Pre-implementation verdict: **APPROVED FOR THE AUTHORIZED C3D REPOSITORY SLICE**, with no open
P0/P1/P2/P3. Independent final implementation review and the Human physical gate remain mandatory
before closure.
