package com.taptime.lockscreen

import java.time.Instant
import java.util.TimeZone

fun verifyNotificationPresentation() {
  val target = "Beispielprojekt"
  val start = Instant.parse("2026-10-21T05:24:00Z").toEpochMilli()
  val pause = Instant.parse("2026-10-21T06:30:00Z").toEpochMilli()
  val previousZone = TimeZone.getDefault()
  try {
    // The device's timezone must not change the business clock (D-056).
    TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Honolulu"))
    check(LockScreenLogic.notificationText(target, "running", Display.STATE, 3960, start, null) ==
      NotificationText(target, "Läuft seit 07:24"))
    check(LockScreenLogic.notificationText(target, "paused", Display.STATE, 3960, start, pause) ==
      NotificationText(target, "Pause seit 08:30 · 1:06 h gearbeitet"))
    check(LockScreenLogic.notificationText(target, "stopped", Display.STATE, 13320, start, null) ==
      NotificationText("Zeit beendet · 3:42 h", target))
    check(LockScreenLogic.notificationText(target, "paused", Display.SAVING, 3960, start, pause).text ==
      "Pause seit 08:30 · 1:06 h gearbeitet · wird gesichert")
    check(LockScreenLogic.notificationText(target, "running", Display.SAVING, 3960, start, null).text ==
      "Läuft seit 07:24 · wird gesichert")
    val winter = Instant.parse("2026-12-21T06:24:00Z").toEpochMilli()
    check(LockScreenLogic.notificationText(target, "running", Display.STATE, 0, winter, null).text == "Läuft seit 07:24")
  } finally { TimeZone.setDefault(previousZone) }

  val notices = mapOf(
    Display.TRANSFERRING to "Wird übertragen …",
    Display.SENDING to "Wird gesendet …",
    Display.NOT_SENT to "Nicht gesendet · kein Netz",
    Display.UNCONFIRMED to "Noch nicht bestätigt",
    Display.OPEN_APP to "Bitte App öffnen",
    Display.UPDATE_APP to "Bitte App aktualisieren",
  )
  check(notices.keys == Display.values().toSet() - setOf(Display.STATE, Display.SAVING, Display.OFFLINE))
  // A hint always belongs below the target, even if the last confirmed state was stopped.
  for ((display, text) in notices) for (status in listOf("running", "paused", "stopped", null)) {
    check(LockScreenLogic.notificationText(target, status, display, 3960, null, null) == NotificationText(target, text))
    check(!LockScreenLogic.clockRuns(status, display))
  }
  check(LockScreenLogic.notificationText(target, "running", Display.OFFLINE, 3960, start, null).text == "Läuft seit 07:24 · offline gespeichert")
  check(LockScreenLogic.notificationText(target, "paused", Display.OFFLINE, 3960, start, pause).text == "Pause seit 08:30 · offline gespeichert")
  check(LockScreenLogic.clockRuns("running", Display.OFFLINE))
  check(LockScreenLogic.clockRuns("paused", Display.OFFLINE))
  check(!LockScreenLogic.canSend("pause", true, true, false))
  check(LockScreenLogic.clockRuns("running", Display.STATE))
  check(!LockScreenLogic.clockRuns("paused", Display.STATE))
  check(!LockScreenLogic.clockRuns("stopped", Display.STATE))
  check(LockScreenLogic.actionLabel("pause") == "Pause starten")
  check(LockScreenLogic.actionLabel("resume") == "Pause beenden")
  check(LockScreenLogic.actionLabel("stop") == "Zeit beenden")
  check(LockScreenLogic.actionLabel("retry") == "Erneut senden")
  println("T-104d notification texts, Berlin time and action labels verified")
}
