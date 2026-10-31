package com.taptime.lockscreen

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONObject

internal object LockScreenNotification {
  private const val CHANNEL = "taptime_running_time_v1"
  private const val ID = 104
  fun cancel(context: Context) { context.getSystemService(NotificationManager::class.java).cancel(ID) }
  fun allowed(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    return manager.areNotificationsEnabled() && (Build.VERSION.SDK_INT < 26 || manager.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE)
  }
  private fun open(context: Context, request: Int): PendingIntent {
    // Activity PendingIntent directly; the receiver never starts an Activity (Android 12+).
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)!!
      .setAction(Intent.ACTION_VIEW).setData(Uri.parse("taptime://lock-screen/capture"))
      .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(context, request, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  fun show(context: Context, session: JSONObject) {
    val state = session.optJSONObject("state")
    val display = runCatching { Display.valueOf(session.getString("display")) }.getOrDefault(Display.OPEN_APP)
    val manager = context.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) {
      val channel = NotificationChannel(CHANNEL, "Laufende Zeit", NotificationManager.IMPORTANCE_DEFAULT).apply {
        setSound(null, null); enableVibration(false); lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      manager.createNotificationChannel(channel)
    }
    if (!LockScreenLogic.visible(state?.optString("status"), display)) { cancel(context); return }
    if (!allowed(context)) return
    val now = System.currentTimeMillis()
    val status = state?.optString("status")
    val running = LockScreenLogic.clockRuns(status, display)
    val seconds = state?.optLong("workDurationSeconds") ?: 0
    val elapsed = LockScreenLogic.elapsed(seconds, timestamp(state?.optString("asOf").orEmpty()) ?: now, now, running)
    val target = state?.optJSONObject("target")?.optString("displayName") ?: "Laufende Zeit"
    val content = LockScreenLogic.notificationText(target, status, display, seconds,
      timestamp(state?.optString("startedAt").orEmpty()), timestamp(state?.optString("breakStartedAt").orEmpty()))
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.taptime_notification).setColor(context.getColor(R.color.taptime_notification_accent))
      .setContentTitle(content.title).setContentText(content.text)
      .setVisibility(Notification.VISIBILITY_PUBLIC).setOnlyAlertOnce(true)
      .setSound(null).setVibrate(longArrayOf()).setDefaults(0)
      .setOngoing(true).setAutoCancel(false).setContentIntent(open(context, 1040))
      .setDeleteIntent(PendingIntent.getBroadcast(context, 1045,
        Intent(context, LockScreenActionReceiver::class.java).setAction("dismiss"),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      .setShowWhen(running).setUsesChronometer(running)
    if (running) builder.setWhen(now - elapsed * 1000)
    // Expo already supplies AndroidX Core 1.17; its official API works with compileSdk 36.
    // The platform Builder method itself requires 36.1. Never prompt or change system settings here.
    if (Build.VERSION.SDK_INT >= 36 && manager.canPostPromotedNotifications()) {
      builder.setRequestPromotedOngoing(true)
      if (status == "paused" && LockScreenLogic.settled(display)) builder.setShortCriticalText(LockScreenLogic.duration(seconds))
    }
    val actions = when (display) {
      Display.STATE, Display.SAVING, Display.OFFLINE -> listOf(if (status == "paused") "resume" else "pause", "stop")
      Display.NOT_SENT, Display.UNCONFIRMED -> listOf("retry")
      else -> emptyList()
    }
    for (action in actions) {
      val request = when (action) { "pause" -> 1041; "resume" -> 1042; "stop" -> 1043; else -> 1044 }
      val canSend = LockScreenLogic.canSend(action, session.optBoolean("appBlocked", true), session.optBoolean("ownCapturePending"), session.has("capability"))
      val intent = if (!canSend) open(context, request) else PendingIntent.getBroadcast(context, request,
        Intent(context, LockScreenActionReceiver::class.java).setAction(action)
          .setData(Uri.parse("taptime-lock-screen:${session.getString("nonce")}:$action")),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val button = NotificationCompat.Action.Builder(null, LockScreenLogic.actionLabel(action), intent)
      if (Build.VERSION.SDK_INT >= 31) button.setAuthenticationRequired(false)
      builder.addAction(button.build())
    }
    try { manager.notify(ID, builder.build()) } catch (_: SecurityException) { /* Permission may be revoked concurrently. */ }
  }
}
