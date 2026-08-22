# Block E1 — Independent Architecture and Security Review

Status: APPROVED WITH NON-BLOCKING FINDINGS — All Findings Dispositioned
Review Date: 2026-07-14
Independent Reviewer: Claude
Reviewed Range: `9b2c8a5..dea043f`
Corrective Commit: `2ff39915004cc27d03e8746a4a80d12f57391487`

## 1. Review basis and independent verdict

The independent reviewer inspected the authorized baseline, the two E1 commits `e0f2898` and
`dea043f`, all changed source/test/governance files, related architecture/roadmap artifacts, strict
JSON and transport contracts, schema migration inventory and CI definition. `research/` was neither
read nor changed.

The reviewer independently reproduced the then-current Core 288/288 and Mobile 269/269 suites,
tests-inclusive TypeScript checks, Core build, clean diff and migration inventory `001`–`005`.
Backend bundles and Android export were not reproducible in that review sandbox because its Linux
environment contained macOS-arm64 binaries. GitHub was not authenticated there, so remote CI was
explicitly left unverified rather than copied from repository claims.

Final independent verdict: **APPROVED WITH NON-BLOCKING FINDINGS** — five P3 findings, no P0/P1/P2.

## 2. Confirmed architecture and security result

The reviewer confirmed that E1 persists only exact User/Organization binding plus the immutable
server-ready lifecycle command, writes it before network submission, replays exact identifiers,
timestamp and `attemptNumber = 1`, clears only a matching record after a definitive result, blocks
foreign-identity disclosure/replay and leaves C2/B6/Core as the only lifecycle authority. No token,
raw UID payload, client BusinessEngine decision, server decision or database detail enters the
record. The legacy client-decision queue is absent from the Mobile product graph.

## 3. Findings and Technical Lead disposition

### E1-R-01 — P3 — stale start continuation

**Finding:** `ProductScanOrchestrator.start()` originally checked only `started` after its awaited
outbox read. `start → stop → start` could therefore let the first continuation subscribe after the
second start and leak or overwrite session-listener ownership.

**Disposition: Accepted and corrected.** A monotonic start generation now guards both successful and
failed read continuations. Regression cases cover late success and late failure, listener count,
current scan behavior and cleanup. The owning product runtime received the same generation discipline
for delayed scan/session startup and stale rejections; React cleanup invalidates the obsolete failure
observer. A targeted re-audit found no remaining lifecycle-race finding.

### E1-R-02 — P3 — non-atomic SecureStore occupancy guard

**Finding:** SecureStore offers no compare-and-swap; two simultaneous adapter instances could both
observe an empty key before writing.

**Disposition: Accepted with explicit boundary and defense in depth.** Every composite read/write/
clear operation is serialized through one module-level operation chain across adapter instances in
the supported JavaScript runtime. A concurrent two-adapter regression proves exactly one write and
one occupied rejection. No read-back is misrepresented as CAS. Cross-process CAS remains unsupported;
the product composition owns one runtime and does not claim multi-process outbox safety.

### E1-R-03 — P3 — platform semantics and value size

**Finding:** `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is iOS Keychain-specific and does not describe Android
protection. The former 4-KiB cap also exceeded the historical ~2-KiB SecureStore guidance, although
real records were about 0.6 KiB.

**Disposition: Accepted and corrected.** Code and current evidence distinguish iOS Keychain
accessibility from Android's expo-secure-store Keystore-backed encrypted storage. The hard read/write
cap is now 2 KiB with regression coverage. No claim treats the iOS option as Android enforcement.
The verification basis is the installed expo-secure-store package plus Expo's official SecureStore
documentation: <https://docs.expo.dev/versions/latest/sdk/securestore/>.

### E1-R-04 — P3 — persistent storage-failure guidance

**Finding:** The old copy implied restart would repair every storage error, while an invalid record
correctly remains fail-closed without auto-deletion.

**Disposition: Accepted and corrected.** UI copy permits one restart attempt without promising
success, then directs the user to support and warns against deleting the app or its data. A regression
protects those statements. An actual authorized reconciliation workflow remains an explicit E2+ gate.

### E1-R-05 — P3 — final-HEAD CI evidence gap

**Finding:** Repository evidence named run `29340810743` for `e0f2898`, while the review request also
named run `29341021239` for final reviewed HEAD `dea043f`; the latter was not yet recorded and could
not be checked from the unauthenticated review environment.

**Disposition: Accepted and closed.** Authenticated Technical-Lead verification binds run
`29341021239` exactly to `dea043fc015f540fa8a2dc20ba3d581e84ec6c50` with all eight jobs successful.
The corrective commit `2ff3991` independently passed all eight jobs in run `29343959552`.

## 4. Corrective verification

- Mobile: 279/279 tests in 18 files.
- Core: 288/288 tests in 43 files.
- Root tests-inclusive TypeScript check: passed.
- Complete workspace build: passed.
- Android production export: passed with 782 bundled modules.
- `git diff --check`: passed.
- Migration inventory: exactly `001`–`005`; no SQL change.
- GitHub Actions `29343959552`: eight of eight jobs passed for corrective commit `2ff3991`.

## 5. Remaining accepted limits

E1 remains one same-identity record after live scan-context resolution. It does not provide a
multi-event offline queue, cached assignment authority, scheduler/backoff, background sync,
cross-process CAS or support-side reconciliation implementation. Physical E1 restart recovery remains
a later device gate. None of these limits weakens the independent approval of the authorized E1 slice.
