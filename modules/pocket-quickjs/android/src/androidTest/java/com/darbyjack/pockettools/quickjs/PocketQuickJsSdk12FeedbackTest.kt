package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12FeedbackTest {
  @Test
  fun returnsFeedbackAlongsideDurableOperations() {
    val response = success(run(definition(), actionRequest("save")))
    val value = response.getJSONObject("value")
    val operations = value.getJSONArray("operations")
    val effects = value.getJSONArray("effects")

    assertEquals(1, operations.length())
    assertEquals("setting-set", operations.getJSONObject(0).getString("type"))
    assertEquals(1, effects.length())
    assertEquals("feedback", effects.getJSONObject(0).getString("type"))
    assertEquals("Saved", effects.getJSONObject(0).getString("message"))
  }

  @Test
  fun acceptsTheMaximumUnicodeMessageLength() {
    val response = success(run(definition(), actionRequest("boundary")))
    val message = response
      .getJSONObject("value")
      .getJSONArray("effects")
      .getJSONObject(0)
      .getString("message")
    assertEquals(160, message.codePointCount(0, message.length))
  }

  @Test
  fun rejectsInvalidOrRepeatedFeedbackBeforeSuccess() {
    for (action in listOf("empty", "overlong", "nonString", "twice")) {
      assertEquals("VALIDATION_FAILED", errorCode(run(definition(), actionRequest(action))))
    }
  }

  @Test
  fun suppressesFeedbackWhenTheActionFails() {
    val response = JSONObject(run(definition(), actionRequest("failAfterFeedback")))
    assertFalse(response.getBoolean("ok"))
    assertFalse(response.has("value"))
  }

  @Test
  fun omitsEffectsWhenNoFeedbackWasRequested() {
    val response = success(run(definition(), actionRequest("noFeedback")))
    assertFalse(response.getJSONObject("value").has("effects"))
  }

  @Test
  fun rejectsFeedbackDuringScreenRendering() {
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(renderFeedbackDefinition(), renderRequest())),
    )
  }

  @Test
  fun doesNotExposeFeedbackBelowSdk12() {
    val response = success(run(legacyDefinition(), legacyActionRequest()))
    assertFalse(response.getJSONObject("value").has("effects"))
  }

  private fun definition(): String =
    """
      import { defineMiniApp, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'feedback-test', name: 'Feedback Test', sdkVersion: '1.2' },
        settings: {
          draft: setting.text({ label: 'Draft', default: 'ready' }),
        },
        screens: {
          home() {
            return ui.page({ title: 'Feedback', children: [] });
          },
        },
        actions: {
          save(context) {
            context.settings.set('draft', '');
            context.feedback.show('Saved');
          },
          boundary(context) {
            context.feedback.show('😀'.repeat(160));
          },
          empty(context) {
            context.feedback.show('');
          },
          overlong(context) {
            context.feedback.show('x'.repeat(161));
          },
          nonString(context) {
            context.feedback.show(42);
          },
          twice(context) {
            context.settings.set('draft', 'changed');
            context.feedback.show('First');
            context.feedback.show('Second');
          },
          failAfterFeedback(context) {
            context.feedback.show('Do not show');
            throw new Error('action failed');
          },
          noFeedback() {},
        },
      });
    """.trimIndent()

  private fun renderFeedbackDefinition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'render-feedback-test', name: 'Render Feedback Test', sdkVersion: '1.2' },
        screens: {
          home(context) {
            context.feedback.show('Not allowed');
            return ui.page({ title: 'Feedback', children: [] });
          },
        },
        actions: {},
      });
    """.trimIndent()

  private fun legacyDefinition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'legacy-feedback-test', name: 'Legacy Feedback Test', sdkVersion: '1.1' },
        screens: {
          home() {
            return ui.page({ title: 'Legacy', children: [] });
          },
        },
        actions: {
          verify(context) {
            if (context.feedback !== undefined) throw new Error('feedback leaked into SDK 1.1');
          },
        },
      });
    """.trimIndent()

  private fun actionRequest(action: String): String =
    JSONObject()
      .put("mode", "action")
      .put("action", action)
      .put("now", "2026-08-04T05:00:00.000Z")
      .put("settings", JSONObject().put("draft", "ready"))
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

  private fun renderRequest(): String =
    JSONObject()
      .put("mode", "render")
      .put("screen", "home")
      .put("now", "2026-08-04T05:00:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

  private fun legacyActionRequest(): String =
    JSONObject()
      .put("mode", "action")
      .put("action", "verify")
      .put("now", "2026-08-04T05:00:00.000Z")
      .put("settings", JSONObject())
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
