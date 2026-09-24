import ExpoModulesCore
import Foundation
import os.log

public class TapTimeNfcDiagnosticsModule: Module {
  private let log = OSLog(subsystem: "com.taptura.nfc", category: "lifecycle")
  private let phases: Set<String> = ["requested", "connected", "read", "action_finished",
    "cancel_ok", "cancel_failed", "session_closed", "deadline_expired"]

  public func definition() -> ModuleDefinition {
    Name("TapTimeNfcDiagnostics")
    Function("record") { (phase: String, elapsedMs: Double, code: Int) in
      guard self.phases.contains(phase), elapsedMs.isFinite, elapsedMs >= 0,
            elapsedMs <= 9_007_199_254_740_991, (-1...403).contains(code) else { return }
      // Default-level unified logging survives Release and is visible in Console.
      // Only an allowlisted phase, relative milliseconds and a numeric code enter it.
      os_log("TapturaNfc %{public}@ +%{public}.0fms code=%{public}d",
        log: self.log, type: .default, phase, elapsedMs, code)
    }
  }
}
