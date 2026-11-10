import AppIntents
#if !TAPTIME_WIDGET
internal import TapTimeLockScreen
#endif

@available(iOS 17.0, *)
struct LockScreenActionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Laufende Zeit"
  static var openAppWhenRun = false
  @available(iOS 26.0, *)
  static var supportedModes: IntentModes { .background }
  static var isDiscoverable = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  @Parameter(title: "Aktion") var action: String
  @Parameter(title: "Anzeigestand") var nonce: String
  init() {}
  init(action: String, nonce: String) { self.action = action; self.nonce = nonce }
  @MainActor func perform() async throws -> some IntentResult {
    #if !TAPTIME_WIDGET
    await TapTimeLockScreenRuntime.action(action, nonce: nonce)
    #endif
    return .result()
  }
}
