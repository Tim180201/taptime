package com.taptime.nfcingress

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest

data class PendingNfcCapture(
  val uid: ByteArray,
  val wallClockMilliseconds: Long,
  val elapsedRealtimeMilliseconds: Long
)

object TapTimeNfcIngress {
  private var pending: PendingNfcCapture? = null

  @Synchronized
  fun captureIntent(intent: Intent?) {
    if (intent?.action != NfcAdapter.ACTION_TECH_DISCOVERED) return
    val tag = intent.getParcelableExtra<Tag>(NfcAdapter.EXTRA_TAG)
    intent.removeExtra(NfcAdapter.EXTRA_TAG)
    intent.removeExtra(NfcAdapter.EXTRA_ID)
    intent.removeExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
    if (pending != null) return
    val uid = tag?.id?.copyOf() ?: return
    if (uid.isEmpty() || uid.size > 32) return
    pending = PendingNfcCapture(
      uid,
      System.currentTimeMillis(),
      SystemClock.elapsedRealtime()
    )
  }

  @Synchronized
  fun consume(): PendingNfcCapture? {
    val captured = pending
    pending = null
    return captured
  }

  @Synchronized
  fun hasPending(): Boolean = pending != null

  @Synchronized
  fun pendingElapsedRealtimeMilliseconds(): Long? = pending?.elapsedRealtimeMilliseconds

  @Synchronized
  fun clear() {
    pending = null
  }
}

class TapTimeNfcIngressModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TapTimeNfcIngress")

    Function("consume") {
      TapTimeNfcIngress.consume()?.let { capture ->
        mapOf(
          "uid" to capture.uid.map { byte -> byte.toInt() and 0xff },
          "wallClockMilliseconds" to capture.wallClockMilliseconds.toDouble(),
          "elapsedRealtimeMilliseconds" to capture.elapsedRealtimeMilliseconds.toDouble()
        )
      }
    }

    Function("hasPending") {
      TapTimeNfcIngress.hasPending()
    }

    Function("readPendingEvidence") {
      val elapsedRealtimeMilliseconds =
        TapTimeNfcIngress.pendingElapsedRealtimeMilliseconds()
          ?: return@Function null
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
      val bootMarker = MessageDigest.getInstance("SHA-256")
        .digest(markerInput.toByteArray(Charsets.UTF_8))
        .joinToString(separator = "") { byte ->
          ((byte.toInt() and 0xff) + 0x100).toString(16).substring(1)
        }
      mapOf(
        "bootMarker" to bootMarker,
        "elapsedRealtimeMilliseconds" to elapsedRealtimeMilliseconds.toDouble()
      )
    }

    Function("clear") {
      TapTimeNfcIngress.clear()
    }
  }
}
