package org.json
class JSONObject {
  private val values = linkedMapOf<String, Any?>()
  fun put(name: String, value: Any?): JSONObject { values[name] = value; return this }
  fun has(name: String) = values.containsKey(name)
  fun get(name: String): Any = values[name]!!
  fun getString(name: String) = get(name) as String
  fun getJSONObject(name: String) = get(name) as JSONObject
  fun optJSONObject(name: String) = values[name] as? JSONObject
  fun optString(name: String) = values[name] as? String ?: ""
  fun optLong(name: String) = (values[name] as? Number)?.toLong() ?: 0L
  fun optBoolean(name: String, default: Boolean = false) = values[name] as? Boolean ?: default
  fun isNull(name: String) = values[name] == null
  fun keys() = values.keys.iterator()
}
