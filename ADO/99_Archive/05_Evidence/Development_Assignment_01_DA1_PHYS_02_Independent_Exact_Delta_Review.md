# Development Assignment 1 — DA1-PHYS-02 Independent Exact-Delta Review

Date: 2026-07-19
Status: **APPROVED — ZERO OPEN P0/P1/P2/P3; DA1-PHYS-02 REPOSITORY FINDING CLOSED**
Review mode: Independent, read-only exact-delta architecture/security/evidence review

## 1. Exact binding

The independent reviewer verified the complete linear chain:

- failed-gate evidence baseline
  `c8295e57a4450710338b37c5dd2a07346269b2b0`, parent
  `fb4a4e4b1c457112372770b9e4e6532f9dca0555`, tree
  `4bc84cb8a4ab1d8e31816dcaef53c70502a9ce2e`;
- focused product correction
  `e17fcb3f1286095c345e6a4ce965790361901099`, parent `c8295e5`, tree
  `44320bc8bb5a25b71300c03d8d50c5a8561ebf0a`;
- initial ADO synchronization
  `f7c66c834590f5ab7af87651bf7537ac1296d9cd`, parent `e17fcb3`, tree
  `1862fd117423b97e607d8fd412bc1a34b9fe0715`;
- cross-identity product hardening
  `869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`, parent `f7c66c8`, tree
  `325fdd5b003e1bccaee15eeac6b0b82826316554`; and
- final reviewed ADO head
  `8d1a0d86539790028526e8d62c1f867c1b68fe57`, parent `869e10f`, tree
  `3464697130900ed55e68acc02e5fb5af41db90a5`.

The complete `c8295e5..8d1a0d8` delta contains exactly 17 files, 515 additions and 75
deletions, limited to the declared Mobile and ADO surfaces. `git diff --check` passed. The
reviewer independently confirmed `HEAD == origin/main` at the reviewed head and a clean tracked
Working Tree. The pre-existing untracked `research/` remained unread, unlisted and unchanged.

The reviewer changed no file and created no commit.

## 2. CI binding

All four GitHub Actions runs were independently retrieved and bound to their exact push heads:

- run `29696949408`, attempt 1, head `e17fcb3`, ten of ten jobs successful;
- run `29697168956`, attempt 1, head `f7c66c8`, ten of ten jobs successful;
- run `29697397146`, attempt 1, head `869e10f`, ten of ten jobs successful; and
- run `29697544630`, attempt 1, head `8d1a0d8`, ten of ten jobs successful.

Each was a push to `main` with no re-run marker.

## 3. Final verdict and finding disposition

Final verdict: **APPROVED**.

There are no open P0, P1, P2 or P3 findings. The `DA1-PHYS-02` repository finding is closed.

The second Gate-A failure remains a truthful failed historical observation. Closing the
repository finding means the independently reviewed correction satisfies its technical,
security and evidence requirements. It neither converts the failed attempt into a pass nor
supplies the still-missing on-device proof.

## 4. Session-restoration assessment

The reviewer confirmed:

- transient provider-refresh unavailability now suspends the provider session rather than
  entering a permanent runtime-failure state;
- suspension clears the access token, provider authority and authenticated snapshot while
  retaining only the stored refresh path;
- `retryContext()` re-enters the existing single-flight refresh capability without requiring an
  access token;
- parallel retry calls share one context flight;
- token revision and generation checks prevent stale refresh completion from overwriting newer
  state; and
- the stale-refresh path waits for the accepted provider-event flight before deciding whether it
  may mutate state.

## 5. Cross-identity and offline-lease assessment

The reviewer adversarially confirmed that `offlineCaptureRestorationAllowed` is established only:

1. during cold-start restoration from existing stored credentials while session state is
   `initializing`; or
2. after full backend-context resolution.

Explicit new sign-in and Employee-enrollment sign-in reset the flag and cannot set it while the
backend context is unavailable. Logout, rejection, storage failure and every complete in-memory
session invalidation clear it. Legitimate suspension of a previously eligible session retains
the flag.

`OfflineCaptureCoordinator` checks both `context_unavailable` and this restoration binding before
calling `readValidOfflineContext()`. A formally valid old lease is therefore not read for an
unbound new identity. Existing owner, installation, time-window and complete-item validation
remain a second independent layer.

The reviewer found no race or provider-event path that bypasses this binding.

## 6. Navigation, disclosure and scheduling assessment

The reviewer confirmed:

- the offline scan shell requires `context_unavailable` plus an independently eligible offline
  coordinator state;
- unrelated `context_unavailable` paths retain the retry screen;
- `ScanScreen` receives only `actor: role | "offline"` and no User, Organization, Membership,
  token or old-owner identifier;
- the user-facing safe shell is labelled `Offline-Erfassung`; and
- foreground/network signals restore the session before scheduling synchronization, including
  error and stale-generation handling.

## 7. Independent verification

The reviewer independently reproduced on reviewed head `8d1a0d8`:

- Mobile 406/406 in 29 files;
- focused auth/offline/navigation/screen regressions 93/93 in four files;
- Mobile tests-inclusive TypeScript check;
- Core 290/290;
- Admin Web 44/44;
- Offline Contract 7/7;
- Administration Contract 4/4; and
- `git diff --check`.

The review sandbox did not provide the Android toolchain, device or host APK path. The reviewer
therefore did not independently reproduce the 690-task native release build, Android
backup-boundary verifier or APK hash/size:

- candidate APK size: 95,418,203 bytes;
- candidate APK SHA-256:
  `0f2e0ea9385dd34ecd3f24da4970d11ab50df77f44debf82d5b0009e7dfa44c5`.

This transparent environment limit was not classified as a finding because the changed behavior
is in the fully regression-tested JavaScript session orchestration, all four exact-head CI runs
are green, the APK was not installed and the required on-device proof remains explicitly assigned
to the next separately authorized complete gate.

## 8. Governance result and next gate

The reviewed governance surfaces truthfully distinguish the failed second run, product correction,
cross-identity hardening, verification and absent physical result. They claim neither a passed
replacement gate nor production, production-data, deployment or distribution authority.

`869e10f..8d1a0d8` changes only the seven declared ADO files. Mobile product code, Admin Web and
the synthetic harness at the reviewed ADO head are therefore identical to the final product
hardening head. The candidate APK remains uninstalled and bound by the hash and size recorded in
Section 7.

With this independent `APPROVED` verdict and zero open P0/P1/P2/P3, the Human Architect may now
separately authorize a third complete fresh Gate-A–E run. Any such run must:

- start at Gate A step 1;
- bind the independently approved product correction, the reviewed and then-current ADO heads,
  exact-head CI and exact APK/Web/harness artifacts;
- reuse no observation from either failed attempt; and
- leave production resources/data, deployment and distribution unauthorized.

This review itself neither starts nor authorizes that run.
