package com.taptime.lockscreen

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Pure policy shared by the receiver, rendering and the JVM tests. No Android imports. */
internal enum class Display { STATE, SAVING, OFFLINE, TRANSFERRING, SENDING, NOT_SENT, UNCONFIRMED, OPEN_APP, UPDATE_APP }
internal enum class Failure { CONNECT, RESPONSE }
internal data class Outcome(val display: Display, val deleteKey: Boolean = false, val keepCommand: Boolean = false)
internal data class Command(val commandId: String, val action: String)
internal data class NotificationText(val title: String, val text: String)
internal object LockScreenLogic {
  fun settled(display: Display) = display == Display.STATE || display == Display.SAVING
  fun visible(status: String?, display: Display) = status != null && !(status == "stopped" && settled(display))
  fun clockRuns(status: String?, display: Display) = display == Display.OFFLINE && status in listOf("running", "paused") || status == "running" && settled(display)
  fun canSend(action: String, appBlocked: Boolean, ownCapturePending: Boolean, hasKey: Boolean) =
    hasKey && !ownCapturePending && (!appBlocked || action == "retry")
  fun receiverDeadline(received: Long, confirmedColdStart: Long?) = (confirmedColdStart ?: received) + 6500

  fun command(status: String, pending: Command?, action: String, createId: () -> String): Command? {
    if (action == "retry") return pending
    if (pending != null || !allowed(status, action)) return null
    return Command(createId(), action)
  }
  fun response(code: Int, validState: Boolean = false, stopped: Boolean = false, failure: Failure? = null, archivePending: Boolean = false): Outcome = when {
    failure == Failure.CONNECT -> Outcome(Display.NOT_SENT, keepCommand = true)
    failure == Failure.RESPONSE -> Outcome(Display.UNCONFIRMED, keepCommand = true)
    code == 200 && validState -> Outcome(if (archivePending) Display.SAVING else Display.STATE, deleteKey = stopped)
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
  fun notificationText(target: String, status: String?, display: Display, seconds: Long, startedAt: Long?, breakStartedAt: Long?): NotificationText {
    if (display == Display.OFFLINE) return NotificationText(target,
      (if(status == "paused") "Pause seit ${berlin(requireNotNull(breakStartedAt))}" else "Läuft seit ${berlin(requireNotNull(startedAt))}") + " · offline gespeichert")
    if (!settled(display)) return NotificationText(target, message(display))
    val content = when (status) {
      "stopped" -> NotificationText("Zeit beendet · ${duration(seconds)}", target)
      "paused" -> NotificationText(target, "Pause seit ${berlin(requireNotNull(breakStartedAt))} · ${duration(seconds)} gearbeitet")
      "running" -> NotificationText(target, "Läuft seit ${berlin(requireNotNull(startedAt))}")
      else -> NotificationText(target, duration(seconds))
    }
    return if (display == Display.SAVING) content.copy(text = content.text + " · wird gesichert") else content
  }
  fun actionLabel(action: String): String = when (action) {
    "pause" -> "Pause starten"
    "resume" -> "Pause beenden"
    "stop" -> "Zeit beenden"
    "retry" -> "Erneut senden"
    else -> error("Unknown lock-screen action")
  }
  fun message(display: Display): String = when (display) {
    Display.STATE -> ""
    Display.SAVING -> "wird gesichert"
    Display.OFFLINE -> "offline gespeichert"
    Display.TRANSFERRING -> "Wird übertragen …"
    Display.SENDING -> "Wird gesendet …"
    Display.NOT_SENT -> "Nicht gesendet · kein Netz"
    Display.UNCONFIRMED -> "Noch nicht bestätigt"
    Display.OPEN_APP -> "Bitte App öffnen"
    Display.UPDATE_APP -> "Bitte App aktualisieren"
  }
}
