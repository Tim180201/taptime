import UIKit

/// LiveActivityIntent can cold-start the app while locked. Do not even start React in that case.
@MainActor enum TapTimeForegroundLaunch {
  private static var observer: NSObjectProtocol?
  static func run(application: UIApplication, start: @escaping () -> Void) {
    // Normal launches are inactive during didFinishLaunching; preserve Expo's startup order.
    if application.applicationState != .background { start(); return }
    observer = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
      object: nil, queue: .main) { _ in
      MainActor.assumeIsolated {
        guard application.applicationState == .active else { return }
        if let observer { NotificationCenter.default.removeObserver(observer) }
        observer = nil
        start()
      }
    }
  }
}
