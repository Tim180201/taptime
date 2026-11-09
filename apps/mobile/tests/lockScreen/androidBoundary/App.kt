package android.app
import android.content.Context
import android.content.Intent
class Notification {
  val texts = mutableMapOf<String, String>()
  var visibility = 0
  companion object { const val VISIBILITY_PUBLIC = 1 }
}
class NotificationChannel(val id: String, val name: String, val importance: Int) {
  var lockscreenVisibility = 0
  fun setSound(sound: Any?, attributes: Any?) {}
  fun enableVibration(enabled: Boolean) {}
}
class NotificationManager {
  var posted: Notification? = null
  fun notify(id: Int, notification: Notification) { posted = notification }
  fun cancel(id: Int) { posted = null }
  fun areNotificationsEnabled() = true
  fun getNotificationChannel(id: String): NotificationChannel? = null
  fun createNotificationChannel(channel: NotificationChannel) {}
  fun canPostPromotedNotifications() = true
  companion object { const val IMPORTANCE_NONE = 0; const val IMPORTANCE_DEFAULT = 3 }
}
class PendingIntent {
  companion object {
    const val FLAG_UPDATE_CURRENT = 1; const val FLAG_IMMUTABLE = 2
    fun getActivity(context: Context, request: Int, intent: Intent, flags: Int) = PendingIntent()
    fun getBroadcast(context: Context, request: Int, intent: Intent, flags: Int) = PendingIntent()
  }
}
