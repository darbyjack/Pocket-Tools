package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12NumericInputTest {
  @Test
  fun rendersDormantSdk12NumericInputHints() {
    val input = success(run(definition("1.2", "step: 0.01, decimalPlaces: 2,")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")
      .getJSONObject(0)

    assertEquals("number-input", input.getString("type"))
    assertEquals("amount", input.getString("setting"))
    assertEquals(0.01, input.getDouble("step"), 0.0)
    assertEquals(2, input.getInt("decimalPlaces"))
  }

  @Test
  fun rejectsNumericHintsBelowSdk12() {
    for (sdkVersion in listOf("1.0", "1.1")) {
      assertEquals(
        "VALIDATION_FAILED",
        errorCode(run(definition(sdkVersion, "step: 1,"))),
      )
      assertEquals(
        "VALIDATION_FAILED",
        errorCode(run(definition(sdkVersion, "decimalPlaces: 0,"))),
      )
    }
  }

  @Test
  fun rejectsMalformedNumericHints() {
    val invalidProperties =
      listOf(
        "step: 0,",
        "step: -1,",
        "step: Number.NaN,",
        "step: Number.POSITIVE_INFINITY,",
        "step: '0.01',",
        "decimalPlaces: -1,",
        "decimalPlaces: 7,",
        "decimalPlaces: 2.5,",
        "decimalPlaces: '2',",
      )

    for (properties in invalidProperties) {
      assertEquals("VALIDATION_FAILED", errorCode(run(definition("1.2", properties))))
    }
  }

  @Test
  fun preservesOrdinaryLegacyNumericInputs() {
    for (sdkVersion in listOf("1.0", "1.1")) {
      val input = success(run(definition(sdkVersion, "")))
        .getJSONObject("value")
        .getJSONObject("page")
        .getJSONArray("children")
        .getJSONObject(0)

      assertEquals("number-input", input.getString("type"))
      assertFalse(input.has("step"))
      assertFalse(input.has("decimalPlaces"))
    }
  }

  private fun definition(sdkVersion: String, inputProperties: String): String =
    """
      import { defineMiniApp, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: {
          id: 'numeric-input-runtime-test',
          name: 'Numeric Input Runtime Test',
          sdkVersion: '$sdkVersion',
        },
        settings: {
          amount: setting.money({
            label: 'Amount',
            default: 1.5,
            min: 0,
            max: 1000,
          }),
        },
        screens: {
          home() {
            return ui.page({
              title: 'Numeric Input Runtime Test',
              children: [
                ui.numberInput({
                  setting: 'amount',
                  label: 'Amount',
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
      .put("now", "2026-08-04T17:30:00.000Z")
      .put("settings", JSONObject().put("amount", 1.5))
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
