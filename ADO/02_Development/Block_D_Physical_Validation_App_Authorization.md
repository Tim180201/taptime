# Block D — Physical Validation App Authorization

Status: Implemented, CI Approved and Device-local Physical Validation Passed — Product End-to-End Validation Pending

Date: 2026-07-14

Authority: Human Architect instruction in the active Technical-Lead task

## Objective

Provide an independently installable internal Android APK that closes the tooling gap before the
outstanding physical NFC test. The build must embed its JavaScript bundle, require no Metro server,
use a distinct Android application identifier and present a purpose-built physical validation flow.

## Authorized scope

- EAS internal-distribution profile `physical-validation` with APK output.
- A separate `com.tim180201.mobile.validation` build identity and explicit URI scheme.
- Local validation of two physical tags with ten stable reads each.
- Single-scan, timeout, cancellation and rapid-duplicate behavior through the production NFC adapter.
- Privacy-preserving UI evidence using only a shortened SHA-256 fingerprint.
- Focused UI/UX polish required to make the physical test understandable on a phone.

## Fixed boundaries

- The validation app performs no authentication, server request, assignment or lifecycle decision.
- Raw canonical payloads and raw NFC UIDs do not cross into React state and are not displayed or
  persisted.
- The APK is internal engineering infrastructure, not a production deployment or store release.
- C3, Block E, offline synchronization, production cloud/data and iOS NFC remain unauthorized.
- Automated evidence cannot close DT-016/DT-058. Physical observations must still be entered by the
  Human Architect before any NFC-ready or pilot-ready claim.

## Acceptance

- App configuration fails closed when build and runtime variants disagree.
- Validation and demo variants cannot be selected simultaneously.
- The test flow visibly distinguishes Tag A/Tag B, counts stable reads and flags mismatches.
- Existing Mobile/Core tests, Mobile typecheck and Android export remain green.
- EAS configuration resolves to an APK internal-distribution build with the validation package ID.
