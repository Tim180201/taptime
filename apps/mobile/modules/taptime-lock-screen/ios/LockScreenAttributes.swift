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
  }
  let instanceID: String
  let captureURL: String
}
