package com.taptime.lockscreen

import android.os.SystemClock
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TapTimeLockScreenModule : Module() {
  private fun context() = requireNotNull(appContext.reactContext) { "Lock-screen unavailable" }
  override fun definition() = ModuleDefinition {
    Name("TapTimeLockScreen")
    Events("onStandChanged")
    OnCreate { LockScreenRuntime.changed = { runCatching { sendEvent("onStandChanged", emptyMap<String, Any>()) }; Unit } }
    OnDestroy { LockScreenRuntime.changed = null }
    Function("read") { runCatching { LockScreenRuntime.snapshot(context()) }.getOrDefault("{}") }
    Function("bind") { owner: String -> runCatching { LockScreenRuntime.bind(context(), owner); true }.getOrDefault(false) }
    Function("clear") { runCatching { LockScreenRuntime.clear(context()); true }.getOrDefault(false) }
    Function("suspend") { runCatching { LockScreenRuntime.suspend(context()); true }.getOrDefault(false) }
    Function("awaitOwnCapture") { runCatching { LockScreenRuntime.awaitOwnCapture(context()); true }.getOrDefault(false) }
    Function("claimPermissionPrompt") { runCatching { LockScreenRuntime.claimPermissionPrompt(context()) }.getOrDefault(false) }
    Function("project") { owner: String, state: String?, revision: String, discardPending: Boolean ->
      runCatching { LockScreenRuntime.project(context(), owner, state, revision, discardPending) }.getOrDefault(false)
    }
    AsyncFunction("issue") { owner: String, token: String, body: String, baseUrl: String, appVersion: String, revision: String, promise: Promise ->
      val context = runCatching { context().applicationContext }.getOrNull()
      LockScreenIo.execute {
        // Neither exceptions nor the HTTP body may expose the capability.
        promise.resolve(if (context == null) "unavailable" else runCatching {
          LockScreenRuntime.issue(context, owner, token, body, baseUrl, appVersion, revision)
        }.getOrDefault("unavailable"))
      }
    }
    AsyncFunction("retry") { promise: Promise ->
      val context = runCatching { context().applicationContext }.getOrNull()
      LockScreenIo.execute {
        if (context != null) runCatching { LockScreenRuntime.action(context, "retry", null, SystemClock.elapsedRealtime() + 6500, true) }
        promise.resolve(null)
      }
    }
  }
}
