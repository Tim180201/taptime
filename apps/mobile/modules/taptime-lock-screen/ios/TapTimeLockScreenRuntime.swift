import ActivityKit
import Foundation
import UIKit

@MainActor public enum TapTimeLockScreenRuntime {
  static var onChange: (() -> Void)?
  private static var renderTask: Task<Void, Never>?
  private static var expiryTask: Task<Void, Never>?
  static let engine: LockScreenEngine = {
    let engine = LockScreenEngine(store: LockFileStore(), keys: LockKeychain(),
      foreground: { UIApplication.shared.applicationState == .active }, post: { base, path, bearer, version, body in
        await LockHttp.post(baseURL: base, path: path, bearer: bearer, version: version, body: body)
      })
    engine.changed = { scheduleRender() }
    engine.actionChanged = { onChange?() }
    return engine
  }()
  public static var captureURL: URL? {
    (Bundle.main.object(forInfoDictionaryKey: "TapTimeLockScreenScheme") as? String).flatMap { URL(string: "\($0)://lock-screen/capture") }
  }
  public static func action(_ action: String, nonce: String) async -> Bool {
    let open = await engine.action(action, nonce: nonce)
    await renderTask?.value
    return open
  }
  static func scheduleRender() {
    let previous = renderTask
    renderTask = Task { await previous?.value; await render() }
  }
  static func render() async {
    // Store reads do not touch authentication. A damaged file removes the visible activity.
    let stand = try? engine.snapshot()
    let activities = Activity<TapTimeActivityAttributes>.activities
    guard let stand, let state = stand.state, let captureURL else {
      for activity in activities { await activity.end(nil, dismissalPolicy: .immediate) }
      return
    }
    let content = ActivityContent(state: TapTimeActivityAttributes.ContentState(state: state, display: stand.display,
      nonce: stand.nonce, canSend: stand.keyID != nil && !stand.appBlocked && !stand.ownCapturePending,
      expiresAt: stand.expiresAt), staleDate: stand.expiresAt)
    let matching = activities.first { $0.attributes.instanceID == stand.instanceID &&
      ($0.activityState == .active || (state.status == "stopped" && $0.activityState == .ended)) }
    for activity in activities where activity.id != matching?.id { await activity.end(nil, dismissalPolicy: .immediate) }
    if state.status == "stopped", LockLogic.settled(stand.display) {
      // End immediately, including a booked stop whose archive confirmation is still pending.
      if let matching { await matching.end(content, dismissalPolicy: .immediate) }
      return
    }
    if let matching { await matching.update(content) }
    else if UIApplication.shared.applicationState == .active, !stand.ownCapturePending,
      ActivityAuthorizationInfo().areActivitiesEnabled {
      _ = try? Activity.request(attributes: TapTimeActivityAttributes(instanceID: stand.instanceID, captureURL: captureURL.absoluteString),
        content: content, pushType: nil)
    }
    expiryTask?.cancel()
    if let expires = stand.expiresAt {
      expiryTask = Task {
        do { try await Task.sleep(nanoseconds: UInt64(max(0, expires.timeIntervalSinceNow) * 1_000_000_000)) }
        catch { return }
        _ = try? engine.snapshot() // Also checked at every foreground read and action.
      }
    }
  }
  static func read() -> String {
    do {
      let stand = try engine.snapshot()
      // Secrets, endpoint and key references never cross the JS/ActivityKit boundary.
      var safe: [String: Any] = ["permissionGranted": ActivityAuthorizationInfo().areActivitiesEnabled, "permissionAsked": true]
      if let stand {
        safe["owner"] = stand.owner; safe["revision"] = stand.revision; safe["display"] = stand.display.rawValue
        safe["ownCapturePending"] = stand.ownCapturePending
        if let state = stand.state { safe["state"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(state)) }
        if let pending = stand.pending { safe["pending"] = try JSONSerialization.jsonObject(with: JSONEncoder().encode(pending)) }
      }
      return String(decoding: try JSONSerialization.data(withJSONObject: safe), as: UTF8.self)
    } catch { scheduleRender(); return "{}" }
  }
}
