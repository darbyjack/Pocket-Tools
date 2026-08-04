package com.darbyjack.pockettools.notifications

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PocketNotificationsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PocketNotifications")

    Function("ensureChannel") {
      PocketNotificationScheduler.ensureChannel(requireContext())
    }

    Function("notificationsEnabled") {
      PocketNotificationScheduler.notificationsEnabled(requireContext())
    }

    Function("canScheduleExactAlarms") {
      PocketNotificationScheduler.canScheduleExactAlarms(requireContext())
    }

    AsyncFunction("openNotificationSettings") {
      val context = requireContext()
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      }
      activity.startActivity(intent)
      true
    }

    AsyncFunction("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@AsyncFunction true
      val context = requireContext()
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      val intent = Intent(
        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
        Uri.parse("package:${context.packageName}"),
      )
      activity.startActivity(intent)
      true
    }

    AsyncFunction("reconcile") { entriesJson: String ->
      PocketNotificationScheduler.reconcile(requireContext(), entriesJson)
    }

    Function("getOpenTarget") { hostId: String ->
      PocketNotificationScheduler.getOpenTarget(requireContext(), hostId)
    }
  }

  private fun requireContext() =
    appContext.reactContext ?: throw IllegalStateException("Pocket Notifications has no React context.")
}
