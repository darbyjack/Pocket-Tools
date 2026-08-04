package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12NotificationTest {
  @Test
  fun preservesCallOrderWithDurableWritesAndFeedback() {
    val response = success(run(definition(), actionRequest("ordered")))
    val value = response.getJSONObject("value")
    val operations = value.getJSONArray("operations")
    assertEquals(5, operations.length())
    assertEquals("setting-set", operations.getJSONObject(0).getString("type"))
    assertEquals("notification-schedule", operations.getJSONObject(1).getString("type"))
    assertEquals("insert", operations.getJSONObject(2).getString("type"))
    assertEquals("notification-cancel", operations.getJSONObject(3).getString("type"))
    assertEquals("notification-cancel-all", operations.getJSONObject(4).getString("type"))
    assertEquals(
      "Saved",
      value.getJSONArray("effects").getJSONObject(0).getString("message"),
    )
  }

  @Test
  fun supportsEveryFrozenTriggerAndNormalizesDelivery() {
    val operations = success(run(definition(), actionRequest("triggers")))
      .getJSONObject("value")
      .getJSONArray("operations")
    assertEquals(4, operations.length())

    val immediate = requestAt(operations, 0).getJSONObject("trigger")
    assertEquals("immediate", immediate.getString("type"))
    assertFalse(immediate.has("delivery"))

    val date = requestAt(operations, 1).getJSONObject("trigger")
    assertEquals("date", date.getString("type"))
    assertEquals("standard", date.getString("delivery"))

    val daily = requestAt(operations, 2).getJSONObject("trigger")
    assertEquals("daily", daily.getString("type"))
    assertEquals("exact", daily.getString("delivery"))

    val weekly = requestAt(operations, 3).getJSONObject("trigger")
    assertEquals("weekly", weekly.getString("type"))
    assertEquals(7, weekly.getInt("weekday"))
    assertEquals("standard", weekly.getString("delivery"))
    assertEquals("details", requestAt(operations, 3).getJSONObject("open").getString("screen"))
  }

  @Test
  fun rejectsInvalidRequestsAndRenderContextCalls() {
    val actions = listOf(
      "emptyTitle",
      "overlongBody",
      "invalidTime",
      "pastDate",
      "unknownScreen",
      "unsafeInput",
      "unknownRequestKey",
    )
    for (action in actions) {
      assertEquals("VALIDATION_FAILED", errorCode(run(definition(), actionRequest(action))))
    }
    assertEquals(
      "INVALID_CONTEXT_OPERATION",
      errorCode(run(renderNotificationDefinition(), renderRequest())),
    )
  }

  @Test
  fun enforcesDesiredScheduleAndCombinedOperationLimits() {
    assertEquals(
      "NOTIFICATION_LIMIT_EXCEEDED",
      errorCode(run(definition(), actionRequest("tooManyDesired"))),
    )
    assertTrue(success(run(definition(), actionRequest("clearThenSchedule"))).getBoolean("ok"))
    assertEquals(
      "ACTION_LIMIT_EXCEEDED",
      errorCode(run(definition(), actionRequest("combinedLimit"))),
    )
  }

  @Test
  fun suppressesNotificationOperationsWhenTheActionFails() {
    val response = JSONObject(run(definition(), actionRequest("failAfterSchedule")))
    assertFalse(response.getBoolean("ok"))
    assertFalse(response.has("value"))
  }

  @Test
  fun doesNotExposeNotificationsBelowSdk12() {
    val response = success(run(legacyDefinition(), legacyActionRequest()))
    assertEquals(0, response.getJSONObject("value").getJSONArray("operations").length())
  }

  private fun definition(): String =
    """
      import { collection, defineMiniApp, field, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'notification-test', name: 'Notification Test', sdkVersion: '1.2' },
        settings: {
          draft: setting.text({ label: 'Draft', default: 'ready' }),
        },
        collections: {
          entries: collection({ note: field.text() }),
        },
        screens: {
          home() {
            return ui.page({ title: 'Notifications', children: [] });
          },
          details() {
            return ui.page({ title: 'Details', children: [] });
          },
        },
        actions: {
          ordered(context) {
            context.settings.set('draft', 'saved');
            context.notifications.schedule({
              id: 'dailyReminder',
              title: 'Daily reminder',
              trigger: { type: 'daily', hour: 8, minute: 30 },
            });
            context.data.collection('entries').insert({ note: 'saved' });
            context.notifications.cancel('oldReminder');
            context.notifications.cancelAll();
            context.feedback.show('Saved');
          },
          triggers(context) {
            context.notifications.schedule({
              id: 'immediateReminder',
              title: 'Immediate',
              trigger: { type: 'immediate' },
            });
            context.notifications.schedule({
              id: 'datedReminder',
              title: 'Dated',
              body: '',
              trigger: { type: 'date', at: '2026-08-05T06:00:00.000Z' },
            });
            context.notifications.schedule({
              id: 'dailyExact',
              title: 'Daily exact',
              trigger: { type: 'daily', hour: 9, minute: 15, delivery: 'exact' },
            });
            context.notifications.schedule({
              id: 'weeklyReminder',
              title: 'Weekly',
              trigger: { type: 'weekly', weekday: 7, hour: 20, minute: 0 },
              open: { screen: 'details', input: { id: 'record' } },
            });
          },
          emptyTitle(context) {
            context.notifications.schedule({
              id: 'test', title: '', trigger: { type: 'immediate' },
            });
          },
          overlongBody(context) {
            context.notifications.schedule({
              id: 'test', title: 'Test', body: 'x'.repeat(241), trigger: { type: 'immediate' },
            });
          },
          invalidTime(context) {
            context.notifications.schedule({
              id: 'test', title: 'Test', trigger: { type: 'daily', hour: 24, minute: 0 },
            });
          },
          pastDate(context) {
            context.notifications.schedule({
              id: 'test',
              title: 'Test',
              trigger: { type: 'date', at: '2026-08-04T05:00:00.000Z' },
            });
          },
          unknownScreen(context) {
            context.notifications.schedule({
              id: 'test',
              title: 'Test',
              trigger: { type: 'immediate' },
              open: { screen: 'missing' },
            });
          },
          unsafeInput(context) {
            context.notifications.schedule({
              id: 'test',
              title: 'Test',
              trigger: { type: 'immediate' },
              open: { screen: 'home', input: Infinity },
            });
          },
          unknownRequestKey(context) {
            context.notifications.schedule({
              id: 'test',
              title: 'Test',
              trigger: { type: 'immediate' },
              channel: 'custom',
            });
          },
          tooManyDesired(context) {
            for (let index = 0; index < 65; index += 1) {
              context.notifications.schedule({
                id: 'reminder' + index,
                title: 'Reminder ' + index,
                trigger: { type: 'immediate' },
              });
            }
          },
          clearThenSchedule(context) {
            for (let index = 0; index < 64; index += 1) {
              context.notifications.schedule({
                id: 'reminder' + index,
                title: 'Reminder ' + index,
                trigger: { type: 'immediate' },
              });
            }
            context.notifications.cancelAll();
            context.notifications.schedule({
              id: 'replacement', title: 'Replacement', trigger: { type: 'immediate' },
            });
          },
          combinedLimit(context) {
            context.notifications.schedule({
              id: 'first', title: 'First', trigger: { type: 'immediate' },
            });
            for (let index = 0; index < 256; index += 1) {
              context.settings.set('draft', String(index));
            }
          },
          failAfterSchedule(context) {
            context.notifications.schedule({
              id: 'test', title: 'Test', trigger: { type: 'immediate' },
            });
            throw new Error('fail');
          },
        },
      });
    """.trimIndent()

  private fun renderNotificationDefinition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'render-notification-test', name: 'Render Notification Test', sdkVersion: '1.2' },
        screens: {
          home(context) {
            context.notifications.schedule({
              id: 'test', title: 'Test', trigger: { type: 'immediate' },
            });
            return ui.page({ title: 'Test', children: [] });
          },
        },
      });
    """.trimIndent()

  private fun legacyDefinition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'legacy-notification-test', name: 'Legacy Notification Test', sdkVersion: '1.1' },
        screens: {
          home() { return ui.page({ title: 'Legacy', children: [] }); },
        },
        actions: {
          noNotification(context) {
            if (context.notifications !== undefined) throw new Error('notifications leaked');
          },
        },
      });
    """.trimIndent()

  private fun actionRequest(action: String): String =
    JSONObject()
      .put("mode", "action")
      .put("action", action)
      .put("now", "2026-08-04T05:30:00.000Z")
      .put("settings", JSONObject().put("draft", "ready"))
      .put("records", JSONObject().put("entries", JSONArray()))
      .put("timers", JSONObject())
      .toString()

  private fun renderRequest(): String =
    JSONObject()
      .put("mode", "render")
      .put("screen", "home")
      .put("now", "2026-08-04T05:30:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

  private fun legacyActionRequest(): String =
    JSONObject()
      .put("mode", "action")
      .put("action", "noNotification")
      .put("now", "2026-08-04T05:30:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

  private fun requestAt(operations: JSONArray, index: Int): JSONObject =
    operations.getJSONObject(index).getJSONObject("request")

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
