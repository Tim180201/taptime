package com.taptime.lockscreen

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.SystemClock
import org.json.JSONObject
import java.util.UUID

/** All storage transitions are serialized, network calls never hold the lock. Late responses use CAS. */
internal object LockScreenRuntime {
  @Volatile var changed: (() -> Unit)? = null
  private var previewOwner: String? = null
  private var previewState: JSONObject? = null
  private var previewUntil: Long? = null
  private fun clearPreview() { previewOwner = null; previewState = null; previewUntil = null }
  @Synchronized fun preview(context: Context, owner: String, stateText: String?, validUntil: String?): Boolean {
    val current = session(LockScreenStore(context).read()) ?: return false
    if (current.optString("owner") != owner) return false
    if (validUntil == null) { clearPreview(); LockScreenNotification.show(context, current); return true }
    val until = timestamp(validUntil) ?: return false
    if (until <= System.currentTimeMillis()) return false
    val state = stateText?.let { JSONObject(it) }
    if (state != null && !validState(state)) return false
    previewOwner = owner; previewState = state; previewUntil = until
    restoreNotification(context)
    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ synchronized(this) {
      if (previewUntil == until) { clearPreview(); LockScreenNotification.cancel(context) }
    } }, until - System.currentTimeMillis())
    return true
  }
  private val inFlight = mutableSetOf<String>()
  private fun id() = UUID.randomUUID().toString()
  private fun session(root: JSONObject) = root.optJSONObject("session")
  private fun save(context: Context, root: JSONObject, notify: Boolean = false) {
    val current = session(root)
    LockScreenStore(context).write(root)
    if(previewOwner != null) { restoreNotification(context); if(notify) changed?.invoke(); return }
    current?.let { LockScreenNotification.show(context, it) } ?: LockScreenNotification.cancel(context)
    if (notify) changed?.invoke()
  }
  @Synchronized fun bind(context: Context, owner: String) {
    val root = LockScreenStore(context).read()
    if (session(root)?.optString("owner") == owner) return
    clearPreview()
    root.put("session", JSONObject().put("owner", owner).put("sessionId", id()).put("revision", id())
      .put("nonce", id()).put("display", Display.OPEN_APP.name).put("appBlocked", true))
    LockScreenStore(context).write(root)
    LockScreenNotification.cancel(context)
  }
  @Synchronized fun restoreNotification(context: Context) {
    // Re-render the latest stored state under the same lock as stop/sign-out. No request, booking or sound.
    val current = session(LockScreenStore(context).read())
    if (previewOwner != null && current?.optString("owner") == previewOwner && (previewUntil ?: 0) > System.currentTimeMillis()) {
      val state = previewState
      if (state == null) { LockScreenNotification.cancel(context); return }
      val copy = JSONObject(current.toString()).put("state", state).put("display", Display.OFFLINE.name)
        .put("appBlocked", true).put("ownCapturePending", true)
      copy.remove("capability"); LockScreenNotification.show(context, copy); return
    }
    if (current != null) LockScreenNotification.show(context, current) else LockScreenNotification.cancel(context)
  }
  @Synchronized fun clear(context: Context) {
    clearPreview()
    val root = LockScreenStore(context).read(); root.remove("session")
    try { save(context, root, true) }
    catch (_: Exception) {
      LockScreenStore(context).erase(); LockScreenNotification.cancel(context); changed?.invoke()
    }
  }
  @Synchronized fun claimPermissionPrompt(context: Context): Boolean {
    val root = LockScreenStore(context).read()
    if (root.optBoolean("permissionAsked")) return false
    root.put("permissionAsked", true); LockScreenStore(context).write(root); return true
  }
  @Synchronized fun snapshot(context: Context): String {
    val root = LockScreenStore(context).read()
    val current = session(root)
    if (current == null) LockScreenNotification.cancel(context)
    if (current?.has("capability") == true && expired(current)) {
      current.remove("capability"); current.remove("expiresAt"); current.remove("pending")
      current.put("display", Display.OPEN_APP.name).put("revision", id())
      save(context, root)
    }
    val pendingId = current?.optJSONObject("pending")?.optString("commandId")
    if (current?.optString("display") == Display.SENDING.name && pendingId !in inFlight) {
      current.put("display", Display.UNCONFIRMED.name).put("revision", id())
      save(context, root)
    }
    // Explicit allowlist. Neither the capability nor the login token can cross this boundary.
    val safe = JSONObject().put("permissionGranted", LockScreenNotification.allowed(context))
      .put("permissionAsked", root.optBoolean("permissionAsked"))
    if (current != null) {
      for (field in listOf("owner", "revision", "state", "pending", "display", "ownCapturePending")) {
        if (current.has(field)) safe.put(field, current.get(field))
      }
    }
    return safe.toString()
  }
  private fun expired(current: JSONObject) = (timestamp(current.optString("expiresAt")) ?: 0) <= System.currentTimeMillis()
  @Synchronized fun suspend(context: Context) {
    val root = LockScreenStore(context).read(); val current = session(root) ?: return
    current.put("appBlocked", true).put("nonce", id())
    if (!current.has("pending") && current.optJSONObject("state")?.optString("status") != "stopped") current.put("sessionId", id())
    if (current.has("state")) save(context, root) else LockScreenStore(context).write(root)
  }
  @Synchronized fun awaitOwnCapture(context: Context) {
    val root = LockScreenStore(context).read(); val current = session(root) ?: return
    if (current.optBoolean("ownCapturePending")) return
    current.remove("pending"); current.remove("capability"); current.remove("expiresAt"); current.remove("stoppedNoticeUntil")
    current.put("ownCapturePending", true).put("appBlocked", true).put("display", Display.TRANSFERRING.name)
      .put("sessionId", id()).put("nonce", id())
    save(context, root)
  }
  @Synchronized fun project(context: Context, owner: String, stateText: String?, revision: String, discardPending: Boolean): Boolean {
    val root = LockScreenStore(context).read(); val current = session(root) ?: return false
    if (current.optString("owner") != owner || current.optString("revision") != revision) return false
    if (current.has("pending") && !discardPending) return false
    val state = stateText?.let { JSONObject(it) }
    if (state != null && !validState(state)) return false
    clearPreview()
    val previous = current.optJSONObject("state")
    val saving = current.optString("display") == Display.SAVING.name && previous?.optString("timeEntryId") == state?.optString("timeEntryId")
    current.remove("stoppedNoticeUntil"); current.put("ownCapturePending", false)
    current.remove("pending"); current.remove("capability"); current.remove("expiresAt")
    current.put("sessionId", id()).put("nonce", id()).put("appBlocked", true)
    if (state == null) { current.remove("state"); LockScreenStore(context).write(root); LockScreenNotification.cancel(context) }
    else { current.put("state", state).put("display", if (saving) Display.SAVING.name else Display.STATE.name); save(context, root) }
    return true
  }
  fun issue(context: Context, owner: String, token: String, body: String, baseUrl: String, appVersion: String, revision: String): String {
    val stamp = synchronized(this) {
      val current = session(LockScreenStore(context).read()) ?: return "superseded"
      if (current.optString("owner") != owner || current.optString("revision") != revision || current.has("pending") || current.optBoolean("ownCapturePending")) return "superseded"
      current.getString("sessionId")
    }
    val response = LockScreenHttp.post(baseUrl, "/v1/lock-screen/capability", token, appVersion, body, SystemClock.elapsedRealtime() + 6500)
    return synchronized(this) {
      val root = LockScreenStore(context).read(); val current = session(root) ?: return@synchronized "superseded"
      if (current.optString("sessionId") != stamp || current.optString("revision") != revision || current.has("pending") || current.optBoolean("ownCapturePending")) return@synchronized "superseded"
      if (response.code == 401) {
        current.remove("capability"); current.remove("expiresAt"); current.remove("state")
        LockScreenStore(context).write(root); LockScreenNotification.cancel(context)
        return@synchronized "unauthorized"
      }
      val parsed = runCatching { JSONObject(response.body ?: "") }.getOrNull()
      val state = parsed?.optJSONObject("state")
      val capability = parsed?.optString("capability").orEmpty()
      val request = JSONObject(body)
      if (response.code != 200 || parsed?.optString("status") != "issued" || !validState(state)
        || state!!.optString("status") == "stopped" || state.optString("timeEntryId") != request.optString("timeEntryId")
        || !validArchiveStatus(parsed)
        || !Regex("[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]").matches(capability)
        || (timestamp(parsed.optString("expiresAt")) ?: 0) <= System.currentTimeMillis()) {
        return@synchronized if (response.code == 426) "update_required" else "unavailable"
      }
      current.put("capability", capability).put("expiresAt", parsed.getString("expiresAt"))
        .put("state", state).put("display", if (parsed.optString("archiveStatus") == "pending") Display.SAVING.name else Display.STATE.name).put("appBlocked", false)
        .put("baseUrl", baseUrl).put("appVersion", appVersion).put("nonce", id())
      save(context, root)
      "issued"
    }
  }
  private fun validArchiveStatus(value: JSONObject?) = value != null && (!value.has("archiveStatus") || value.opt("archiveStatus") in listOf("pending", "archived"))
  private fun connected(context: Context): Boolean {
    val manager = context.getSystemService(ConnectivityManager::class.java)
    val capabilities = manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }
  fun action(context: Context, action: String, nonce: String?, deadline: Long, fromApp: Boolean = false) {
    val operation = synchronized(this) {
      val root = LockScreenStore(context).read(); val current = session(root) ?: return
      if (current.optBoolean("ownCapturePending")) return
      if (!fromApp && (!LockScreenLogic.canSend(action, current.optBoolean("appBlocked", true),
        current.optBoolean("ownCapturePending"), current.has("capability")) || current.optString("nonce") != nonce)) return
      if (current.optString("display") == Display.SENDING.name) return
      if (expired(current) || !current.has("capability")) {
        current.remove("capability"); current.remove("expiresAt"); current.remove("pending")
        current.put("display", Display.OPEN_APP.name).put("revision", id()); save(context, root, true); return
      }
      val previous = current.optJSONObject("pending")?.let { Command(it.getString("commandId"), it.getString("action")) }
      val command = LockScreenLogic.command(current.optJSONObject("state")?.optString("status").orEmpty(), previous, action, ::id) ?: return
      val pending = JSONObject().put("commandId", command.commandId).put("action", command.action)
      current.put("pending", pending).put("display", Display.SENDING.name).put("revision", id())
      inFlight.add(pending.getString("commandId"))
      save(context, root, true)
      JSONObject(current.toString())
    }
    val response = try { if (!connected(context)) HttpResult(failure = Failure.CONNECT) else LockScreenHttp.post(
      operation.getString("baseUrl"), "/v1/lock-screen/action", operation.getString("capability"), operation.getString("appVersion"),
      operation.getJSONObject("pending").toString(), deadline)
    } catch (_: Exception) { HttpResult(failure = Failure.RESPONSE) }
    synchronized(this) {
      inFlight.remove(operation.getJSONObject("pending").getString("commandId"))
      val root = LockScreenStore(context).read(); val current = session(root) ?: return
      if (current.optString("sessionId") != operation.optString("sessionId")
        || current.optJSONObject("pending")?.optString("commandId") != operation.getJSONObject("pending").optString("commandId")) return
      val parsed = runCatching { JSONObject(response.body ?: "") }.getOrNull()
      val state = parsed?.optJSONObject("state")
      val valid = validState(state) && state!!.optString("timeEntryId") == operation.getJSONObject("state").optString("timeEntryId")
        && validArchiveStatus(parsed) && parsed!!.optString("status") in listOf("applied", "state_changed") && parsed.opt("idempotentRetry") is Boolean
      val outcome = LockScreenLogic.response(response.code, valid, state?.optString("status") == "stopped", response.failure, parsed?.optString("archiveStatus") == "pending")
      if (valid && LockScreenLogic.settled(outcome.display)) current.put("state", state)
      if (outcome.deleteKey) { current.remove("capability"); current.remove("expiresAt") }
      if (!outcome.keepCommand) current.remove("pending")
      current.put("display", outcome.display.name).put("revision", id()).put("nonce", id())
      save(context, root, true)
    }
  }
}
