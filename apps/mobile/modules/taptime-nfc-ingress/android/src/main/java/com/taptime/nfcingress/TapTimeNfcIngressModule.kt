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
  val elapsedRealtimeMilliseconds: Long,
  val processStartElapsedRealtimeMilliseconds: Long,
  val intentOrigin: String
)

object TapTimeNfcIngress {
  private const val PROCESS_START_INTENT = "process_start_intent"
  private const val ACTIVITY_DELIVERY_INTENT = "activity_delivery_intent"

  private var pending: PendingNfcCapture? = null
  private var processStartIntentWindowOpen = true

  @Synchronized
  fun captureActivityCreateIntent(intent: Intent?, isRestoredCreation: Boolean) {
    val isHistoryLaunch = ((intent?.flags ?: 0)
      and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0
    val isNfcIntent = isNfcIntent(intent)
    if (isHistoryLaunch || (isRestoredCreation && !isNfcIntent)) {
      stripNfcExtras(intent)
      return
    }
    captureIntent(intent, claimProcessStartIntentOrigin())
  }

  @Synchronized
  fun captureActivityDeliveryIntent(intent: Intent?) {
    captureIntent(intent, claimProcessStartIntentOrigin())
  }

  @Synchronized
  fun closeProcessStartIntentWindow() {
    processStartIntentWindowOpen = false
  }

  private fun claimProcessStartIntentOrigin(): String {
    if (!processStartIntentWindowOpen) return ACTIVITY_DELIVERY_INTENT
    processStartIntentWindowOpen = false
    return PROCESS_START_INTENT
  }

  private fun isNfcIntent(intent: Intent?): Boolean {
    // Android 16 dispatches HTTP(S) NFC tags as ACTION_VIEW and retains EXTRA_TAG
    // (Android documentation: "Tag dispatch"). Ordinary links carry no tag evidence.
    if (intent == null || !intent.hasExtra(NfcAdapter.EXTRA_TAG)) return false
    return when (intent.action) {
      NfcAdapter.ACTION_TECH_DISCOVERED,
      NfcAdapter.ACTION_NDEF_DISCOVERED,
      Intent.ACTION_VIEW -> true
      else -> false
    }
  }

  private fun captureIntent(intent: Intent?, intentOrigin: String) {
    if (intent == null || !isNfcIntent(intent)) return
    val tag = intent.getParcelableExtra<Tag>(NfcAdapter.EXTRA_TAG)
    stripNfcExtras(intent)
    if (pending != null) return
    val uid = tag?.id?.copyOf() ?: return
    if (uid.isEmpty() || uid.size > 32) return
    pending = PendingNfcCapture(
      uid,
      System.currentTimeMillis(),
      SystemClock.elapsedRealtime(),
      android.os.Process.getStartElapsedRealtime(),
      intentOrigin
    )
  }

  private fun stripNfcExtras(intent: Intent?) {
    if (intent == null || !isNfcIntent(intent)) return
    intent.removeExtra(NfcAdapter.EXTRA_TAG)
    intent.removeExtra(NfcAdapter.EXTRA_ID)
    intent.removeExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
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
  fun pendingEvidence(): PendingNfcCapture? = pending

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
      val capture = TapTimeNfcIngress.pendingEvidence() ?: return@Function null
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
        "intentOrigin" to capture.intentOrigin,
        "processStartElapsedRealtimeMilliseconds" to
          capture.processStartElapsedRealtimeMilliseconds.toDouble(),
        "elapsedRealtimeMilliseconds" to capture.elapsedRealtimeMilliseconds.toDouble()
      )
    }

    Function("clear") {
      TapTimeNfcIngress.clear()
    }

    Function("closeProcessStartIntentWindow") {
      TapTimeNfcIngress.closeProcessStartIntentWindow()
    }
  }
}
