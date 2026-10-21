package com.taptime.lockscreen

import java.util.concurrent.Executors

/** HTTP never occupies Expo's shared AsyncFunction queue (scan feedback and network state use it). */
internal object LockScreenIo {
  private val executor = Executors.newFixedThreadPool(2) { task -> Thread(task, "lock-screen-io").apply { isDaemon = true } }
  fun execute(task: () -> Unit) { executor.execute(task) }
}
