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
class PocketQuickJsSdk12SettingTest {
  @Test
  fun recordsOrderedWritesAndUpdatesTheWorkingSnapshot() {
    val response = success(
      run(
        definition(
          sdkVersion = "1.2",
          actionBody = """
            context.settings.set('draftTitle', 'Saved');
            if (context.settings.get('draftTitle') !== 'Saved') {
              throw new Error('set was not visible to the same action');
            }
            context.settings.reset('draftTitle');
            if (context.settings.get('draftTitle') !== 'Default') {
              throw new Error('reset was not visible to the same action');
            }
          """.trimIndent(),
        ),
        actionRequest(),
      ),
    )

    val operations = response.getJSONObject("value").getJSONArray("operations")
    assertEquals(2, operations.length())
    assertEquals("setting-set", operations.getJSONObject(0).getString("type"))
    assertEquals("draftTitle", operations.getJSONObject(0).getString("setting"))
    assertEquals("Saved", operations.getJSONObject(0).getString("value"))
    assertEquals("setting-reset", operations.getJSONObject(1).getString("type"))
    assertEquals("draftTitle", operations.getJSONObject(1).getString("setting"))
  }

  @Test
  fun validatesSettingValuesBeforeRecordingAnOperation() {
    val response = run(
      definition(
        sdkVersion = "1.2",
        actionBody = "context.settings.set('quantity', 11);",
      ),
      actionRequest(),
    )

    assertEquals("VALIDATION_FAILED", errorCode(response))
  }

  @Test
  fun rejectsSettingWritesDuringRendering() {
    val source = """
      import { defineMiniApp, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'setting-render-test', name: 'Setting Render Test', sdkVersion: '1.2' },
        settings: {
          draftTitle: setting.text({ label: 'Draft title', default: 'Default' }),
        },
        screens: {
          home(context) {
            context.settings.set('draftTitle', 'Rendered');
            return ui.page({ title: 'Setting Render Test', children: [] });
          },
        },
      });
    """.trimIndent()

    val response = run(source, renderRequest())
    assertEquals("INVALID_CONTEXT_OPERATION", errorCode(response))
  }

  @Test
  fun doesNotExposeSettingWritesToSdk11() {
    val response = JSONObject(
      run(
        definition(
          sdkVersion = "1.1",
          actionBody = "context.settings.set('draftTitle', 'Saved');",
        ),
        actionRequest(),
      ),
    )

    assertFalse(response.getBoolean("ok"))
    val message = response.getJSONObject("error").getString("message")
    assertTrue(message, message.contains("set") || message.contains("function"))
  }

  @Test
  fun boundsSdk12DurableOperations() {
    val response = run(
      definition(
        sdkVersion = "1.2",
        actionBody = "for (let index = 0; index < 257; index += 1) context.settings.set('quantity', index % 11);",
      ),
      actionRequest(),
    )

    assertEquals("ACTION_LIMIT_EXCEEDED", errorCode(response))
  }

  private fun definition(
    sdkVersion: String,
    actionBody: String,
  ): String =
    """
      import { defineMiniApp, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'setting-write-test', name: 'Setting Write Test', sdkVersion: '$sdkVersion' },
        settings: {
          draftTitle: setting.text({ label: 'Draft title', default: 'Default' }),
          quantity: setting.number({ label: 'Quantity', default: 0, min: 0, max: 10 }),
        },
        screens: {
          home() { return ui.page({ title: 'Setting Write Test', children: [] }); },
        },
        actions: {
          verify(context) { $actionBody },
        },
      });
    """.trimIndent()

  private fun actionRequest(): String =
    JSONObject()
      .put("mode", "action")
      .put("action", "verify")
      .put("now", "2026-08-03T12:00:00.000Z")
      .put(
        "settings",
        JSONObject()
          .put("draftTitle", "Initial")
          .put("quantity", 0),
      )
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

  private fun renderRequest(): String =
    JSONObject()
      .put("mode", "render")
      .put("screen", "home")
      .put("now", "2026-08-03T12:00:00.000Z")
      .put("settings", JSONObject().put("draftTitle", "Initial"))
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

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
