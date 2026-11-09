package androidx.core.app
import android.app.Notification
import android.app.PendingIntent
import android.content.Context
// Recording boundary only: the unmodified production renderer builds all content.
// No formatting, redaction, clock, action or visibility decision is duplicated here.
object NotificationCompat {
  class Builder(context: Context, channel: String) {
    private val notification = Notification()
    fun setContentTitle(text: CharSequence) = apply { notification.texts["title"] = text.toString() }
    fun setContentText(text: CharSequence) = apply { notification.texts["text"] = text.toString() }
    fun setTicker(text: CharSequence) = apply { notification.texts["ticker"] = text.toString() }
    fun setSubText(text: CharSequence) = apply { notification.texts["subText"] = text.toString() }
    fun setContentInfo(text: CharSequence) = apply { notification.texts["info"] = text.toString() }
    fun setShortCriticalText(text: String) = apply { notification.texts["shortCriticalText"] = text }
    fun addAction(action: Action) = apply { notification.texts["action" + notification.texts.size] = action.title }
    fun setVisibility(value: Int) = apply { notification.visibility = value }
    fun setSmallIcon(id: Int) = this
    fun setColor(color: Int) = this
    fun setOnlyAlertOnce(value: Boolean) = this
    fun setSound(value: Any?) = this
    fun setVibrate(value: LongArray) = this
    fun setDefaults(value: Int) = this
    fun setOngoing(value: Boolean) = this
    fun setAutoCancel(value: Boolean) = this
    fun setContentIntent(value: PendingIntent) = this
    fun setDeleteIntent(value: PendingIntent) = this
    fun setShowWhen(value: Boolean) = this
    fun setUsesChronometer(value: Boolean) = this
    fun setWhen(value: Long) = this
    fun setRequestPromotedOngoing(value: Boolean) = this
    fun build() = notification
  }
  class Action(val title: String) {
    class Builder(icon: Any?, private val title: String, intent: PendingIntent) {
      fun setAuthenticationRequired(value: Boolean) = this
      fun build() = Action(title)
    }
  }
}
