import Foundation

@main struct PrivacyTests {
  static func main() throws {
    let table = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
    for row in table.split(separator: "\n") {
      let cells = row.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
      let type = cells[0], name = cells[1], expected = cells[2]
      for status in ["running", "paused", "stopped"] {
        for display in [LockDisplay.STATE, .SAVING, .OFFLINE, .TRANSFERRING, .SENDING, .NOT_SENT, .UNCONFIRMED, .OPEN_APP, .UPDATE_APP] {
          let state = LockState(timeEntryId: "entry", status: status, startedAt: "2026-10-31T08:00:00.000Z",
            breakStartedAt: status == "paused" ? "2026-10-31T09:00:00.000Z" : nil,
            stoppedAt: status == "stopped" ? "2026-10-31T10:00:00.000Z" : nil, asOf: "2026-10-31T10:00:00.000Z",
            workDurationSeconds: 3600, breakDurationSeconds: 0, target: .init(targetType: type, targetId: "target", displayName: name))
          // Exercise the actual ContentState constructor used by request/update/end,
          // before any widget can render it; hiding a name in SwiftUI would be too late.
          let content = TapTimeActivityAttributes.ContentState(state: state, display: display, nonce: "nonce", canSend: true, expiresAt: nil)
          precondition(content.state.target.displayName == expected, "\(name): \(content.state.target.displayName)")
          let encoded = String(decoding: try JSONEncoder().encode(content), as: UTF8.self)
          if type == "customer" { precondition(!encoded.contains(name)) }
          precondition(state.target.displayName == name)
          precondition(content.state.timeEntryId == state.timeEntryId && content.state.status == status)
          precondition(content.canSend && content.display == display)
        }
      }
    }
    print("T141 ActivityKit content: initialled before serialization")
  }
}
