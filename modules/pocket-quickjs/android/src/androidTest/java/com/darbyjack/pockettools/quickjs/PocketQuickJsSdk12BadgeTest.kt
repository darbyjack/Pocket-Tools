package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12BadgeTest {
  @Test
  fun rendersDormantBadgeNodesAndPreservesSemanticTones() {
    val children = success(run(definition(), request("render").put("screen", "home")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")

    val neutral = children.getJSONObject(0)
    assertEquals("badge", neutral.getString("type"))
    assertEquals("Pending", neutral.getString("text"))
    assertFalse(neutral.has("tone"))

    val success = children.getJSONObject(1)
    assertEquals("badge", success.getString("type"))
    assertEquals("Saved", success.getString("text"))
    assertEquals("success", success.getString("tone"))

    val nested = children.getJSONObject(2)
      .getJSONArray("children")
      .getJSONObject(0)
    assertEquals("badge", nested.getString("type"))
    assertEquals("warning", nested.getString("tone"))
  }

  @Test
  fun rejectsBadgeNodesBelowSdk12() {
    val lowerVersion = definition().replace("sdkVersion: '1.2'", "sdkVersion: '1.1'")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(lowerVersion, request("render").put("screen", "home"))),
    )
  }

  @Test
  fun rejectsMalformedBadgeTextToneAndProperties() {
    val emptyText = definition().replace("text: 'Pending'", "text: ''")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(emptyText, request("render").put("screen", "home"))),
    )

    val longText = definition().replace("text: 'Pending'", "text: 'x'.repeat(81)")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(longText, request("render").put("screen", "home"))),
    )

    val invalidTone = definition().replace("tone: 'success'", "tone: 'purple'")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(invalidTone, request("render").put("screen", "home"))),
    )

    val customColor = definition().replace(
      "ui.badge({ text: 'Pending' })",
      "ui.badge({ text: 'Pending', color: 'green' })",
    )
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(customColor, request("render").put("screen", "home"))),
    )
  }

  @Test
  fun keepsSdk11TextRenderingUnchanged() {
    val source =
      """
        import { defineMiniApp, ui } from '@pocket-tools/sdk';
        export default defineMiniApp({
          manifest: { id: 'legacy-badge-regression', name: 'Legacy', sdkVersion: '1.1' },
          screens: {
            home() {
              return ui.page({ title: 'Legacy', children: [ui.text({ text: 'Still text' })] });
            },
          },
        });
      """.trimIndent()

    val child = success(run(source, request("render").put("screen", "home")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")
      .getJSONObject(0)
    assertEquals("text", child.getString("type"))
    assertEquals("Still text", child.getString("text"))
  }

  private fun definition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: {
          id: 'badge-runtime-test',
          name: 'Badge Runtime Test',
          sdkVersion: '1.2',
        },
        screens: {
          home() {
            return ui.page({
              title: 'Badge Runtime Test',
              children: [
                ui.badge({ text: 'Pending' }),
                ui.badge({ text: 'Saved', tone: 'success' }),
                ui.row({ children: [ui.badge({ text: 'Needs attention', tone: 'warning' })] }),
              ],
            });
          },
        },
      });
    """.trimIndent()

  private fun request(mode: String): JSONObject =
    JSONObject()
      .put("mode", mode)
      .put("now", "2026-08-04T20:10:00.000Z")
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
