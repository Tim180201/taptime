package com.taptime.feedback

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors
import kotlin.math.PI
import kotlin.math.sin

class TapTimeFeedbackModule : Module() {
  private val audioExecutor = Executors.newSingleThreadExecutor()

  override fun definition() = ModuleDefinition {
    Name("TapTimeFeedback")

    AsyncFunction("perform") { profile: Map<String, Any> ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android application context is unavailable")
      val vibrationTimings = profile.numberList("vibrationTimingsMs").map(Number::toLong)
      val vibrationAmplitudes = profile.numberList("vibrationAmplitudes").map(Number::toInt)
      val toneFrequencies = profile.numberList("toneFrequenciesHz").map(Number::toDouble)
      val toneDurations = profile.numberList("toneDurationsMs").map(Number::toInt)
      val toneVolume = profile.number("toneVolume").toDouble()

      validateProfile(
        vibrationTimings,
        vibrationAmplitudes,
        toneFrequencies,
        toneDurations,
        toneVolume,
      )
      vibrate(context, vibrationTimings, vibrationAmplitudes)

      val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioExecutor.execute {
        if (audioManager.ringerMode == AudioManager.RINGER_MODE_NORMAL) {
          playToneSequence(toneFrequencies, toneDurations, toneVolume)
        }
      }
    }

    OnDestroy {
      audioExecutor.shutdownNow()
    }
  }

  private fun vibrate(
    context: Context,
    timings: List<Long>,
    amplitudes: List<Int>,
  ) {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
      manager.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    if (!vibrator.hasVibrator()) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(
        timings.toLongArray(),
        amplitudes.toIntArray(),
        -1,
      ))
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(timings.toLongArray(), -1)
    }
  }

  private fun playToneSequence(
    frequencies: List<Double>,
    durations: List<Int>,
    volume: Double,
  ) {
    val sampleRate = 16_000
    val gapMilliseconds = 24
    val samples = ArrayList<Short>()
    frequencies.zip(durations).forEachIndexed { index, (frequency, duration) ->
      val sampleCount = sampleRate * duration / 1_000
      for (sampleIndex in 0 until sampleCount) {
        val envelope = when {
          sampleIndex < sampleRate / 100 -> sampleIndex.toDouble() / (sampleRate / 100)
          sampleIndex > sampleCount - sampleRate / 100 ->
            (sampleCount - sampleIndex).toDouble() / (sampleRate / 100)
          else -> 1.0
        }.coerceIn(0.0, 1.0)
        samples.add((sin(2.0 * PI * frequency * sampleIndex / sampleRate)
          * Short.MAX_VALUE * envelope).toInt().toShort())
      }
      if (index < frequencies.lastIndex) {
        repeat(sampleRate * gapMilliseconds / 1_000) { samples.add(0) }
      }
    }
    val pcm = ShortArray(samples.size) { samples[it] }
    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val format = AudioFormat.Builder()
      .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
      .setSampleRate(sampleRate)
      .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
      .build()
    val track = AudioTrack(
      attributes,
      format,
      pcm.size * Short.SIZE_BYTES,
      AudioTrack.MODE_STATIC,
      AudioManager.AUDIO_SESSION_ID_GENERATE,
    )
    try {
      track.write(pcm, 0, pcm.size)
      track.setVolume(volume.toFloat())
      track.play()
      Thread.sleep(durations.sum().toLong() + gapMilliseconds * (durations.size - 1) + 32L)
    } finally {
      track.release()
    }
  }

  private fun validateProfile(
    vibrationTimings: List<Long>,
    vibrationAmplitudes: List<Int>,
    toneFrequencies: List<Double>,
    toneDurations: List<Int>,
    toneVolume: Double,
  ) {
    require(vibrationTimings.isNotEmpty())
    require(vibrationTimings.size == vibrationAmplitudes.size)
    require(vibrationTimings.all { it >= 0L })
    require(vibrationAmplitudes.all { it in 0..255 })
    require(toneFrequencies.isNotEmpty())
    require(toneFrequencies.size == toneDurations.size)
    require(toneFrequencies.all { it in 100.0..2_000.0 })
    require(toneDurations.all { it in 24..1_000 })
    require(toneVolume in 0.0..1.0)
  }

  private fun Map<String, Any>.numberList(key: String): List<Number> {
    val value = this[key] as? List<*>
      ?: throw IllegalArgumentException("$key is required")
    return value.map {
      it as? Number ?: throw IllegalArgumentException("$key must contain numbers")
    }
  }

  private fun Map<String, Any>.number(key: String): Number =
    this[key] as? Number ?: throw IllegalArgumentException("$key must be a number")
}
