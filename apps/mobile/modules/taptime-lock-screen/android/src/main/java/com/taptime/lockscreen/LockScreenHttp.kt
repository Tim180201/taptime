package com.taptime.lockscreen

import android.os.SystemClock
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

internal data class HttpResult(val code: Int = 0, val body: String? = null, val failure: Failure? = null)
internal object LockScreenHttp {
  private val network = Executors.newCachedThreadPool { task -> Thread(task, "lock-screen-http").apply { isDaemon = true } }
  // Native fetch: no shared cookies, redirects, login interceptor, or membership header.
  fun post(baseUrl: String, path: String, bearer: String, appVersion: String, body: String, deadline: Long): HttpResult {
    val connection = AtomicReference<HttpURLConnection?>()
    val cancelled = AtomicBoolean(false)
    val sent = AtomicBoolean(false)
    val task = network.submit<HttpResult> {
      var http: HttpURLConnection? = null
      try {
        val url = URL(URL(baseUrl), path)
        require(url.protocol == "https")
        http = url.openConnection() as HttpURLConnection
        connection.set(http)
        http.instanceFollowRedirects = false
        http.connectTimeout = 3000
        http.readTimeout = 3000
        http.requestMethod = "POST"
        http.doOutput = true
        http.useCaches = false
        http.setRequestProperty("Authorization", "Bearer $bearer")
        http.setRequestProperty("Content-Type", "application/json")
        http.setRequestProperty("Accept", "application/json")
        http.setRequestProperty("X-TapTime-App", appVersion)
        val bytes = body.toByteArray(Charsets.UTF_8)
        http.setFixedLengthStreamingMode(bytes.size)
        if (cancelled.get() || SystemClock.elapsedRealtime() >= deadline) return@submit HttpResult(failure = Failure.CONNECT)
        http.connect()
        if (cancelled.get() || SystemClock.elapsedRealtime() >= deadline) return@submit HttpResult(failure = Failure.CONNECT)
        sent.set(true) // From here the server may have committed, even without a response.
        http.outputStream.use { it.write(bytes) }
        val code = http.responseCode
        if (code != 200) return@submit HttpResult(code)
        if (!http.contentType.orEmpty().substringBefore(';').trim().equals("application/json", true)) return@submit HttpResult(failure = Failure.RESPONSE)
        val output = ByteArrayOutputStream()
        http.inputStream.use { input ->
          val buffer = ByteArray(4096)
          while (true) {
            if (cancelled.get() || SystemClock.elapsedRealtime() >= deadline) return@submit HttpResult(failure = Failure.RESPONSE)
            val count = input.read(buffer)
            if (count < 0) break
            if (output.size() + count > 16 * 1024) return@submit HttpResult(failure = Failure.RESPONSE)
            output.write(buffer, 0, count)
          }
        }
        HttpResult(code, output.toString("UTF-8"))
      } catch (_: Exception) {
        HttpResult(failure = if (sent.get()) Failure.RESPONSE else Failure.CONNECT)
      } finally { http?.disconnect() }
    }
    return try {
      task.get((deadline - SystemClock.elapsedRealtime()).coerceAtLeast(1), TimeUnit.MILLISECONDS)
    } catch (_: Exception) {
      cancelled.set(true)
      // DNS can ignore thread interruption. A late connection checks cancellation before sending.
      task.cancel(true)
      network.execute { connection.get()?.disconnect() }
      HttpResult(failure = if (sent.get()) Failure.RESPONSE else Failure.CONNECT)
    }
  }
}
