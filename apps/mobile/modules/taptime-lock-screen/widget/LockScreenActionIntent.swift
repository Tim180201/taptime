import AppIntents
#if !TAPTIME_WIDGET
internal import TapTimeLockScreen
import UIKit
#endif

@available(iOS 17.0, *)
struct LockScreenActionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Laufende Zeit"
  static var openAppWhenRun = false
  static var isDiscoverable = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  @Parameter(title: "Aktion") var action: String
  @Parameter(title: "Anzeigestand") var nonce: String
  init() {}
  init(action: String, nonce: String) { self.action = action; self.nonce = nonce }
  @MainActor func perform() async throws -> some IntentResult {
    #if !TAPTIME_WIDGET
    if await TapTimeLockScreenRuntime.action(action, nonce: nonce) {
      // No automatic replay on foreground continuation: just open the capture screen.
      try await requestToContinueInForeground()
      if let url = TapTimeLockScreenRuntime.captureURL { await UIApplication.shared.open(url) }
    }
    #endif
    return .result()
  }
}
#if !TAPTIME_WIDGET
@available(iOS 17.0, *)
extension LockScreenActionIntent: ForegroundContinuableIntent {}
#endif
