import Foundation

@MainActor final class MemoryStand: LockStandStorage {
  var stand: LockStand?
  func read() throws -> LockStand? { stand }
  func write(_ value: LockStand?) throws { stand = value }
}
@MainActor final class MemoryKey: LockCapabilityStorage {
  var id: String?; var value: String?; var writes = 0; var deletes = 0
  func read(id: String) throws -> String? { id == self.id ? value : nil }
  func replace(id: String, capability: String) throws { writes += 1; self.id = id; value = capability }
  func remove() throws { deletes += 1; id = nil; value = nil }
}
@main struct LockTests {
  @MainActor static func main() async throws {
    let data = Data("""
    {"timeEntryId":"60000000-0000-4000-8000-000000000001","status":"running","startedAt":"2026-10-21T06:00:00.000Z","stoppedAt":null,"breakStartedAt":null,"asOf":"2026-10-21T07:00:00.000Z","workDurationSeconds":3960,"breakDurationSeconds":0,"target":{"targetType":"customer","targetId":"20000000-0000-4000-8000-000000000001","displayName":"Testziel"}}
    """.utf8)
    let json = LockLogic.object(data)!, state = LockState.parse(json)!
    var pausedJSON = json; pausedJSON["status"] = "paused"; pausedJSON["breakStartedAt"] = "2026-10-21T06:30:00.000Z"
    let paused = LockState.parse(pausedJSON)!
    var stoppedJSON = json; stoppedJSON["status"] = "stopped"; stoppedJSON["stoppedAt"] = state.asOf
    let stopped = LockState.parse(stoppedJSON)!
    precondition(LockLogic.subtitle(paused, .STATE) == "Pause seit 08:30")
    precondition(LockLogic.duration(3960) == "1:06 h")
    precondition(LockLogic.title(stopped, .STATE) == "Zeit beendet · 1:06 h")
    precondition(LockLogic.subtitle(state, .STATE) == "Läuft seit 08:00")
    precondition(LockLogic.berlin("2026-10-25T01:30:00.000Z") == "02:30")
    precondition(LockLogic.actions(state, .STATE) == ["pause", "stop"])
    precondition(LockLogic.actions(paused, .STATE) == ["resume", "stop"])
    precondition(LockLogic.actions(stopped, .STATE).isEmpty)
    for display in [LockDisplay.TRANSFERRING, .SENDING, .NOT_SENT, .UNCONFIRMED, .OPEN_APP, .UPDATE_APP] {
      precondition(!LockLogic.showsDuration(state, display) && !LockLogic.showsDuration(paused, display))
    }
    precondition(LockLogic.showsDuration(state, .STATE) && LockLogic.showsDuration(paused, .STATE))
    precondition(!LockLogic.showsDuration(stopped, .STATE))
    precondition(LockLogic.actions(paused, .TRANSFERRING).isEmpty)
    precondition(["pause", "resume", "stop", "retry"].map(LockLogic.label) == ["Pause starten", "Pause beenden", "Zeit beenden", "Erneut senden"])
    precondition([LockDisplay.TRANSFERRING, .SENDING, .NOT_SENT, .UNCONFIRMED, .OPEN_APP, .UPDATE_APP].map(LockLogic.message) ==
      ["Wird übertragen …", "Wird gesendet …", "Nicht gesendet · kein Netz", "Noch nicht bestätigt", "Bitte App öffnen", "Bitte App aktualisieren"])
    for code in [400, 403, 409, 429] { precondition(LockLogic.outcome(.init(code: code), state: nil).display == .OPEN_APP) }
    precondition(LockLogic.outcome(.init(code: 426), state: nil).display == .UPDATE_APP)
    for code in [200, 302, 500] { precondition(LockLogic.outcome(.init(code: code), state: nil).keepCommand) }
    precondition(LockLogic.date("2026-02-30T06:00:00.000Z") == nil)
    for field in ["extra", "workDurationSeconds", "breakStartedAt"] {
      var invalid = json; invalid[field] = true; precondition(LockState.parse(invalid) == nil)
    }
    let encoded = LockLogic.object(try JSONEncoder().encode(state))!
    precondition(encoded["stoppedAt"] is NSNull && encoded["breakStartedAt"] is NSNull)

    let store = MemoryStand(), keys = MemoryKey()
    var active = true, now = LockLogic.date(state.asOf)!, sends = [LockCommand]()
    var response = LockHttpResult(failure: .connect)
    var suspendIssue: CheckedContinuation<LockHttpResult, Never>?
    var delayIssue = false
    var delayedAction: CheckedContinuation<LockHttpResult, Never>?
    var delayAction = false
    let issued = LockHttpResult(code: 200, body: try JSONSerialization.data(withJSONObject: ["status":"issued", "state":json,
      "capability":String(repeating:"A",count:43), "expiresAt":"2026-10-22T07:00:00.000Z"]))
    let issueBody = try JSONSerialization.data(withJSONObject: ["timeEntryId":state.timeEntryId,
      "expectedMembershipId":"30000000-0000-4000-8000-000000000001", "installationId":NSNull()])
    var issueResponse = issued
    let engine = LockScreenEngine(store: store, keys: keys, foreground: { active }, now: { now }) { _, path, bearer, version, body in
      precondition(version == "test-version")
      if path == "/v1/lock-screen/capability" {
        precondition(bearer == "login-only-in-foreground"); precondition(active)
        if delayIssue { return await withCheckedContinuation { suspendIssue = $0 } }
        return issueResponse
      }
      precondition(path == "/v1/lock-screen/action" && bearer == String(repeating:"A", count:43))
      sends.append(try! JSONDecoder().decode(LockCommand.self, from:body))
      if delayAction { return await withCheckedContinuation { delayedAction = $0 } }
      return response
    }
    func prepare() async throws {
      active = true
      _ = try engine.clear(); _ = try engine.bind("organization/member/user")
      let revision = store.stand!.revision
      let projected = try engine.project(owner: "organization/member/user", state: state, revision: revision, discard: false)
      precondition(projected)
      let result = await engine.issue(owner: "organization/member/user", token: "login-only-in-foreground", body: issueBody, baseURL:"https://example.invalid", appVersion:"test-version", revision:revision)
      precondition(result == "issued")
    }
    try await prepare()
    let writes = keys.writes, deletes = keys.deletes
    active = false
    let open = await engine.action("pause", nonce:store.stand!.nonce)
    precondition(open && store.stand?.display == .NOT_SENT)
    let command = store.stand!.pending!
    response = .init(failure:.response)
    _ = await engine.action("retry", nonce:store.stand!.nonce)
    precondition(sends.suffix(2).allSatisfy { $0 == command } && store.stand?.display == .UNCONFIRMED)
    response = .init(code:200, body:try JSONSerialization.data(withJSONObject:["status":"state_changed", "state":pausedJSON, "idempotentRetry":true]))
    _ = await engine.action("retry", nonce:store.stand!.nonce)
    precondition(store.stand?.state == paused && store.stand?.pending == nil)
    let count = sends.count
    _ = await engine.action("pause", nonce:store.stand!.nonce)
    precondition(sends.count == count, "A stale pause button must not resume")
    response = .init(code:401)
    _ = await engine.action("stop", nonce:store.stand!.nonce)
    precondition(store.stand?.state == paused && store.stand?.display == .OPEN_APP && store.stand?.keyID == nil)
    precondition(keys.writes == writes && keys.deletes == deletes, "D-133: even 401 must never mutate Keychain in background")
    let boundInBackground = try engine.bind("another-account"); precondition(!boundInBackground)
    _ = try engine.clear()
    precondition(keys.writes == writes && keys.deletes == deletes)
    print("D-133 background action, retry, 401 and clear: zero Keychain writes/deletes; no login dependency")

    try await prepare()
    active = false; let expiryDeletes = keys.deletes
    now = now.addingTimeInterval(24 * 3600 + 1)
    _ = try engine.snapshot()
    precondition(store.stand?.state == state && store.stand?.display == .OPEN_APP && store.stand?.keyID == nil && keys.deletes == expiryDeletes)
    now = LockLogic.date(state.asOf)!
    try await prepare()
    _ = try engine.suspend(ownCapture:true); active = false
    let beforeCapture = sends.count
    _ = await engine.action("stop", nonce:store.stand!.nonce)
    precondition(sends.count == beforeCapture && store.stand?.display == .TRANSFERRING)

    try await prepare(); delayIssue = true
    let revision = store.stand!.revision, lateWrites = keys.writes
    let issue = Task { await engine.issue(owner:"organization/member/user", token:"login-only-in-foreground", body:issueBody, baseURL:"https://example.invalid", appVersion:"test-version", revision:revision) }
    while suspendIssue == nil { await Task.yield() }
    active = false; suspendIssue!.resume(returning:issued)
    let late = await issue.value
    precondition(late == "superseded" && keys.writes == lateWrites, "A foreground request completing after lock cannot write Keychain")
    delayIssue = false; try await prepare()
    active = false
    response = .init(code:200, body:try JSONSerialization.data(withJSONObject:["status":"applied", "state":stoppedJSON, "idempotentRetry":false]))
    _ = await engine.action("stop", nonce:store.stand!.nonce)
    precondition(store.stand?.state == stopped && store.stand?.stoppedNoticeUntil == nil)
    print("T-104c Swift response, texts, buttons, stable retry ID, expiry, own capture and late-issue scenarios passed")

    try await prepare()
    let renewalRevision = store.stand!.revision
    issueResponse = .init(code:401)
    let unauthorized = await engine.issue(owner:"organization/member/user", token:"login-only-in-foreground", body:issueBody,
      baseURL:"https://example.invalid", appVersion:"test-version", revision:renewalRevision)
    precondition(unauthorized == "unauthorized" && store.stand?.state == nil)
    issueResponse = issued
    let renewed = await engine.issue(owner:"organization/member/user", token:"login-only-in-foreground", body:issueBody,
      baseURL:"https://example.invalid", appVersion:"test-version", revision:renewalRevision)
    precondition(renewed == "issued" && store.stand?.state == state, "A successful retry after capability 401 must restore the requested entry")
    let wrongEntryBody = try JSONSerialization.data(withJSONObject: ["timeEntryId":"60000000-0000-4000-8000-000000000002"])
    let writesBeforeMismatch = keys.writes
    let mismatch = await engine.issue(owner:"organization/member/user", token:"login-only-in-foreground", body:wrongEntryBody,
      baseURL:"https://example.invalid", appVersion:"test-version", revision:store.stand!.revision)
    precondition(mismatch == "unavailable" && keys.writes == writesBeforeMismatch)
    print("Capability 401 renewal uses the requested entry; mismatched entry cannot replace its key")

    // T-104e: the booked pause permits the next explicit action while its WAL is pending.
    try await prepare(); active = false
    response = .init(code:200, body:try JSONSerialization.data(withJSONObject:["status":"applied", "state":pausedJSON,
      "idempotentRetry":false, "archiveStatus":"pending"]))
    let pendingBefore = sends.count
    _ = await engine.action("pause", nonce:store.stand!.nonce)
    precondition(sends.count == pendingBefore + 1 && store.stand?.pending == nil && store.stand?.display == .SAVING)
    precondition(LockLogic.actions(paused, .SAVING) == ["resume", "stop"] && LockLogic.showsDuration(paused, .SAVING))
    precondition(LockLogic.subtitle(paused, .SAVING) == "Pause seit 08:30 · wird gesichert")
    active = true
    let pendingRevision = store.stand!.revision
    _ = try engine.project(owner:store.stand!.owner, state:paused, revision:pendingRevision, discard:false)
    precondition(store.stand?.display == .SAVING, "Reading a calendar alone cannot confirm the archive")
    var pendingIssue = LockLogic.object(issued.body)!; pendingIssue["state"] = pausedJSON; pendingIssue["archiveStatus"] = "pending"
    issueResponse = .init(code:200, body:try JSONSerialization.data(withJSONObject:pendingIssue))
    _ = await engine.issue(owner:store.stand!.owner, token:"login-only-in-foreground", body:issueBody,
      baseURL:"https://example.invalid", appVersion:"test-version", revision:pendingRevision)
    precondition(store.stand?.display == .SAVING && sends.count == pendingBefore + 1)
    pendingIssue["archiveStatus"] = "archived"
    issueResponse = .init(code:200, body:try JSONSerialization.data(withJSONObject:pendingIssue))
    _ = await engine.issue(owner:store.stand!.owner, token:"login-only-in-foreground", body:issueBody,
      baseURL:"https://example.invalid", appVersion:"test-version", revision:pendingRevision)
    precondition(store.stand?.display == .STATE && sends.count == pendingBefore + 1)
    active = false
    response = .init(code:200, body:try JSONSerialization.data(withJSONObject:["status":"applied", "state":stoppedJSON,
      "idempotentRetry":false, "archiveStatus":"pending"]))
    _ = await engine.action("stop", nonce:store.stand!.nonce)
    precondition(store.stand?.state == stopped && store.stand?.display == .SAVING && store.stand?.pending == nil && store.stand?.keyID == nil)
    precondition(store.stand?.stoppedNoticeUntil == nil && LockLogic.actions(stopped, .SAVING).isEmpty)
    issueResponse = issued
    print("T-104e booked state, pending archive, read-only reconciliation and immediate stop verified")

    let actionReply = LockHttpResult(code:200, body:try JSONSerialization.data(withJSONObject:["status":"applied", "state":pausedJSON, "idempotentRetry":false]))
    for interruption in ["open", "own-capture", "account-change"] {
      try await prepare(); active = false; delayAction = true; delayedAction = nil
      let nonce = store.stand!.nonce
      let action = Task { await engine.action("pause", nonce:nonce) }
      while delayedAction == nil { await Task.yield() }
      active = true
      if interruption == "open" { _ = try engine.suspend() }
      if interruption == "own-capture" { _ = try engine.suspend(ownCapture:true) }
      if interruption == "account-change" { _ = try engine.bind("other-account") }
      delayedAction!.resume(returning:actionReply); _ = await action.value
      if interruption == "open" {
        precondition(store.stand?.state == paused && store.stand?.pending == nil, "Opening must retain the in-flight command result")
      } else {
        precondition(store.stand?.state != paused, "Superseded command results must not cross capture or account boundaries")
      }
      delayAction = false
    }
    print("In-flight command survives opening; own capture and account change reject its late response")
  }
}
