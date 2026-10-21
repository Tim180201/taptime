package com.taptime.lockscreen

fun main() {
  verifyNotificationPresentation()
  // A slow capability/retry runs away from the caller; the caller is free to play scan feedback.
  val entered = java.util.concurrent.CountDownLatch(1)
  val release = java.util.concurrent.CountDownLatch(1)
  val finished = java.util.concurrent.CountDownLatch(1)
  val caller = Thread.currentThread()
  LockScreenIo.execute { check(Thread.currentThread() !== caller); entered.countDown(); release.await(); finished.countDown() }
  check(entered.await(2, java.util.concurrent.TimeUnit.SECONDS))
  release.countDown(); check(finished.await(2, java.util.concurrent.TimeUnit.SECONDS))
  val shownAt = 100_000L
  val until = shownAt + LockScreenLogic.FINISHED_NOTICE_MILLIS
  check(LockScreenLogic.stoppedProjection("entry", "running", "entry", "stopped", 0, shownAt) == StoppedProjection.REPLACE)
  // Opening/suspending cannot create another completion or extend its deadline.
  check(LockScreenLogic.stoppedProjection("entry", "stopped", null, null, until, shownAt + 1000) == StoppedProjection.KEEP)
  check(LockScreenLogic.stoppedProjection("entry", "stopped", "entry", "stopped", until, shownAt + 2000) == StoppedProjection.KEEP)
  check(LockScreenLogic.stoppedProjection("entry", "stopped", null, null, until, until) == StoppedProjection.CLEAR)
  check(LockScreenLogic.stoppedProjection("entry", "stopped", "next", "running", until, shownAt + 1000) == StoppedProjection.REPLACE)
  check(!LockScreenLogic.clockRuns("running", Display.TRANSFERRING))
  check(LockScreenLogic.message(Display.TRANSFERRING) == "Wird übertragen …")
  for (action in listOf("pause", "resume", "stop", "retry")) {
    check(!LockScreenLogic.canSend(action, false, true, true))
    check(!LockScreenLogic.canSend(action, true, true, true))
  }
  check(LockScreenLogic.canSend("retry", true, false, true)) // Only the short reconciliation suspension allows retry.
  check(!LockScreenLogic.canSend("pause", true, false, true))
  check(!LockScreenLogic.canSend("retry", false, false, false))
  // A recent process started for another component receives the full receipt budget.
  check(LockScreenLogic.receiverDeadline(7000, null) == 13_500L)
  check(LockScreenLogic.receiverDeadline(1000, 0) == 6500L)

  val first = LockScreenLogic.command("running", null, "pause") { "command-one" }!!
  check(first == Command("command-one", "pause"))
  check(LockScreenLogic.command("running", first, "retry") { error("Retry must never allocate an ID") } === first)
  check(LockScreenLogic.command("running", first, "stop") { error("No parallel command") } == null)
  check(LockScreenLogic.command("paused", null, "pause") { error("No stale toggle") } == null)
  check(LockScreenLogic.command("running", null, "retry") { error("No command to retry") } == null)
  check(LockScreenLogic.response(200, true) == Outcome(Display.STATE))
  check(LockScreenLogic.response(200, true, true) == Outcome(Display.STATE, deleteKey = true))
  check(LockScreenLogic.response(200, false) == Outcome(Display.UNCONFIRMED, keepCommand = true))
  check(LockScreenLogic.response(401) == Outcome(Display.OPEN_APP, deleteKey = true))
  check(LockScreenLogic.response(426) == Outcome(Display.UPDATE_APP))
  for (code in listOf(400, 403, 409, 429)) check(LockScreenLogic.response(code) == Outcome(Display.OPEN_APP))
  for (code in listOf(0, 301, 302, 404, 500, 502, 503)) check(LockScreenLogic.response(code) == Outcome(Display.UNCONFIRMED, keepCommand = true))
  check(LockScreenLogic.response(0, failure = Failure.CONNECT) == Outcome(Display.NOT_SENT, keepCommand = true))
  check(LockScreenLogic.response(0, failure = Failure.RESPONSE) == Outcome(Display.UNCONFIRMED, keepCommand = true))
  for (status in listOf("running", "paused", "stopped")) {
    check(LockScreenLogic.allowed(status, "pause") == (status == "running"))
    check(LockScreenLogic.allowed(status, "resume") == (status == "paused"))
    check(LockScreenLogic.allowed(status, "stop") == (status != "stopped"))
    check(!LockScreenLogic.allowed(status, "start"))
  }
  check(LockScreenLogic.elapsed(3600, 100_000, 160_000, true) == 3660L)
  check(LockScreenLogic.elapsed(3600, 100_000, 160_000, false) == 3600L)
  check(LockScreenLogic.elapsed(3600, 100_000, 90_000, true) == 3600L)
  check(LockScreenLogic.duration(4980) == "1:23 h")
  check(LockScreenLogic.duration(13320) == "3:42 h")
  check(LockScreenLogic.berlin(0) == "01:00")
  check(LockScreenLogic.message(Display.SENDING) == "Wird gesendet …")
  check(LockScreenLogic.message(Display.NOT_SENT) == "Nicht gesendet · kein Netz")
  check(LockScreenLogic.message(Display.UNCONFIRMED) == "Noch nicht bestätigt")
  println("lock-screen outcomes and clock verified")
}
