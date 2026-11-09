import ActivityKit
import Foundation

// Compiled from the same source into the app's native module and the widget extension.
struct TapTimeActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    let state: LockState
    let display: LockDisplay
    let nonce: String
    let canSend: Bool
    let expiresAt: Date?

    // D-160: every request/update/end gets an already redacted copy. The engine,
    // protected storage and JS bridge continue to use the original full name.
    init(state: LockState, display: LockDisplay, nonce: String, canSend: Bool, expiresAt: Date?) {
      let target = state.target
      var name = target.displayName
      if target.targetType == "customer" {
        let letters = name.precomposedStringWithCanonicalMapping
          .split(whereSeparator: { $0.isWhitespace || $0 == "," })
          .compactMap { $0.first(where: { $0.isLetter }) }
        let initials = letters.count > 1 ? [letters.first!, letters.last!] : letters
        name = initials.isEmpty ? "Kunde" : initials.map { String($0).uppercased() + "." }.joined(separator: " ")
      }
      self.state = LockState(timeEntryId: state.timeEntryId, status: state.status, startedAt: state.startedAt,
        breakStartedAt: state.breakStartedAt, stoppedAt: state.stoppedAt, asOf: state.asOf,
        workDurationSeconds: state.workDurationSeconds, breakDurationSeconds: state.breakDurationSeconds,
        target: .init(targetType: target.targetType, targetId: target.targetId, displayName: name))
      self.display = display; self.nonce = nonce; self.canSend = canSend; self.expiresAt = expiresAt
    }
  }
  let instanceID: String
  let captureURL: String
}
