import Foundation

@MainActor final class TapStand: LockStandStorage {
  var value: LockStand?
  var fail = false
  func read() throws -> LockStand? { if fail { throw Failure() }; return value }
  func write(_ value: LockStand?) throws { if fail { throw Failure() }; self.value = value }
}
struct Failure: Error {}
@MainActor final class TapKeys: LockCapabilityStorage {
  var value: String? = "capability"
  func read(id: String) throws -> String? { value }
  func replace(id: String, capability: String) throws { value = capability }
  func remove() throws { value = nil }
}
@MainActor final class TapDiagnostics: LockTapStorage {
  var value: LockTapDiagnostic?
  var fail = false
  func read() throws -> LockTapDiagnostic? { value }
  func write(_ value: LockTapDiagnostic?) throws { if fail { throw Failure() }; self.value = value }
}
@main struct DiagnosticTests {
  @MainActor static func main() async throws {
    let json = LockLogic.object(Data("""
    {"timeEntryId":"60000000-0000-4000-8000-000000000001","status":"running","startedAt":"2026-11-10T06:00:00.000Z","stoppedAt":null,"breakStartedAt":null,"asOf":"2026-11-10T07:00:00.000Z","workDurationSeconds":3600,"breakDurationSeconds":0,"target":{"targetType":"customer","targetId":"20000000-0000-4000-8000-000000000001","displayName":"Never in diagnostic"}}
    """.utf8))!
    let state = LockState.parse(json)!, store = TapStand(), keys = TapKeys(), diagnostics = TapDiagnostics()
    var now = LockLogic.date(state.asOf)!, foreground = false, sends = 0
    var response = LockHttpResult(code: 403)
    var delayed: CheckedContinuation<LockHttpResult, Never>?
    var delay = false
    let engine = LockScreenEngine(store: store, keys: keys, foreground: { foreground }, now: { now },
      diagnostics: diagnostics, tapContext: { (.background, false) }) { _, _, _, _, _ in
      sends += 1
      if delay { return await withCheckedContinuation { delayed = $0 } }
      return response
    }
    func prepare() {
      store.fail = false; keys.value = "capability"
      var stand = LockStand(owner: "private-owner")
      stand.state = state; stand.keyID = "private-key"; stand.expiresAt = now.addingTimeInterval(3600)
      stand.baseURL = "https://example.invalid"; stand.appVersion = "test"; stand.appBlocked = false
      store.value = stand
    }
    var seen = Set<LockTapResult>()
    func check(_ result: LockTapResult) throws {
      let diagnostic = diagnostics.value!
      precondition(diagnostic.result == result, "Expected \(result), got \(diagnostic.result)")
      precondition(diagnostic.performRan && diagnostic.appState == .background && !diagnostic.protectedDataAvailable)
      precondition(diagnostic.at == "2026-11-10T07:00:00.000Z")
      let data = try JSONEncoder().encode(diagnostic), object = LockLogic.object(data)!
      precondition(Set(object.keys) == Set(["at", "performRan", "appState", "protectedDataAvailable", "result"]))
      precondition(!String(decoding: data, as: UTF8.self).contains("private") && !String(decoding: data, as: UTF8.self).contains("Never"))
      seen.insert(result)
    }
    for result in [LockTapResult.blocked, .nonce_changed, .no_key, .storage] {
      prepare()
      let nonce = store.value!.nonce, before = sends
      if result == .blocked { store.value!.appBlocked = true }
      if result == .nonce_changed { _ = try engine.suspend() }
      if result == .no_key { keys.value = nil }
      if result == .storage { store.fail = true }
      _ = await engine.action("pause", nonce: nonce)
      try check(result); precondition(sends == before)
      store.fail = false; foreground = true
      _ = try engine.snapshot(); _ = try engine.suspend()
      precondition(sends == before, "Opening cannot replay a rejected tap")
      foreground = false
    }
    var paused = json; paused["status"] = "paused"; paused["breakStartedAt"] = state.asOf
    func reply(_ status: String) throws -> LockHttpResult {
      .init(code: 200, body: try JSONSerialization.data(withJSONObject: ["status": status, "state": paused, "idempotentRetry": false]))
    }
    for (result, value) in [(LockTapResult.executed, try reply("applied")), (.state_changed, try reply("state_changed")),
      (.network, .init(failure: .connect)), (.unconfirmed, .init(failure: .response)),
      (.rejected, .init(code: 401)), (.update_required, .init(code: 426))] {
      prepare(); response = value
      _ = await engine.action("pause", nonce: store.value!.nonce)
      try check(result)
      let before = sends, diagnostic = diagnostics.value
      foreground = true
      _ = try engine.snapshot(); _ = try engine.suspend()
      precondition(sends == before && diagnostics.value == diagnostic, "Opening neither retries nor overwrites the last tap")
      foreground = false
    }
    prepare(); delay = true
    let nonce = store.value!.nonce
    let task = Task { await engine.action("pause", nonce: nonce) }
    while delayed == nil { await Task.yield() }
    try check(.started)
    _ = try engine.suspend(ownCapture: true)
    delayed!.resume(returning: try reply("applied")); _ = await task.value
    try check(.superseded)
    precondition(seen == Set(LockTapResult.allCases), "Every diagnostic result has an executed scenario")

    // A later tap owns the single slot, even when the first response finishes later.
    prepare(); delayed = nil
    let older = Task { await engine.action("pause", nonce: store.value!.nonce) }
    while delayed == nil { await Task.yield() }
    now = now.addingTimeInterval(1)
    _ = await engine.action("stop", nonce: "stale")
    let latest = diagnostics.value
    delayed!.resume(returning: try reply("applied")); _ = await older.value
    precondition(diagnostics.value == latest && latest?.result == .nonce_changed)

    // Explicit in-app retry is not a new lock-screen tap.
    delay = false; prepare(); response = .init(failure: .connect)
    _ = await engine.action("pause", nonce: store.value!.nonce)
    let beforeRetry = diagnostics.value
    foreground = true; _ = await engine.action("retry", nonce: nil, fromApp: true)
    precondition(diagnostics.value == beforeRetry)

    for changeOwner in [false, true] {
      prepare(); delay = true; delayed = nil
      let pending = Task { await engine.action("pause", nonce: store.value!.nonce) }
      while delayed == nil { await Task.yield() }
      if changeOwner { _ = try engine.bind("next-owner") } else { _ = try engine.clear() }
      precondition(diagnostics.value == nil)
      delayed!.resume(returning: try reply("applied")); _ = await pending.value
      precondition(diagnostics.value == nil, "A late result cannot recreate diagnostics after sign-out/account change")
    }
    prepare(); diagnostics.fail = true
    _ = try engine.clear()
    precondition(store.value == nil && keys.value == nil, "Diagnostic storage failure must not preserve authority on sign-out")
    print("T145: all outcomes, no replay, last tap wins, safe fields and sign-out verified")
  }
}
