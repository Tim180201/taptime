import ExpoModulesCore
import Foundation

// JS requires synchronous compare-and-set methods. All native transitions share the main actor
// with LiveActivityIntent, while HTTP and ActivityKit calls suspend without blocking it.
private func onLockMain<T>(_ body: @MainActor () -> T) -> T {
  if Thread.isMainThread { return MainActor.assumeIsolated { body() } }
  return DispatchQueue.main.sync { MainActor.assumeIsolated { body() } }
}
public class TapTimeLockScreenModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TapTimeIosLockScreen")
    Events("onStandChanged")
    OnCreate { onLockMain { TapTimeLockScreenRuntime.onChange = { [weak self] in self?.sendEvent("onStandChanged") } } }
    OnDestroy { onLockMain { TapTimeLockScreenRuntime.onChange = nil } }
    Function("read") { onLockMain { TapTimeLockScreenRuntime.read() } }
    Function("bind") { (owner: String) in onLockMain { (try? TapTimeLockScreenRuntime.engine.bind(owner)) ?? false } }
    Function("clear") { onLockMain { (try? TapTimeLockScreenRuntime.engine.clear()) ?? false } }
    Function("suspend") { onLockMain { (try? TapTimeLockScreenRuntime.engine.suspend()) ?? false } }
    Function("awaitOwnCapture") { onLockMain { (try? TapTimeLockScreenRuntime.engine.suspend(ownCapture: true)) ?? false } }
    Function("project") { (owner: String, json: String?, revision: String, discard: Bool) in
      onLockMain { () -> Bool in
        let state = json.flatMap { LockState.parse(LockLogic.object(Data($0.utf8))) }
        if json != nil && state == nil { return false }
        return (try? TapTimeLockScreenRuntime.engine.project(owner: owner, state: state, revision: revision, discard: discard)) ?? false
      }
    }
    AsyncFunction("issue") { (owner: String, token: String, body: String, baseURL: String, version: String, revision: String) async -> String in
      await TapTimeLockScreenRuntime.engine.issue(owner: owner, token: token, body: Data(body.utf8), baseURL: baseURL, appVersion: version, revision: revision)
    }
    AsyncFunction("retry") { () async in
      _ = await TapTimeLockScreenRuntime.engine.action("retry", nonce: nil, fromApp: true)
    }
  }
}
