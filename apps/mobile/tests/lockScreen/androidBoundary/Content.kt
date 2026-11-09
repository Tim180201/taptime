package android.content
import android.app.NotificationManager
import android.net.Uri
class Context {
  val manager = NotificationManager()
  val packageName = "com.taptime.test"
  val packageManager = PackageManager()
  fun <T> getSystemService(type: Class<T>): T = type.cast(manager)
  fun getColor(id: Int) = id
}
class PackageManager { fun getLaunchIntentForPackage(name: String): Intent? = Intent() }
class Intent() {
  constructor(context: Context, type: Class<*>): this()
  fun setAction(action: String) = this
  fun setData(uri: Uri) = this
  fun addFlags(flags: Int) = this
  companion object { const val ACTION_VIEW = "view"; const val FLAG_ACTIVITY_SINGLE_TOP = 1; const val FLAG_ACTIVITY_CLEAR_TOP = 2 }
}
