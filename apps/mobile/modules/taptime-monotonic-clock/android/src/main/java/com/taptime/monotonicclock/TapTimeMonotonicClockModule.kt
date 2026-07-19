package com.taptime.monotonicclock

import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest

class TapTimeMonotonicClockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TapTimeMonotonicClock")

    Function("sample") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android application context is unavailable")
      val bootCount = Settings.Global.getInt(
        context.contentResolver,
        Settings.Global.BOOT_COUNT,
        -1
      )
      if (bootCount < 0) {
        throw IllegalStateException("Android boot marker is unavailable")
      }
      val markerInput = "${Build.FINGERPRINT}:$bootCount"
      val marker = MessageDigest.getInstance("SHA-256")
        .digest(markerInput.toByteArray(Charsets.UTF_8))
        .joinToString(separator = "") { byte ->
          ((byte.toInt() and 0xff) + 0x100).toString(16).substring(1)
        }
      mapOf(
        "bootMarker" to marker,
        "elapsedRealtimeMilliseconds" to SystemClock.elapsedRealtime().toDouble()
      )
    }
  }
}
