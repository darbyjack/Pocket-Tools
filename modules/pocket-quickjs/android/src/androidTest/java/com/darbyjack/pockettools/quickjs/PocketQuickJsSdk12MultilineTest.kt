package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12MultilineTest {
  @Test
  fun rendersDormantSdk12MultilineTextInput() {
    val input = success(run(definition("1.2", "multiline: true, minLines: 4,")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")
      .getJSONObject(0)

    assertEquals("text-input", input.getString("type"))
    assertEquals("notes", input.getString("setting"))
    assertTrue(input.getBoolean("multiline"))
    assertEquals(4, input.getInt("minLines"))
  }

  @Test
  fun rejectsMultilinePropertiesBelowSdk12() {
    for (sdkVersion in listOf("1.0", "1.1")) {
      assertEquals(
        "VALIDATION_FAILED",
        errorCode(run(definition(sdkVersion, "multiline: true, minLines: 4,"))),
      )
      assertEquals(
        "VALIDATION_FAILED",
        errorCode(run(definition(sdkVersion, "multiline: false,"))),
      )
    }
  }

  @Test
  fun rejectsMalformedMultilineProperties() {
    val invalidProperties =
      listOf(
        "multiline: 'true',",
        "minLines: 4,",
        "multiline: false, minLines: 4,",
        "multiline: true, minLines: 1,",
        "multiline: true, minLines: 9,",
        "multiline: true, minLines: 3.5,",
      )

    for (properties in invalidProperties) {
      assertEquals("VALIDATION_FAILED", errorCode(run(definition("1.2", properties))))
    }
  }

  @Test
  fun preservesOrdinaryLegacyTextInputs() {
    for (sdkVersion in listOf("1.0", "1.1")) {
      val input = success(run(definition(sdkVersion, "")))
        .getJSONObject("value")
        .getJSONObject("page")
        .getJSONArray("children")
        .getJSONObject(0)

      assertEquals("text-input", input.getString("type"))
      assertFalse(input.has("multiline"))
      assertFalse(input.has("minLines"))
    }
  }

  private fun definition(sdkVersion: String, inputProperties: String): String =
    """
      import { defineMiniApp, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: {
          id: 'multiline-runtime-test',
          name: 'Multiline Runtime Test',
          sdkVersion: '$sdkVersion',
        },
        settings: {
          notes: setting.text({
            label: 'Notes',
            default: '',
            maxLength: 10000,
          }),
        },
        screens: {
          home() {
            return ui.page({
              title: 'Multiline Runtime Test',
              children: [
                ui.textInput({
                  setting: 'notes',
                  placeholder: 'Add notes',
                  $inputProperties
                }),
              ],
            });
          },
        },
      });
    """.trimIndent()

  private fun request(): String =
    JSONObject()
      .put("mode", "render")
      .put("screen", "home")
      .put("now", "2026-08-04T16:55:00.000Z")
      .put("settings", JSONObject().put("notes", ""))
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

  private fun run(source: String): String =
    PocketQuickJsBridge.run(source, request(), SandboxLimits())

  private fun success(json: String): JSONObject {
    val response = JSONObject(json)
    assertTrue(json, response.getBoolean("ok"))
    return response
  }

  private fun errorCode(json: String): String =
    JSONObject(json).getJSONObject("error").getString("code")
}
