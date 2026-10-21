import Foundation
import CoreFoundation

enum LockDisplay: String, Codable { case STATE, TRANSFERRING, SENDING, NOT_SENT, UNCONFIRMED, OPEN_APP, UPDATE_APP }
struct LockCommand: Codable, Equatable { let commandId: String; let action: String }
struct LockState: Codable, Hashable {
  struct Target: Codable, Hashable { let targetType: String; let targetId: String; let displayName: String }
  let timeEntryId: String
  let status: String
  let startedAt: String
  let breakStartedAt: String?
  let stoppedAt: String?
  let asOf: String
  let workDurationSeconds: Int64
  let breakDurationSeconds: Int64
  let target: Target

  // The JS contract requires explicit nulls, including across the native bridge.
  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(timeEntryId, forKey: .timeEntryId); try c.encode(status, forKey: .status)
    try c.encode(startedAt, forKey: .startedAt); try c.encode(breakStartedAt, forKey: .breakStartedAt)
    try c.encode(stoppedAt, forKey: .stoppedAt); try c.encode(asOf, forKey: .asOf)
    try c.encode(workDurationSeconds, forKey: .workDurationSeconds)
    try c.encode(breakDurationSeconds, forKey: .breakDurationSeconds); try c.encode(target, forKey: .target)
  }
  static func parse(_ value: Any?) -> LockState? {
    guard let v = value as? [String: Any], Set(v.keys) == Set(["timeEntryId", "status", "startedAt", "breakStartedAt", "stoppedAt", "asOf", "workDurationSeconds", "breakDurationSeconds", "target"]),
      let t = v["target"] as? [String: Any], Set(t.keys) == Set(["targetType", "targetId", "displayName"]),
      let data = try? JSONSerialization.data(withJSONObject: v), let s = try? JSONDecoder().decode(Self.self, from: data),
      LockLogic.uuid(s.timeEntryId), LockLogic.uuid(s.target.targetId), !s.target.displayName.isEmpty,
      ["customer", "project", "general_work"].contains(s.target.targetType),
      let start = LockLogic.date(s.startedAt), let at = LockLogic.date(s.asOf), at >= start else { return nil }
    for field in ["workDurationSeconds", "breakDurationSeconds"] {
      guard let n = v[field] as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(),
        n.doubleValue >= 0, n.doubleValue <= 9_007_199_254_740_991, floor(n.doubleValue) == n.doubleValue else { return nil }
    }
    func within(_ text: String?) -> Bool { guard let text, let date = LockLogic.date(text) else { return false }; return date >= start && date <= at }
    switch s.status {
    case "running": return s.breakStartedAt == nil && s.stoppedAt == nil ? s : nil
    case "paused": return within(s.breakStartedAt) && s.stoppedAt == nil ? s : nil
    case "stopped": return within(s.stoppedAt) && s.breakStartedAt == nil ? s : nil
    default: return nil
    }
  }
}

// Mutable, non-secret state lives in a protected file. keyID is a reference, never a credential.
struct LockStand: Codable {
  var owner: String
  var instanceID = UUID().uuidString.lowercased()
  var revision = UUID().uuidString.lowercased()
  var nonce = UUID().uuidString.lowercased()
  var state: LockState?
  var pending: LockCommand?
  var display = LockDisplay.OPEN_APP
  var ownCapturePending = false
  var appBlocked = true
  var keyID: String?
  var expiresAt: Date?
  var stoppedNoticeUntil: Date?
  var baseURL: String?
  var appVersion: String?
  mutating func invalidateKey() { keyID = nil; expiresAt = nil }
  mutating func changed() { revision = UUID().uuidString.lowercased(); nonce = UUID().uuidString.lowercased() }
}

enum LockFailure { case connect, response }
struct LockHttpResult { var code = 0; var body: Data?; var failure: LockFailure? }
struct LockOutcome { let display: LockDisplay; var invalidateKey = false; var keepCommand = false }

