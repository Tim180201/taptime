package com.taptime.lockscreen

import android.app.Notification
import android.content.Context
import org.json.JSONObject
import java.io.File
import java.util.Locale

class LockScreenActionReceiver
object R { object drawable { const val taptime_notification = 1 }; object color { const val taptime_notification_accent = 2 } }

fun main(args: Array<String>) {
  // Device locale must not change the agreed uppercase rule.
  Locale.setDefault(Locale.forLanguageTag("tr-TR"))
  val rows = File(args.single()).readLines().filter { it.isNotEmpty() }.map { it.split('\t') }
  for ((type, name, expected) in rows) for (status in listOf("running", "paused", "stopped")) for (display in Display.values()) {
    val target = JSONObject().put("targetType", type).put("targetId", "target").put("displayName", name)
    val state = JSONObject().put("target", target).put("status", status).put("workDurationSeconds", 3600L)
      .put("asOf", "2026-10-31T10:00:00.000Z").put("startedAt", "2026-10-31T08:00:00.000Z")
      .put("breakStartedAt", if (status == "paused") "2026-10-31T09:00:00.000Z" else null)
    val session = JSONObject().put("state", state).put("display", display.name).put("nonce", "nonce")
      .put("appBlocked", display == Display.OFFLINE).put("capability", "secret")
    val context = Context()
    LockScreenNotification.show(context, session)
    val notification = context.manager.posted
    if (status == "stopped" && display in listOf(Display.STATE, Display.SAVING)) {
      check(notification == null) // D-154: no completed notification remains.
    } else {
      check(notification != null)
      check(notification.texts["title"] == expected) { "$type / $name / $status / $display: ${notification.texts}" }
      if (type == "customer") check(notification.texts.values.none { it.contains(name) })
      check(notification.visibility == Notification.VISIBILITY_PUBLIC)
      if (display in listOf(Display.STATE, Display.SAVING, Display.OFFLINE)) {
        check(notification.texts.values.contains("Zeit beenden"))
      }
    }
    check(target.getString("displayName") == name) // Storage/JS projection retains the full name.
  }
  println("T141 notification boundary: all text fields and states verified")
}
