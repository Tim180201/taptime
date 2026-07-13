# Tech Stack

Status: Decided — see ADR-0007 and ADR-0008

## Current Position

The TapTim.e technology platform baseline is decided and Approved. This file is a navigation pointer, not a duplicate source of technical knowledge.

Authoritative sources: `ADO/01_Architecture/ADR/ADR-0007-technology-platform-baseline.md` and `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

ADR-0007 defines the mobile-first platform baseline (React Native / Expo, native NFC capability, local offline-capable persistence, explicit synchronization), the backend baseline (managed authentication, cloud-hosted persistence, explicit synchronization) and the platform boundaries that keep domain logic independent from UI, NFC libraries and persistence APIs.

ADR-0008 refines the backend baseline to Supabase-managed PostgreSQL/Auth with a managed Node.js transactional API, pooled-schema tenant isolation, RLS and phased async/backend implementation gates.

## Reference Evidence

`frogs-zeiterfassung` (React Native, Expo, Firebase Authentication, Firebase Firestore, `react-native-nfc-manager`) is retained as technical reference evidence that informed ADR-0007. It is not a source code baseline; see the root `README.md` Reference Projects section.

## Where to Look Next

- Platform decision and rationale: ADR-0007
- Technical architecture responsibilities and layering: `ADO/01_Architecture/Technical_Architecture_Profile.md` (TTAP-001)
- Feature-level implementation detail: `ADO/01_Architecture/Technical_Specifications/`
- Developer-facing implementation guidance: `ADO/01_Architecture/Developer_Implementation_Manual/`

## Change Rule

Do not duplicate ADR-0007 content here. If the platform baseline changes, update ADR-0007 (or supersede it with a new ADR) through the standard engineering workflow, and update this pointer only if the referenced document paths change.