enum LockLogic {
  static func uuid(_ value: String) -> Bool { value.range(of: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", options: .regularExpression) != nil }
  static func date(_ value: String) -> Date? {
    guard value.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$", options: .regularExpression) != nil else { return nil }
    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = f.date(from: value), f.string(from: date) == value else { return nil }; return date
  }
  static func object(_ data: Data?) -> [String: Any]? { data.flatMap { (try? JSONSerialization.jsonObject(with: $0)) as? [String: Any] } }
  static func actionState(_ result: LockHttpResult, entryID: String) -> LockState? {
    guard result.code == 200, result.failure == nil, let v = object(result.body),
      Set(v.keys) == Set(["status", "state", "idempotentRetry"]),
      ["applied", "state_changed"].contains(v["status"] as? String ?? ""),
      let retry = v["idempotentRetry"] as? NSNumber, CFGetTypeID(retry) == CFBooleanGetTypeID(),
      let state = LockState.parse(v["state"]), state.timeEntryId == entryID else { return nil }
    return state
  }
  static func outcome(_ r: LockHttpResult, state: LockState?) -> LockOutcome {
    if r.failure == .connect { return .init(display: .NOT_SENT, keepCommand: true) }
    if r.failure == .response { return .init(display: .UNCONFIRMED, keepCommand: true) }
    if r.code == 200, let state { return .init(display: .STATE, invalidateKey: state.status == "stopped") }
    if r.code == 401 { return .init(display: .OPEN_APP, invalidateKey: true) }
    if r.code == 426 { return .init(display: .UPDATE_APP) }
    if [400, 403, 409, 429].contains(r.code) { return .init(display: .OPEN_APP) }
    return .init(display: .UNCONFIRMED, keepCommand: true)
  }
  static func command(status: String, pending: LockCommand?, action: String) -> LockCommand? {
    if action == "retry" { return pending }
    guard pending == nil, (action == "pause" && status == "running") || (action == "resume" && status == "paused") || (action == "stop" && ["running", "paused"].contains(status)) else { return nil }
    return LockCommand(commandId: UUID().uuidString.lowercased(), action: action)
  }
  static func duration(_ seconds: Int64) -> String { let s = max(0, seconds); return String(format: "%lld:%02lld h", s / 3600, s / 60 % 60) }
  static func berlin(_ text: String) -> String {
    guard let date = date(text) else { return "" }
    let f = DateFormatter(); f.locale = Locale(identifier: "de_DE"); f.timeZone = TimeZone(identifier: "Europe/Berlin"); f.dateFormat = "HH:mm"; return f.string(from: date)
  }
  static func message(_ display: LockDisplay) -> String {
    switch display {
    case .STATE: return ""
    case .TRANSFERRING: return "Wird übertragen …"
    case .SENDING: return "Wird gesendet …"
    case .NOT_SENT: return "Nicht gesendet · kein Netz"
    case .UNCONFIRMED: return "Noch nicht bestätigt"
    case .OPEN_APP: return "Bitte App öffnen"
    case .UPDATE_APP: return "Bitte App aktualisieren"
    }
  }
  static func label(_ action: String) -> String {
    switch action { case "pause": return "Pause starten"; case "resume": return "Pause beenden"; case "stop": return "Zeit beenden"; case "retry": return "Erneut senden"; default: return "Bitte App öffnen" }
  }
  static func actions(_ state: LockState, _ display: LockDisplay) -> [String] {
    if display == .NOT_SENT || display == .UNCONFIRMED { return ["retry"] }
    guard display == .STATE, state.status != "stopped" else { return [] }
    return [state.status == "paused" ? "resume" : "pause", "stop"]
  }
  static func showsDuration(_ state: LockState, _ display: LockDisplay) -> Bool {
    display == .STATE && state.status != "stopped"
  }
  static func title(_ state: LockState, _ display: LockDisplay) -> String {
    display == .STATE && state.status == "stopped" ? "Zeit beendet · \(duration(state.workDurationSeconds))" : state.target.displayName
  }
  static func subtitle(_ state: LockState, _ display: LockDisplay) -> String {
    guard display == .STATE else { return message(display) }
    if state.status == "stopped" { return state.target.displayName }
    if let at = state.breakStartedAt { return "Pause seit \(berlin(at))" }
    return "Läuft seit \(berlin(state.startedAt))"
  }
}
