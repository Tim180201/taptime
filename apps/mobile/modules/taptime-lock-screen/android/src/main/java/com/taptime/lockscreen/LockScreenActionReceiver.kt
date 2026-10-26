package com.taptime.lockscreen

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.os.Build
import android.os.Process
import android.app.ActivityManager
import android.app.ApplicationStartInfo
import java.util.concurrent.atomic.AtomicBoolean

class LockScreenActionReceiver : BroadcastReceiver() {
  companion object { private val receivedBefore = AtomicBoolean(false) }
  private fun confirmedColdStart(context: Context, intent: Intent): Long? {
    if (receivedBefore.getAndSet(true) || Build.VERSION.SDK_INT < 35) return null
    return runCatching {
      val start = context.getSystemService(ActivityManager::class.java).getHistoricalProcessStartReasons(1).firstOrNull()
      if (start?.pid == Process.myPid() && start.reason == ApplicationStartInfo.START_REASON_BROADCAST
        && start.startType == ApplicationStartInfo.START_TYPE_COLD
        && start.intent?.component?.className == javaClass.name && start.intent?.data == intent.data)
        Process.getStartElapsedRealtime() else null
    }.getOrNull()
  }
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action == "dismiss") {
      val pending = goAsync()
      LockScreenIo.execute {
        try { LockScreenRuntime.restoreNotification(context.applicationContext) }
        catch (_: Exception) { /* No sensitive state in diagnostics. */ }
        finally { pending.finish() }
      }
      return
    }
    if (action !in listOf("pause", "resume", "stop", "retry")) return
    val parts = intent.data?.schemeSpecificPart?.split(':') ?: return
    if (parts.size != 2 || parts[1] != action) return
    val received = SystemClock.elapsedRealtime()
    // Only explicit platform evidence may charge startup time to this receipt. Process age alone cannot.
    val deadline = LockScreenLogic.receiverDeadline(received, confirmedColdStart(context, intent))
    val pending = goAsync()
    Thread({
      try { LockScreenRuntime.action(context.applicationContext, action, parts[0], deadline) }
      catch (_: Exception) { /* No credentials or server error bodies in logs or exceptions. */ }
      finally { pending.finish() }
    }, "lock-screen-action").start()
  }
}
