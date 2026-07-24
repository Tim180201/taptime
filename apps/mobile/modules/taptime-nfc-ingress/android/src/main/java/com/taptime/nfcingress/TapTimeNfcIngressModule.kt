package com.taptime.nfcingress

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.SystemClock
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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

    Function("clear") {
      TapTimeNfcIngress.clear()
    }
  }
}
