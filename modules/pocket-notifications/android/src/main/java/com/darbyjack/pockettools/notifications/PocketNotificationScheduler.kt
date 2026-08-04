package com.darbyjack.pockettools.notifications

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZonedDateTime
import org.json.JSONArray
import org.json.JSONObject

internal object PocketNotificationScheduler {
  const val CHANNEL_ID = "pocket-tools-reminders"
  private const val CHANNEL_NAME = "Pocket Tools reminders"
  private const val PREFERENCES_NAME = "pocket-tools-notifications"
  private const val SCHEDULE_PREFIX = "schedule:"
  private const val ROUTE_PREFIX = "route:"
  private const val DELIVERED_PREFIX = "delivered:"
  private const val HOST_ID_EXTRA = "pocket_tools_host_id"
  private const val NOTIFICATION_TAG_ID = 1
  private const val ROUTE_RETENTION_MILLISECONDS = 30L * 24L * 60L * 60L * 1_000L

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    val existing = manager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = "Local reminders created by installed Pocket Tools utilities"
      enableVibration(true)
      setShowBadge(true)
    }
    manager.createNotificationChannel(channel)
  }

  fun notificationsEnabled(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && !manager.areNotificationsEnabled()) {
      return false
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      ensureChannel(context)
      val channel = manager.getNotificationChannel(CHANNEL_ID)
      if (channel == null || channel.importance == NotificationManager.IMPORTANCE_NONE) {
        return false
      }
    }
    return true
  }

  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  }

  fun reconcile(context: Context, entriesJson: String): String {
    ensureChannel(context)
    cleanupExpiredRoutes(context)
    val entries = JSONArray(entriesJson)
    val incomingHostIds = mutableSetOf<String>()
    val results = JSONArray()

    for (index in 0 until entries.length()) {
      val entry = entries.getJSONObject(index)
      val hostId = requireText(entry, "hostId")
      incomingHostIds += hostId
    }
    cancelStaleSchedules(context, incomingHostIds)

    for (index in 0 until entries.length()) {
      val entry = entries.getJSONObject(index)
      val hostId = requireText(entry, "hostId")
      val storageId = requireText(entry, "storageId")
      val notificationId = requireText(entry, "notificationId")
      val desired = entry.optBoolean("desired", false)

      if (!desired) {
        cancelHost(context, hostId, removeRoute = true)
        results.put(result(hostId, storageId, notificationId, "cancelled"))
        continue
      }

      val request = entry.optJSONObject("request")
      if (request == null) {
        results.put(
          result(
            hostId,
            storageId,
            notificationId,
            "failed",
            message = "The desired notification request is missing.",
          ),
        )
        continue
      }

      persistSchedule(context, hostId, entry)
      persistRoute(context, hostId, storageId, notificationId, request)
      results.put(scheduleDesired(context, entry, postImmediate = true))
    }

    return results.toString()
  }

  fun getOpenTarget(context: Context, hostId: String): String? {
    val key = ROUTE_PREFIX + hostId
    val json = preferences(context).getString(key, null) ?: return null
    return try {
      val route = JSONObject(json)
      val storedAt = route.optLong("storedAt", 0L)
      if (storedAt <= 0L || System.currentTimeMillis() - storedAt > ROUTE_RETENTION_MILLISECONDS) {
        preferences(context).edit().remove(key).remove(DELIVERED_PREFIX + hostId).apply()
        null
      } else {
        route.remove("storedAt")
        route.toString()
      }
    } catch (_: Exception) {
      preferences(context).edit().remove(key).remove(DELIVERED_PREFIX + hostId).apply()
      null
    }
  }

  fun handleAlarm(context: Context, hostId: String) {
    val entry = loadSchedule(context, hostId) ?: return
    val request = entry.optJSONObject("request") ?: return
    val trigger = request.optJSONObject("trigger") ?: return
    val triggerType = trigger.optString("type")

    ensureChannel(context)
    val canPost = notificationsEnabled(context)
    if (canPost) {
      postNotification(context, entry)
      if (triggerType != "daily" && triggerType != "weekly") markDelivered(context, hostId)
    }

    if (triggerType == "daily" || triggerType == "weekly") {
      scheduleRecurringFromNow(context, entry)
      return
    }

    if (canPost) removeSchedule(context, hostId)
  }

  fun recoverSchedules(context: Context) {
    ensureChannel(context)
    cleanupExpiredRoutes(context)
    val values = preferences(context).all
    for ((key, value) in values) {
      if (!key.startsWith(SCHEDULE_PREFIX) || value !is String) continue
      try {
        val entry = JSONObject(value)
        scheduleDesired(context, entry, postImmediate = true)
      } catch (_: Exception) {
        val hostId = key.removePrefix(SCHEDULE_PREFIX)
        cancelHost(context, hostId, removeRoute = false)
      }
    }
  }

  private fun scheduleDesired(
    context: Context,
    entry: JSONObject,
    postImmediate: Boolean,
  ): JSONObject {
    val hostId = requireText(entry, "hostId")
    val storageId = requireText(entry, "storageId")
    val notificationId = requireText(entry, "notificationId")
    val request = entry.getJSONObject("request")
    val trigger = request.getJSONObject("trigger")
    val triggerType = trigger.getString("type")

    if (!notificationsEnabled(context)) {
      cancelAlarm(context, hostId)
      return result(
        hostId,
        storageId,
        notificationId,
        "blocked",
        message = "Pocket Tools notifications or the reminders channel are disabled.",
      )
    }

    if (triggerType == "immediate") {
      cancelAlarm(context, hostId)
      if (postImmediate) {
        postNotification(context, entry)
        markDelivered(context, hostId)
        removeSchedule(context, hostId)
        return result(hostId, storageId, notificationId, "delivered", platformId = hostId)
      }
      return result(hostId, storageId, notificationId, "scheduled", platformId = hostId)
    }

    val exact = trigger.optString("delivery", "standard") == "exact"
    if (exact && !canScheduleExactAlarms(context)) {
      cancelAlarm(context, hostId)
      return result(
        hostId,
        storageId,
        notificationId,
        "blocked",
        message = "Alarms & reminders access is required for this exact reminder.",
      )
    }

    val now = System.currentTimeMillis()
    val triggerAt = when (triggerType) {
      "date" -> Instant.parse(trigger.getString("at")).toEpochMilli()
      "daily" -> nextDaily(
        trigger.getInt("hour"),
        trigger.getInt("minute"),
        ZonedDateTime.now(),
      )
      "weekly" -> nextWeekly(
        trigger.getInt("weekday"),
        trigger.getInt("hour"),
        trigger.getInt("minute"),
        ZonedDateTime.now(),
      )
      else -> throw IllegalArgumentException("Unsupported notification trigger type: $triggerType")
    }

    if (triggerType == "date" && triggerAt <= now) {
      cancelAlarm(context, hostId)
      removeSchedule(context, hostId)
      if (wasDelivered(context, hostId)) {
        return result(hostId, storageId, notificationId, "delivered", platformId = hostId)
      }
      removeRoute(context, hostId)
      return result(hostId, storageId, notificationId, "expired")
    }

    removeDelivered(context, hostId)
    scheduleAlarm(context, hostId, triggerAt, exact)
    return result(hostId, storageId, notificationId, "scheduled", platformId = hostId)
  }

  private fun scheduleRecurringFromNow(context: Context, entry: JSONObject) {
    val request = entry.optJSONObject("request") ?: return
    val trigger = request.optJSONObject("trigger") ?: return
    val hostId = entry.optString("hostId")
    if (hostId.isEmpty()) return

    val exact = trigger.optString("delivery", "standard") == "exact"
    if (exact && !canScheduleExactAlarms(context)) {
      cancelAlarm(context, hostId)
      return
    }

    val triggerAt = when (trigger.optString("type")) {
      "daily" -> nextDaily(
        trigger.optInt("hour"),
        trigger.optInt("minute"),
        ZonedDateTime.now(),
      )
      "weekly" -> nextWeekly(
        trigger.optInt("weekday"),
        trigger.optInt("hour"),
        trigger.optInt("minute"),
        ZonedDateTime.now(),
      )
      else -> return
    }
    scheduleAlarm(context, hostId, triggerAt, exact)
  }

  private fun scheduleAlarm(context: Context, hostId: String, triggerAt: Long, exact: Boolean) {
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    val operation = alarmPendingIntent(context, hostId)
    if (exact) {
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, operation)
    } else {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, operation)
    }
  }

  private fun postNotification(context: Context, entry: JSONObject) {
    val hostId = requireText(entry, "hostId")
    val request = entry.getJSONObject("request")
    val title = requireText(request, "title")
    val body = request.optString("body", "")
    val smallIcon = context.resources.getIdentifier(
      "pocket_notification",
      "drawable",
      context.packageName,
    ).takeIf { it != 0 } ?: context.applicationInfo.icon

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    builder
      .setSmallIcon(smallIcon)
      .setContentTitle(title)
      .setContentText(body)
      .setContentIntent(openPendingIntent(context, hostId))
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_REMINDER)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setShowWhen(true)
    if (body.isNotEmpty()) builder.setStyle(Notification.BigTextStyle().bigText(body))

    context.getSystemService(NotificationManager::class.java)
      .notify(hostId, NOTIFICATION_TAG_ID, builder.build())
  }

  private fun openPendingIntent(context: Context, hostId: String): PendingIntent {
    val uri = Uri.Builder()
      .scheme("pocket-tools")
      .authority("notification")
      .appendQueryParameter("hostId", hostId)
      .build()
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_VIEW, uri)
    intent.data = uri
    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun alarmPendingIntent(context: Context, hostId: String): PendingIntent {
    val intent = Intent(context, PocketNotificationAlarmReceiver::class.java).apply {
      data = Uri.Builder()
        .scheme("pocket-tools-alarm")
        .authority("schedule")
        .appendQueryParameter("hostId", hostId)
        .build()
      putExtra(HOST_ID_EXTRA, hostId)
    }
    return PendingIntent.getBroadcast(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun cancelHost(context: Context, hostId: String, removeRoute: Boolean) {
    cancelAlarm(context, hostId)
    removeSchedule(context, hostId)
    removeDelivered(context, hostId)
    if (removeRoute) removeRoute(context, hostId)
    context.getSystemService(NotificationManager::class.java)
      .cancel(hostId, NOTIFICATION_TAG_ID)
  }

  private fun cancelAlarm(context: Context, hostId: String) {
    context.getSystemService(AlarmManager::class.java)
      .cancel(alarmPendingIntent(context, hostId))
  }

  private fun cancelStaleSchedules(context: Context, incomingHostIds: Set<String>) {
    val values = preferences(context).all
    for (key in values.keys) {
      if (!key.startsWith(SCHEDULE_PREFIX)) continue
      val hostId = key.removePrefix(SCHEDULE_PREFIX)
      if (hostId !in incomingHostIds) {
        cancelAlarm(context, hostId)
        removeSchedule(context, hostId)
      }
    }
  }

  private fun cleanupExpiredRoutes(context: Context) {
    val prefs = preferences(context)
    val now = System.currentTimeMillis()
    val editor = prefs.edit()
    for ((key, value) in prefs.all) {
      if (!key.startsWith(ROUTE_PREFIX) || value !is String) continue
      val hostId = key.removePrefix(ROUTE_PREFIX)
      if (prefs.contains(SCHEDULE_PREFIX + hostId)) continue
      val storedAt = try {
        JSONObject(value).optLong("storedAt", 0L)
      } catch (_: Exception) {
        0L
      }
      if (storedAt <= 0L || now - storedAt > ROUTE_RETENTION_MILLISECONDS) {
        editor.remove(key).remove(DELIVERED_PREFIX + hostId)
      }
    }
    editor.apply()
  }

  private fun persistSchedule(context: Context, hostId: String, entry: JSONObject) {
    preferences(context).edit().putString(SCHEDULE_PREFIX + hostId, entry.toString()).apply()
  }

  private fun loadSchedule(context: Context, hostId: String): JSONObject? {
    val json = preferences(context).getString(SCHEDULE_PREFIX + hostId, null) ?: return null
    return JSONObject(json)
  }

  private fun removeSchedule(context: Context, hostId: String) {
    preferences(context).edit().remove(SCHEDULE_PREFIX + hostId).apply()
  }

  private fun persistRoute(
    context: Context,
    hostId: String,
    storageId: String,
    notificationId: String,
    request: JSONObject,
  ) {
    val route = JSONObject()
      .put("hostId", hostId)
      .put("storageId", storageId)
      .put("notificationId", notificationId)
      .put("storedAt", System.currentTimeMillis())
    val open = request.optJSONObject("open")
    if (open != null) {
      route.put("screen", open.getString("screen"))
      if (open.has("input")) route.put("input", open.get("input"))
    }
    preferences(context).edit().putString(ROUTE_PREFIX + hostId, route.toString()).apply()
  }

  private fun removeRoute(context: Context, hostId: String) {
    preferences(context).edit().remove(ROUTE_PREFIX + hostId).apply()
  }

  private fun markDelivered(context: Context, hostId: String) {
    preferences(context).edit().putLong(DELIVERED_PREFIX + hostId, System.currentTimeMillis()).apply()
  }

  private fun wasDelivered(context: Context, hostId: String): Boolean {
    return preferences(context).contains(DELIVERED_PREFIX + hostId)
  }

  private fun removeDelivered(context: Context, hostId: String) {
    preferences(context).edit().remove(DELIVERED_PREFIX + hostId).apply()
  }

  private fun preferences(context: Context) =
    context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  private fun result(
    hostId: String,
    storageId: String,
    notificationId: String,
    status: String,
    platformId: String? = null,
    message: String? = null,
  ): JSONObject {
    val value = JSONObject()
      .put("hostId", hostId)
      .put("storageId", storageId)
      .put("notificationId", notificationId)
      .put("status", status)
    if (platformId != null) value.put("platformId", platformId)
    if (message != null) value.put("message", message)
    return value
  }

  private fun requireText(objectValue: JSONObject, key: String): String {
    val value = objectValue.getString(key)
    require(value.isNotEmpty()) { "$key must not be empty." }
    return value
  }

  internal fun nextDaily(hour: Int, minute: Int, now: ZonedDateTime): Long {
    var target = now.withHour(hour).withMinute(minute).withSecond(0).withNano(0)
    if (!target.isAfter(now)) target = target.plusDays(1)
    return target.toInstant().toEpochMilli()
  }

  internal fun nextWeekly(weekday: Int, hour: Int, minute: Int, now: ZonedDateTime): Long {
    val targetDay = DayOfWeek.of(weekday)
    var days = (targetDay.value - now.dayOfWeek.value + 7) % 7
    var target = now.plusDays(days.toLong())
      .withHour(hour)
      .withMinute(minute)
      .withSecond(0)
      .withNano(0)
    if (!target.isAfter(now)) {
      days = if (days == 0) 7 else days
      target = now.plusDays(days.toLong())
        .withHour(hour)
        .withMinute(minute)
        .withSecond(0)
        .withNano(0)
    }
    return target.toInstant().toEpochMilli()
  }
}

class PocketNotificationAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val hostId = intent.getStringExtra("pocket_tools_host_id")
      ?: intent.data?.getQueryParameter("hostId")
      ?: return
    PocketNotificationScheduler.handleAlarm(context, hostId)
  }
}

class PocketNotificationRecoveryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    PocketNotificationScheduler.recoverSchedules(context)
  }
}
