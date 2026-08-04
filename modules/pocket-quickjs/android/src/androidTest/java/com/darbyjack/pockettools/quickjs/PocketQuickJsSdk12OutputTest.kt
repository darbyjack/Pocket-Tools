package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12OutputTest {
  @Test
  fun returnsCopyAlongsideDurableOperationsAndFeedback() {
    val response = success(run(definition(), actionRequest("copy")))
    val value = response.getJSONObject("value")
    val operations = value.getJSONArray("operations")
    val effects = value.getJSONArray("effects")

    assertEquals(1, operations.length())
    assertEquals("setting-set", operations.getJSONObject(0).getString("type"))
    assertEquals(2, effects.length())
    assertEquals("copy", effects.getJSONObject(0).getString("type"))
    assertEquals("Copied value", effects.getJSONObject(0).getString("text"))
    assertEquals("feedback", effects.getJSONObject(1).getString("type"))
    assertEquals("Copied", effects.getJSONObject(1).getString("message"))
  }

  @Test
  fun returnsShareWithOptionalTitle() {
    val effect = success(run(definition(), actionRequest("share")))
      .getJSONObject("value")
      .getJSONArray("effects")
      .getJSONObject(0)

    assertEquals("share", effect.getString("type"))
    assertEquals("Pocket Tools", effect.getString("title"))
    assertEquals("Shared value", effect.getString("text"))
  }

  @Test
  fun acceptsMaximumUnicodeOutputLengths() {
    val effects = success(run(definition(), actionRequest("boundary")))
      .getJSONObject("value")
      .getJSONArray("effects")
    val copyText = effects.getJSONObject(0).getString("text")

    assertEquals(10_000, copyText.codePointCount(0, copyText.length))
  }

  @Test
  fun rejectsInvalidOrRepeatedOutputBeforeSuccess() {
    for (
      action in listOf(
        "empty",
        "overlong",
        "nonString",
        "badShare",
        "extraShareKey",
        "emptyTitle",
        "overlongTitle",
        "twice",
      )
    ) {
      assertEquals(action, "VALIDATION_FAILED", errorCode(run(definition(), actionRequest(action))))
    }
  }

  @Test
  fun suppressesOutputWhenTheActionFails() {
    val response = JSONObject(run(definition(), actionRequest("failAfterOutput")))
    assertFalse(response.getBoolean("ok"))
    assertFalse(response.has("value"))
  }

  @Test
  fun rejectsOutputDuringScreenRendering() {
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(renderOutputDefinition(), renderRequest())),
    )
  }

  @Test
  fun doesNotExposeOutputBelowSdk12() {
    val response = success(run(legacyDefinition(), legacyActionRequest()))
    assertFalse(response.getJSONObject("value").has("effects"))
  }

  private fun definition(): String =
    """
      import { defineMiniApp, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'output-test', name: 'Output Test', sdkVersion: '1.2' },
        settings: {
          draft: setting.text({ label: 'Draft', default: 'ready' }),
        },
        screens: {
          home() {
            return ui.page({ title: 'Output', children: [] });
          },
        },
        actions: {
          copy(context) {
            context.settings.set('draft', 'copied');
            context.output.copy('Copied value');
            context.feedback.show('Copied');
          },
          share(context) {
            context.output.share({ title: 'Pocket Tools', text: 'Shared value' });
          },
          boundary(context) {
            context.output.copy('😀'.repeat(10000));
          },
          empty(context) {
            context.output.copy('');
          },
          overlong(context) {
            context.output.copy('x'.repeat(10001));
          },
          nonString(context) {
            context.output.copy(42);
          },
          badShare(context) {
            context.output.share('Shared');
          },
          extraShareKey(context) {
            context.output.share({ text: 'Shared', mimeType: 'text/plain' });
          },
          emptyTitle(context) {
            context.output.share({ title: '', text: 'Shared' });
          },
          overlongTitle(context) {
            context.output.share({ title: '😀'.repeat(121), text: 'Shared' });
          },
          twice(context) {
            context.settings.set('draft', 'changed');
            context.output.copy('First');
            context.output.share({ text: 'Second' });
          },
          failAfterOutput(context) {
            context.output.copy('Do not copy');
            throw new Error('action failed');
          },
        },
      });
    """.trimIndent()

  private fun renderOutputDefinition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'render-output-test', name: 'Render Output Test', sdkVersion: '1.2' },
        screens: {
          home(context) {
            context.output.copy('Not allowed');
            return ui.page({ title: 'Output', children: [] });
          },
        },
        actions: {},
      });
    """.trimIndent()

  private fun legacyDefinition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'legacy-output-test', name: 'Legacy Output Test', sdkVersion: '1.1' },
        screens: {
          home() {
            return ui.page({ title: 'Legacy', children: [] });
          },
        },
        actions: {
          verify(context) {
            if (context.output !== undefined) throw new Error('output leaked into SDK 1.1');
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
