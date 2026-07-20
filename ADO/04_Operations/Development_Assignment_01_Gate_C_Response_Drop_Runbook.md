# Development Assignment 1 — Gate-C Response-Drop Runbook

Status: Local synthetic operator procedure; no Human Physical Gate is authorized by this document
Owner: Technical Lead
Approval Authority for any later physical run: Human Architect

## 1. Purpose and authority boundary

This runbook preserves the disclosure-safe local fault used to prove Development Assignment 1
Gate C: the server commits one exact offline lifecycle event, Mobile does not receive that response,
and later automatic retry/reconciliation returns the prior durable result without duplicate
WorkEvent, SyncReceipt, CanonicalDecision or TimeEntry mutation.

The helper is strictly non-production:

- listener: `127.0.0.1:3001`;
- upstream: `127.0.0.1:3000`;
- intercepted route: exact `POST /v1/lifecycle-events/offline`;
- transport: exactly one authorized Android device whose `adb devices -l` record proves a USB
  transport; TCP/Wireless ADB and emulators are rejected;
- data: synthetic `.invalid` identities and approved synthetic NFC Tags only.

It does not authorize a Human Physical Gate, production resources/data, deployment or distribution.
A later gate requires its own Human-Architect authorization bound to independently approved exact
commits, trees, CI and candidate artifacts.

## 2. Safety properties

The helper:

1. accepts no configurable host, upstream URL or intercepted path;
2. starts the loopback listener before changing the device mapping;
3. requires exactly one authorized USB device and the existing exact Auth/API mappings
   `54321 -> 54321` and `3000 -> 3000`;
4. changes only the API mapping to `3000 -> 3001` and preserves Auth and unrelated mappings;
5. forwards ordinary pre-interception traffic only to the fixed loopback upstream;
6. claims exactly the first exact offline-event request;
7. blocks all later requests as soon as that request is claimed;
8. drains the upstream response and requires a complete HTTP 200 before declaring a successful
   drop; this status maps only to the API's durable `synchronized` result;
9. sends none of that response to Mobile and destroys the Mobile connection only after upstream
   completion;
10. never rearms after success or failure;
11. restores only an owned `3000 -> 3001` mapping or the exact remove/add crash gap with no API
    mapping to `3000 -> 3000`; and
12. never prints request/response bodies, headers, tokens, device serials, NFC data or internal
   identifiers.

An upstream abort, truncated response, timeout, non-200 result, unexpected mapping or cleanup
failure invalidates the observation. A fixed failure event is evidence to abort, not permission to
retry the same run.

## 3. Preconditions

Do not start until all are true:

1. a complete fresh Gate A–E run has been separately authorized;
2. exact product, ADO, CI, APK, Web and harness bindings have been verified;
3. the strictly local synthetic Auth/API/PostgreSQL harness is ready on ports 54321/3000;
4. the exact candidate APK is installed on exactly one authorized USB device;
5. `adb reverse --list` contains the approved direct Auth/API mappings;
6. Gate A and Gate B have passed afresh in that same authorized run;
7. Mobile is authenticated as the synthetic Employee, its encrypted queue is empty and no unrelated
   request is intentionally in flight; and
8. only disclosure-safe aggregate evidence is being recorded.

Never paste a password, token, raw UID/canonical payload, provider subject, device serial, local
encryption key, internal database identifier or real-person data into a command, log or ADO file.

## 4. Build and arm

Build the exact reviewed harness:

```bash
npm run build --workspace=@taptime/synthetic-android-e2e
```

Start the one-shot helper:

```bash
npm run gate-c:response-drop --workspace=@taptime/synthetic-android-e2e
```

Proceed only after both fixed events appear:

```text
synthetic_gate_c_event=gate_c_proxy_armed
synthetic_gate_c_event=gate_c_transport_armed
```

The final readiness line is:

```text
synthetic_gate_c_response_drop_ready
```

The process accepts only `status`, `restore` and `stop`. Do not manually change reverse mappings
while it owns the API mapping.

## 5. Execute the lost-response observation

1. Capture exactly one event through the approved physical NFC flow.
2. Wait for:

   ```text
   synthetic_gate_c_event=gate_c_response_dropped
   ```

3. Run `status`. The required safe state is:

   ```text
   synthetic_gate_c_response_drop_status=armed/blocked
   ```

4. Confirm Mobile truthfully retains exactly one pending operation.
5. Use only the harness's sanitized aggregate `status` evidence to confirm the server contains
   exactly one new WorkEvent, SyncReceipt and CanonicalDecision plus only the expected TimeEntry
   mutation.
6. Confirm no later request reached the upstream while the helper remained blocked.

If `gate_c_response_drop_failed`, `operator_command_failed`, a startup/cleanup failure, no fixed
drop event or any unexpected Mobile/server state occurs, enter `restore` if possible, perform the
abort cleanup in Section 7 and invalidate the entire physical run.

## 6. Restore and prove idempotency

Enter:

```text
restore
```

For a valid completed drop, require:

```text
synthetic_gate_c_event=gate_c_transport_restored
synthetic_gate_c_response_drop_stopped
```

The helper verifies direct `3000 -> 3000` restoration before closing the proxy. Restoration after
an incomplete or aborted observation instead emits
`gate_c_transport_restored_after_abort` and must not be counted as a Gate-C pass.

Without pressing a per-event retry button, use only the authorized foreground/network trigger and
allow the normal scheduler to retry/reconcile. Confirm:

- the pending count reaches zero only after the exact durable acknowledgement;
- the prior result is returned idempotently;
- the server counts do not gain a second WorkEvent, SyncReceipt, CanonicalDecision or TimeEntry
  mutation; and
- no later FIFO item bypasses the recovered predecessor.

Record only aggregate counts and safe UI/operator states.

## 7. Abort, crash recovery and final cleanup

If the interactive process is lost, run:

```bash
npm run gate-c:transport-restore --workspace=@taptime/synthetic-android-e2e
```

The emergency helper accepts only the owned proxy mapping, the already restored direct mapping or
the exact temporarily missing API mapping that can result if the helper process dies between its
scoped remove and add commands. In that last case it recreates only `3000 -> 3000`. Any foreign or
duplicate API mapping remains fail-closed.

Only these fixed successful results are acceptable:

```text
synthetic_gate_c_emergency_restore=restored
synthetic_gate_c_emergency_restore=already_direct
```

An emergency-restore failure requires manual Technical-Lead investigation. Do not overwrite an
unexpected mapping and do not use `adb reverse --remove-all`.

At final gate cleanup:

1. sign out Mobile and Admin Web;
2. stop the helper or verify it already stopped after `restore`;
3. verify the API mapping is direct before invoking the standard scoped disconnect helper;
4. stop the synthetic harness normally;
5. run the standard Mobile synthetic disconnect helper;
6. confirm the synthetic schema, generated roles and disposable database are removed;
7. confirm ports 3000, 3001, 5173 and 54321 have no listener;
8. confirm the reverse table has no approved test mappings;
9. uninstall the synthetic package and clear the clipboard; and
10. record only the disclosure-safe cleanup result.

No partial observation from a failed or interrupted run may be reused.
