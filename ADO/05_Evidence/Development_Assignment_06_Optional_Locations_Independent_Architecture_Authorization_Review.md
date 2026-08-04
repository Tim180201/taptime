# Development Assignment 6 — Optional Locations Independent Architecture/Authorization Review

- Status: **APPROVED FOR ADO-ONLY CANDIDATE PUBLICATION**
- Date: 2026-08-04
- Reviewer: independent `taptime_reviewer`, read-only
- Preparation baseline commit: `90a5d1a3c90ee81aaeee335edd74a88c8fc904de`
- Preparation baseline tree: `38d025a134cffe305017a1c845930d80115c1d3d`
- Corrected candidate Full-Index-Diff SHA-256 including new ADR-0020:
  `e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de`
- Final verdict: **APPROVED**
- Open findings: **zero P0–P3**

## Reviewed candidate binding

The independent read-only re-review was bound to baseline/HEAD/local `origin/main`/live remote
`90a5d1a3c90ee81aaeee335edd74a88c8fc904de` and tree
`38d025a134cffe305017a1c845930d80115c1d3d`. The reviewed uncommitted candidate contained exactly
six tracked ADO modifications plus one new ADO file, with a combined Full-Index-Diff of
**+766/-23** and SHA-256
`e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de`:

1. `ADO/01_Architecture/ADR/ADR-0020-optional-locations-and-delegated-administration.md` (new);
2. `ADO/01_Architecture/ADR/ADR-0018-production-like-platform-and-operational-readiness.md`;
3. `ADO/02_Development/Development_Assignment_06_Production_Like_Platform_Authorization.md`;
4. `ADO/00_Core/Project_Status.md`;
5. `ADO/00_Core/Decision_Log.md`;
6. `ADO/00_Core/Risk_Register.md`; and
7. `ADO/README.md`.

No candidate commit or candidate tree existed for this uncommitted seven-file delta. The diff
digest, baseline and exact file scope are therefore the review binding.

## Review history and P1 disposition

Review Round 1 covered predecessor diff SHA-256
`475edf4654fc23bd33e1e0c8db1306f98a0ec2cc83bf4fe1a00587cd66e49e4f` and returned
`CHANGES REQUIRED` with exactly one P1: the candidate had no normative Location-assignment model.

The Human Architect then made this exact binding disposition:

> Ich akzeptiere die verpflichtende Hauptstandortzuordnung und die beschriebenen zusätzlichen
> Arbeits- und Verwaltungsstandorte für ADR-0020.

The corrected seven-file candidate integrates that decision without treating the rest of
ADR-0020 or DA6 as Human-accepted. The independent re-review confirmed that the R1 P1 is closed.
The predecessor verdict remains historical truth and is not rewritten as an approval.

## Architecture and authorization result

The independent reviewer confirmed that the corrected candidate consistently preserves:

- Organization as the hard tenant boundary and Location only as a subordinate scope;
- unchanged current behavior and no assignment requirement while the optional feature is
  effectively off;
- inactive Administrator setup plus atomic, fail-closed activation only after complete unique
  active Home and resource/target/assignment bindings;
- exactly one Home Location per active Membership, including Administrators and Location
  Managers, without narrowing Organization-wide Administrator authority;
- separate additional Work Location Grants and Management Location Grants with no inheritance or
  substitution between work and delegated-management authority;
- one immutable, server-derived accepted Work Location for each accepted WorkEvent/TimeRecord,
  without a GPS, geolocation or physical-presence claim;
- current-resource scope for resource operations, current-Home/minimal-operation projection for
  Employees and immutable accepted-Work-Location scope for records, corrections, reviews and
  exports;
- current Management Grants for every affected Location, own-time prohibition and reject-all
  behavior for mixed or ambiguous scope;
- future-only assignment/grant effects, immutable accepted history and immediate removal of new
  and historical privileged Manager access after revocation;
- immediate removal of Location/delegated authority on deactivation, retained data/history and
  complete validation on reactivation;
- append-only, disclosure-safe setup, transition, grant, revocation and privileged-action audit;
- fail-closed Cross-Location lifecycle behavior unless and until a later explicit Human decision
  authorizes an exact operation; and
- the authority/status boundary, the historical earlier DA6 review boundary and no impact on the
  current DA5 source, artifacts or hardware gate.

No open P0, P1, P2 or P3 finding remains against the exact reviewed seven-file candidate.

## Verification evidence

The candidate is AVS-001 **R0** because every reviewed change is non-executable ADO Markdown and
no source, schema, migration, dependency, lockfile, compiler/release configuration, workflow,
verification script or artifact input changed.

AVS **V0** completed for the exact reviewed scope, including exact baseline/tree/remote equality,
tracked and new-file scope, whitespace and diff integrity, Markdown EOF/fence/heading structure,
ADO references, decision/risk row integrity, review-status consistency and the explicit
partial-Human-acceptance/no-implementation boundary.

Product tests, Typechecks, builds, CI, provisioning and hardware were not run. They are neither
applicable nor authorized for this ADO-only R0 review. The reviewer changed no file and performed
no implementation, installation, ADB, hardware, system, production, deployment or distribution
action.

## Publication and authority boundary

This review approves publication of the exact ADO-only seven-file candidate identified by the
Full-Index-Diff digest above. It closes the R1 P1 review finding. It does **not** Human-accept the
remaining ADR-0020/DA6 values and does not authorize Product implementation, schema changes,
provider/cloud resources, costs, legal conclusions, production data, deployment, distribution or
hardware activity.

Adding this archive and synchronizing review/status references creates an eight-file ADO-only R0
closure delta. That closure delta is not part of the reviewed seven-file candidate and changes no
decision value. Its V0 evidence must be reported separately.

No publication commit, publication tree or exact-head CI exists for the uncommitted closure state.
This file does not self-certify its containing commit, tree, remote equality or CI. Those bindings
remain external publication checks. The next Product/architecture gate is exact Human disposition
of the remaining ADR-0020/DA6 candidate values; any later implementation still requires a
separate exact R3 authorization.
