package com.taptime.da5validationbinding

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private val ALLOWED_TALKBACK_PACKAGES = setOf(
  "com.google.android.marvin.talkback",
  "com.samsung.android.accessibility.talkback"
)

class Da5V5ValidationDeviceBindingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Da5V5ValidationDeviceBinding")

    Function("readBinding") {
      val context = appContext.reactContext
        ?: throw IllegalStateException(
          "DA5 V5 Validation Android context is unavailable"
        )
      val accessibilityManager = context.getSystemService(
        AccessibilityManager::class.java
      ) ?: throw IllegalStateException(
        "DA5 V5 Validation accessibility service is unavailable"
      )
      val enabledServices = accessibilityManager
        .getEnabledAccessibilityServiceList(
          AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        )
        .map { service ->
          service.resolveInfo?.serviceInfo
            ?: throw IllegalStateException(
              "DA5 V5 Validation accessibility provider is unavailable"
            )
        }
      val secureAccessibilityEnabled = Settings.Secure.getInt(
        context.contentResolver,
        Settings.Secure.ACCESSIBILITY_ENABLED,
        0
      ) == 1
      val activeTalkBackServices = enabledServices
        .filter { service ->
          service.packageName in ALLOWED_TALKBACK_PACKAGES
        }
      val talkBackPackageName = activeTalkBackServices
        .map { service -> service.packageName }
        .toSet()
        .singleOrNull()
        ?.takeIf { packageName ->
          activeTalkBackServices.all { service ->
            service.packageName == packageName && service.enabled
          }
        }
        ?.takeIf { secureAccessibilityEnabled }
        ?: throw IllegalStateException(
          "DA5 V5 Validation TalkBack provider is not exactly active"
        )
      val packageInfo = try {
        context.packageManager.getPackageInfo(talkBackPackageName, 0)
      } catch (_: PackageManager.NameNotFoundException) {
        throw IllegalStateException(
          "DA5 V5 Validation TalkBack package is unavailable"
        )
      }
      val applicationEnabled = packageInfo.applicationInfo?.enabled == true
        && context.packageManager
          .getApplicationEnabledSetting(talkBackPackageName)
          .let { state ->
            state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
              || state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
          }
      if (!applicationEnabled) {
        throw IllegalStateException(
          "DA5 V5 Validation TalkBack package is disabled"
        )
      }
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
        "talkBackPackageName" to talkBackPackageName,
        "talkBackPackageVersion" to versionName,
        "talkBackEnabled" to true
      )
    }
  }
}
