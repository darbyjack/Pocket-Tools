package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12ProgressTest {
  @Test
  fun rendersDormantProgressNodesAndPreservesOriginalValues() {
    val children = success(run(definition(), request("render").put("screen", "home")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")

    val defaults = children.getJSONObject(0)
    assertEquals("progress", defaults.getString("type"))
    assertEquals(25.0, defaults.getDouble("value"), 0.0)
    assertFalse(defaults.has("min"))
    assertFalse(defaults.has("max"))
    assertFalse(defaults.has("format"))

    val ranged = children.getJSONObject(1)
    assertEquals("progress", ranged.getString("type"))
    assertEquals("Upload", ranged.getString("label"))
    assertEquals(15.0, ranged.getDouble("value"), 0.0)
    assertEquals(10.0, ranged.getDouble("min"), 0.0)
    assertEquals(30.0, ranged.getDouble("max"), 0.0)
    assertEquals("percent", ranged.getString("format"))

    val overflow = children.getJSONObject(2)
      .getJSONArray("children")
      .getJSONObject(0)
    assertEquals("progress", overflow.getString("type"))
    assertEquals(150.0, overflow.getDouble("value"), 0.0)
    assertEquals(100.0, overflow.getDouble("max"), 0.0)
  }

  @Test
  fun rejectsProgressNodesBelowSdk12() {
    val lowerVersion = definition().replace("sdkVersion: '1.2'", "sdkVersion: '1.1'")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(lowerVersion, request("render").put("screen", "home"))),
    )
  }

  @Test
  fun rejectsMalformedProgressValuesBoundsFormatsAndProperties() {
    val nonFiniteValue = definition().replace("value: 25", "value: Infinity")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(nonFiniteValue, request("render").put("screen", "home"))),
    )

    val nonFiniteMinimum = definition().replace("min: 10", "min: NaN")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(nonFiniteMinimum, request("render").put("screen", "home"))),
    )

    val reversedRange = definition().replace("max: 30", "max: 10")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(reversedRange, request("render").put("screen", "home"))),
    )

    val invalidFormat = definition().replace("format: 'percent'", "format: 'ratio'")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(invalidFormat, request("render").put("screen", "home"))),
    )

    val invalidLabel = definition().replace("label: 'Upload'", "label: 7")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(invalidLabel, request("render").put("screen", "home"))),
    )

    val customColor = definition().replace(
      "ui.progress({ value: 25 })",
      "ui.progress({ value: 25, color: 'green' })",
    )
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(customColor, request("render").put("screen", "home"))),
    )
  }

  @Test
  fun keepsSdk11MetricRenderingUnchanged() {
    val source =
      """
        import { defineMiniApp, ui } from '@pocket-tools/sdk';
        export default defineMiniApp({
          manifest: { id: 'legacy-progress-regression', name: 'Legacy', sdkVersion: '1.1' },
          screens: {
            home() {
              return ui.page({
                title: 'Legacy',
                children: [ui.metric({ label: 'Count', value: 7, format: 'number' })],
              });
            },
          },
        });
      """.trimIndent()

    val child = success(run(source, request("render").put("screen", "home")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")
      .getJSONObject(0)
    assertEquals("metric", child.getString("type"))
    assertEquals("Count", child.getString("label"))
    assertEquals(7.0, child.getDouble("value"), 0.0)
  }

  private fun definition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: {
          id: 'progress-runtime-test',
          name: 'Progress Runtime Test',
          sdkVersion: '1.2',
        },
        screens: {
          home() {
            return ui.page({
              title: 'Progress Runtime Test',
              children: [
                ui.progress({ value: 25 }),
                ui.progress({
                  label: 'Upload',
                  value: 15,
                  min: 10,
                  max: 30,
                  format: 'percent',
                }),
                ui.column({
                  children: [
                    ui.progress({
                      label: 'Over capacity',
                      value: 150,
                      min: 0,
                      max: 100,
                      format: 'percent',
                    }),
                  ],
                }),
              ],
            });
          },
        },
      });
    """.trimIndent()

  private fun request(mode: String): JSONObject =
    JSONObject()
      .put("mode", mode)
      .put("now", "2026-08-04T20:45:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
      .put("timers", JSONObject())

  private fun run(source: String, request: JSONObject): String =
    PocketQuickJsBridge.run(source, request.toString(), SandboxLimits())

  private fun success(json: String): JSONObject {
    val response = JSONObject(json)
    assertTrue(json, response.getBoolean("ok"))
    return response
  }

  private fun errorCode(json: String): String =
    JSONObject(json).getJSONObject("error").getString("code")
}
