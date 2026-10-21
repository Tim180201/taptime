package com.taptime.lockscreen

import org.json.JSONObject
import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

internal fun timestamp(value: String): Long? {
  if (!Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z").matches(value)) return null
  val position = ParsePosition(0)
  val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC"); isLenient = false
  }.parse(value, position)
  return if (position.index == value.length) date?.time else null
}
internal fun validState(state: JSONObject?): Boolean {
  if (state == null) return false
  return try {
    val fields = setOf("timeEntryId", "status", "startedAt", "breakStartedAt", "stoppedAt", "asOf", "workDurationSeconds", "breakDurationSeconds", "target")
    require(state.keys().asSequence().toSet() == fields)
    require(uuid(state.getString("timeEntryId")))
    val start = timestamp(state.getString("startedAt")) ?: return false
    val asOf = timestamp(state.getString("asOf")) ?: return false
    require(asOf >= start)
    for (name in listOf("workDurationSeconds", "breakDurationSeconds")) {
      val seconds = state.get(name)
      require(seconds is Number && seconds.toDouble() >= 0 && seconds.toDouble() <= 9007199254740991.0 && seconds.toDouble() == seconds.toLong().toDouble())
    }
    val target = state.getJSONObject("target")
    require(target.keys().asSequence().toSet() == setOf("targetType", "targetId", "displayName"))
    require(target.getString("targetType") in listOf("customer", "project", "general_work"))
    require(uuid(target.getString("targetId")) && target.getString("displayName").isNotEmpty())
    when (state.getString("status")) {
      "running" -> state.isNull("breakStartedAt") && state.isNull("stoppedAt")
      "paused" -> state.isNull("stoppedAt") && timestamp(state.getString("breakStartedAt"))?.let { it in start..asOf } == true
      "stopped" -> state.isNull("breakStartedAt") && timestamp(state.getString("stoppedAt"))?.let { it in start..asOf } == true
      else -> false
    }
  } catch (_: Exception) { false }
}
internal fun uuid(value: String) = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}").matches(value)
