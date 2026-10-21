package com.taptime.lockscreen

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Pure policy shared by the receiver, rendering and the JVM tests. No Android imports. */
internal enum class Display { STATE, TRANSFERRING, SENDING, NOT_SENT, UNCONFIRMED, OPEN_APP, UPDATE_APP }
internal enum class StoppedProjection { REPLACE, KEEP, CLEAR }
internal enum class Failure { CONNECT, RESPONSE }
internal data class Outcome(val display: Display, val deleteKey: Boolean = false, val keepCommand: Boolean = false)
internal data class Command(val commandId: String, val action: String)
internal object LockScreenLogic {
  const val FINISHED_NOTICE_MILLIS = 10_000L
  fun stoppedProjection(previousId: String?, previousStatus: String?, nextId: String?, nextStatus: String?, until: Long, now: Long): StoppedProjection {
    if (previousStatus != "stopped" || nextId != null && (nextId != previousId || nextStatus != "stopped")) return StoppedProjection.REPLACE
    return if (until > now) StoppedProjection.KEEP else StoppedProjection.CLEAR
  }
  fun clockRuns(status: String?, display: Display) = status == "running" && display == Display.STATE
  fun canSend(action: String, appBlocked: Boolean, ownCapturePending: Boolean, hasKey: Boolean) =
    hasKey && !ownCapturePending && (!appBlocked || action == "retry")
  fun receiverDeadline(received: Long, confirmedColdStart: Long?) = (confirmedColdStart ?: received) + 6500

  fun command(status: String, pending: Command?, action: String, createId: () -> String): Command? {
    if (action == "retry") return pending
    if (pending != null || !allowed(status, action)) return null
    return Command(createId(), action)
  }
  fun response(code: Int, validState: Boolean = false, stopped: Boolean = false, failure: Failure? = null): Outcome = when {
    failure == Failure.CONNECT -> Outcome(Display.NOT_SENT, keepCommand = true)
    failure == Failure.RESPONSE -> Outcome(Display.UNCONFIRMED, keepCommand = true)
    code == 200 && validState -> Outcome(Display.STATE, deleteKey = stopped)
    code == 401 -> Outcome(Display.OPEN_APP, deleteKey = true)
    code == 426 -> Outcome(Display.UPDATE_APP)
    code in listOf(400, 403, 409, 429) -> Outcome(Display.OPEN_APP)
    else -> Outcome(Display.UNCONFIRMED, keepCommand = true)
  }
  fun allowed(status: String, action: String): Boolean = when (action) {
    "pause" -> status == "running"
    "resume" -> status == "paused"
    "stop" -> status == "running" || status == "paused"
    else -> false
  }
  fun duration(seconds: Long): String = "${seconds.coerceAtLeast(0) / 3600}:${(seconds.coerceAtLeast(0) / 60 % 60).toString().padStart(2, '0')} h"
  fun elapsed(workSeconds: Long, asOf: Long, now: Long, running: Boolean): Long =
    workSeconds + if (running) ((now - asOf).coerceAtLeast(0) / 1000) else 0
  fun berlin(at: Long): String = SimpleDateFormat("HH:mm", Locale.GERMANY).apply {
    timeZone = TimeZone.getTimeZone("Europe/Berlin")
  }.format(Date(at))
  fun message(display: Display): String = when (display) {
    Display.STATE -> ""
    Display.TRANSFERRING -> "Wird übertragen …"
    Display.SENDING -> "Wird gesendet …"
    Display.NOT_SENT -> "Nicht gesendet · kein Netz"
    Display.UNCONFIRMED -> "Noch nicht bestätigt"
    Display.OPEN_APP -> "Bitte App öffnen"
    Display.UPDATE_APP -> "Bitte App aktualisieren"
  }
}
