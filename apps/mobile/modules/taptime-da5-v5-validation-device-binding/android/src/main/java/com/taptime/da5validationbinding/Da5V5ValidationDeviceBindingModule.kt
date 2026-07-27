package com.taptime.da5validationbinding

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TALKBACK_PACKAGE = "com.google.android.marvin.talkback"

class Da5V5ValidationDeviceBindingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Da5V5ValidationDeviceBinding")

    Function("readBinding") {
      val context = appContext.reactContext
        ?: throw IllegalStateException(
          "DA5 V5 Validation Android context is unavailable"
        )
      val packageInfo = try {
        context.packageManager.getPackageInfo(TALKBACK_PACKAGE, 0)
      } catch (_: PackageManager.NameNotFoundException) {
        throw IllegalStateException(
          "DA5 V5 Validation TalkBack package is unavailable"
        )
      }
      val applicationEnabled = context.packageManager
        .getApplicationEnabledSetting(TALKBACK_PACKAGE)
        .let { state ->
          state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
            || state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        }
      val accessibilityManager = context.getSystemService(
        AccessibilityManager::class.java
      ) ?: throw IllegalStateException(
        "DA5 V5 Validation accessibility service is unavailable"
      )
      val enabledService = accessibilityManager
        .getEnabledAccessibilityServiceList(
          AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        )
        .any { service ->
          service.resolveInfo?.serviceInfo?.packageName == TALKBACK_PACKAGE
        }
      val secureAccessibilityEnabled = Settings.Secure.getInt(
        context.contentResolver,
        Settings.Secure.ACCESSIBILITY_ENABLED,
        0
      ) == 1
      val versionName = packageInfo.versionName
        ?: throw IllegalStateException(
          "DA5 V5 Validation TalkBack version is unavailable"
        )

      mapOf(
        "deviceModel" to Build.MODEL,
        "androidRelease" to Build.VERSION.RELEASE,
        "androidApiLevel" to Build.VERSION.SDK_INT,
        "androidBuild" to Build.FINGERPRINT,
        "fontScale" to context.resources.configuration.fontScale.toDouble(),
        "talkBackPackageVersion" to versionName,
        "talkBackEnabled" to (
          applicationEnabled
            && secureAccessibilityEnabled
            && enabledService
          )
      )
    }
  }
}
