package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12NotificationSnapshotTest {
  @Test
  fun permitsReplacementAtTheExistingLimit() {
    val operations = success(run(definition(), actionRequest("replaceExisting", desired(64))))
      .getJSONObject("value")
      .getJSONArray("operations")
    assertEquals(1, operations.length())
    assertEquals("notification-schedule", operations.getJSONObject(0).getString("type"))
  }

  @Test
  fun rejectsANewScheduleAtTheExistingLimit() {
    assertEquals(
      "NOTIFICATION_LIMIT_EXCEEDED",
      errorCode(run(definition(), actionRequest("addNew", desired(64)))),
    )
  }

  @Test
  fun permitsCancelThenAddAtTheExistingLimit() {
    val operations = success(run(definition(), actionRequest("cancelThenAdd", desired(64))))
      .getJSONObject("value")
      .getJSONArray("operations")
    assertEquals(2, operations.length())
    assertEquals("notification-cancel", operations.getJSONObject(0).getString("type"))
    assertEquals("notification-schedule", operations.getJSONObject(1).getString("type"))
  }

  @Test
  fun rejectsInvalidHostNotificationSnapshots() {
    assertEquals(
      "INVALID_RUNTIME_REQUEST",
      errorCode(run(definition(), actionRequest("addNew", desired(65)))),
    )
    assertEquals(
      "INVALID_RUNTIME_REQUEST",
      errorCode(
        run(
          definition(),
          baseRequest("addNew")
            .put("notifications", "invalid")
            .toString(),
        ),
      ),
    )
  }

  private fun definition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'notification-snapshot-test', name: 'Notification Snapshot Test', sdkVersion: '1.2' },
        screens: {
          home() { return ui.page({ title: 'Notifications', children: [] }); },
        },
        actions: {
          replaceExisting(context) {
            context.notifications.schedule({
              id: 'reminder0', title: 'Replacement', trigger: { type: 'immediate' },
            });
          },
          addNew(context) {
            context.notifications.schedule({
              id: 'newReminder', title: 'New reminder', trigger: { type: 'immediate' },
            });
          },
          cancelThenAdd(context) {
            context.notifications.cancel('reminder0');
            context.notifications.schedule({
              id: 'newReminder', title: 'New reminder', trigger: { type: 'immediate' },
            });
          },
        },
      });
    """.trimIndent()

  private fun desired(count: Int): JSONObject =
    JSONObject().apply {
      repeat(count) { index ->
        put(
          "reminder$index",
          JSONObject()
            .put("id", "reminder$index")
            .put("title", "Reminder $index")
            .put("trigger", JSONObject().put("type", "immediate")),
        )
      }
    }

  private fun actionRequest(action: String, notifications: JSONObject): String =
    baseRequest(action)
      .put("notifications", notifications)
      .toString()

  private fun baseRequest(action: String): JSONObject =
    JSONObject()
      .put("mode", "action")
      .put("action", action)
      .put("now", "2026-08-04T05:30:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
      .put("timers", JSONObject())

  private fun run(source: String, requestJson: String): String =
    PocketQuickJsBridge.run(source, requestJson, SandboxLimits())

  private fun success(json: String): JSONObject {
    val response = JSONObject(json)
    assertTrue(json, response.getBoolean("ok"))
    return response
  }

  private fun errorCode(json: String): String =
    JSONObject(json).getJSONObject("error").getString("code")
}
