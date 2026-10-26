import Foundation

@MainActor protocol LockStandStorage {
  func read() throws -> LockStand?
  func write(_ stand: LockStand?) throws
}
@MainActor protocol LockCapabilityStorage {
  func read(id: String) throws -> String?
  func replace(id: String, capability: String) throws
  func remove() throws
}

/** Same server protocol as Android. No login store, JS, auth refresh or automatic command replay. */
@MainActor final class LockScreenEngine {
  let store: LockStandStorage
  let keys: LockCapabilityStorage
  let foreground: () -> Bool
  let now: () -> Date
  let post: (String, String, String, String, Data) async -> LockHttpResult
  var changed: () -> Void = {}
  var actionChanged: () -> Void = {}
  private var inFlight = Set<String>()
  init(store: LockStandStorage, keys: LockCapabilityStorage, foreground: @escaping () -> Bool,
       now: @escaping () -> Date = Date.init,
       post: @escaping (String, String, String, String, Data) async -> LockHttpResult) {
    self.store = store; self.keys = keys; self.foreground = foreground; self.now = now; self.post = post
  }
  private func save(_ stand: LockStand?, notify: Bool = false) throws { try store.write(stand); changed(); if notify { actionChanged() } }
  // Background removal invalidates the reference in the file. Even SecItemDelete is deferred.
  private func cleanKeyIfForeground() throws { if foreground() { try keys.remove() } }
  func snapshot() throws -> LockStand? {
    guard var s = try store.read() else { return nil }
    if let until = s.stoppedNoticeUntil, until <= now() {
      s.state = nil; s.stoppedNoticeUntil = nil; s.changed(); try save(s)
    }
    if let expiry = s.expiresAt, expiry <= now() {
      s.invalidateKey(); s.pending = nil; s.display = .OPEN_APP; s.changed(); try save(s); try cleanKeyIfForeground()
    }
    if s.display == .SENDING, let command = s.pending, !inFlight.contains(command.commandId) {
      s.display = .UNCONFIRMED; s.changed(); try save(s)
    }
    return s
  }
  func bind(_ owner: String) throws -> Bool {
    guard foreground() else { return false }
    if try snapshot()?.owner == owner { return true }
    try save(LockStand(owner: owner)); try keys.remove(); return true
  }
  func clear() throws -> Bool {
    try save(nil); try cleanKeyIfForeground(); return true
  }
  func suspend(ownCapture: Bool = false) throws -> Bool {
    guard var s = try snapshot() else { return true }
    s.appBlocked = true; s.nonce = UUID().uuidString.lowercased()
    if ownCapture {
      s.ownCapturePending = true; s.pending = nil; s.invalidateKey(); s.stoppedNoticeUntil = nil; s.display = .TRANSFERRING
    }
    try save(s); return true
  }
  func project(owner: String, state: LockState?, revision: String, discard: Bool) throws -> Bool {
    guard foreground(), var s = try snapshot(), s.owner == owner, s.revision == revision,
      s.pending == nil || discard else { return false }
    let saving = s.display == .SAVING && s.state?.timeEntryId == state?.timeEntryId
    s.state = state; s.pending = nil; s.ownCapturePending = false; s.appBlocked = true
    s.invalidateKey(); s.nonce = UUID().uuidString.lowercased(); s.display = saving ? .SAVING : .STATE
    s.stoppedNoticeUntil = nil
    try save(s); try keys.remove(); return true
  }
  func issue(owner: String, token: String, body: Data, baseURL: String, appVersion: String, revision: String) async -> String {
    do {
      guard let entryID = LockLogic.object(body)?["timeEntryId"] as? String, LockLogic.uuid(entryID) else { return "unavailable" }
      guard foreground(), let initial = try snapshot(), initial.owner == owner, initial.revision == revision,
        initial.pending == nil, !initial.ownCapturePending else { return "superseded" }
      let result = await post(baseURL, "/v1/lock-screen/capability", token, appVersion, body)
      guard foreground(), var s = try snapshot(), s.instanceID == initial.instanceID, s.nonce == initial.nonce,
        s.revision == revision, s.pending == nil, !s.ownCapturePending else { return "superseded" }
      if result.code == 401 {
        s.invalidateKey(); s.state = nil; try save(s); try keys.remove(); return "unauthorized"
      }
      guard result.code == 200, result.failure == nil, let v = LockLogic.object(result.body),
        (Set(v.keys) == Set(["status", "capability", "expiresAt", "state"]) ||
          Set(v.keys) == Set(["status", "capability", "expiresAt", "state", "archiveStatus"]) && ["pending", "archived"].contains(v["archiveStatus"] as? String ?? "")), v["status"] as? String == "issued",
        // A 401 removes the visible state. The explicit retry still belongs to the same request.
        let state = LockState.parse(v["state"]), state.status != "stopped", state.timeEntryId == entryID,
        let capability = v["capability"] as? String, capability.range(of: "^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$", options: .regularExpression) != nil,
        let expiryText = v["expiresAt"] as? String, let expiry = LockLogic.date(expiryText), expiry > now() else {
        return result.code == 426 ? "update_required" : "unavailable"
      }
      let id = UUID().uuidString.lowercased()
      // No suspension point between foreground check and the only credential write.
      try keys.replace(id: id, capability: capability)
      s.keyID = id; s.expiresAt = expiry; s.state = state; s.display = v["archiveStatus"] as? String == "pending" ? .SAVING : .STATE; s.appBlocked = false
      s.baseURL = baseURL; s.appVersion = appVersion; s.nonce = UUID().uuidString.lowercased()
      try save(s); return "issued"
    } catch { return "unavailable" }
  }
  /// Returns whether the caller should open Erfassen. Retrying always requires another explicit tap.
  func action(_ action: String, nonce: String?, fromApp: Bool = false) async -> Bool {
    do {
      if fromApp && !foreground() { return true }
      guard var s = try snapshot(), let state = s.state, !s.ownCapturePending else { return true }
      guard fromApp || (s.nonce == nonce && (!s.appBlocked || action == "retry")) else { return true }
      guard let keyID = s.keyID, let expiry = s.expiresAt, expiry > now(), let key = try keys.read(id: keyID),
        let baseURL = s.baseURL, let appVersion = s.appVersion else { return true }
      guard let command = LockLogic.command(status: state.status, pending: s.pending, action: action),
        !inFlight.contains(command.commandId) else { return false }
      s.pending = command; s.display = .SENDING; s.changed()
      let instance = s.instanceID
      inFlight.insert(command.commandId)
      defer { inFlight.remove(command.commandId) }
      try save(s, notify: true)
      let response = await post(baseURL, "/v1/lock-screen/action", key, appVersion, try JSONEncoder().encode(command))
      // suspend() rotates button nonces when the app opens, but does not cancel an accepted command.
      guard var current = try store.read(), current.instanceID == instance,
        current.pending == command, !current.ownCapturePending else { return false }
      let next = LockLogic.actionState(response, entryID: state.timeEntryId)
      let outcome = LockLogic.outcome(response, state: next)
      if LockLogic.settled(outcome.display) { current.state = next }
      if outcome.invalidateKey { current.invalidateKey() }
      if !outcome.keepCommand { current.pending = nil }
      current.display = outcome.display; current.changed()
      if next?.status == "stopped", LockLogic.settled(outcome.display) { current.stoppedNoticeUntil = nil }
      try save(current, notify: true)
      if outcome.invalidateKey { try cleanKeyIfForeground() }
      return [.NOT_SENT, .OPEN_APP, .UPDATE_APP].contains(outcome.display)
    } catch { return true }
  }
}
