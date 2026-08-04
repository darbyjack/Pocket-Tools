package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12MultiSelectTest {
  @Test
  fun inspectsAndRendersDormantMultiSelectSettings() {
    val inspection = success(run(definition(), request("inspect")))
      .getJSONObject("value")
      .getJSONObject("inspection")
    val tags = inspection.getJSONObject("settings").getJSONObject("tags")

    assertEquals("multi-select", tags.getString("type"))
    assertJsonArrayEquals(JSONArray().put("work").put(true), tags.getJSONArray("default"))
    assertEquals(1, tags.getInt("minSelections"))
    assertEquals(3, tags.getInt("maxSelections"))

    val input = success(run(definition(), request("render").put("screen", "home").toString()))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")
      .getJSONObject(0)
    assertEquals("multi-select", input.getString("type"))
    assertEquals("tags", input.getString("setting"))
  }

  @Test
  fun canonicalizesActionWritesAndPreservesSameActionReads() {
    val operations = success(
      run(definition(), request("action").put("action", "setTags").toString()),
    ).getJSONObject("value").getJSONArray("operations")

    assertEquals(1, operations.length())
    assertEquals("setting-set", operations.getJSONObject(0).getString("type"))
    assertJsonArrayEquals(
      JSONArray().put("work").put(2),
      operations.getJSONObject(0).getJSONArray("value"),
    )

    val reset = success(
      run(definition(), request("action").put("action", "resetTags").toString()),
    ).getJSONObject("value").getJSONArray("operations")
    assertEquals("setting-reset", reset.getJSONObject(1).getString("type"))
  }

  @Test
  fun rejectsInvalidSelectionsAndStoredOrder() {
    for (action in listOf("duplicateTags", "unknownTag", "tooFewTags", "tooManyTags")) {
      assertEquals(
        "VALIDATION_FAILED",
        errorCode(run(definition(), request("action").put("action", action).toString())),
      )
    }

    val nonCanonicalRequest = request("render")
      .put("screen", "home")
      .put("settings", JSONObject().put("tags", JSONArray().put("personal").put("work")))
      .toString()
    assertEquals("VALIDATION_FAILED", errorCode(run(definition(), nonCanonicalRequest)))
  }

  @Test
  fun rejectsMultiSelectBelowSdk12AndInvalidVisibilityReferences() {
    val lowerVersion = definition().replace("sdkVersion: '1.2'", "sdkVersion: '1.1'")
    assertEquals("VALIDATION_FAILED", errorCode(run(lowerVersion, request("inspect"))))

    val invalidVisibility = definition().replace(
      "default: '',",
      "default: '', visibleWhen: { setting: 'tags', equals: 'work' },",
    )
    assertEquals("VALIDATION_FAILED", errorCode(run(invalidVisibility, request("inspect"))))
  }

  @Test
  fun rejectsMalformedDefinitionsAndUiBindings() {
    val duplicateOption = definition().replace(
      "{ label: 'Priority', value: 2 },",
      "{ label: 'Duplicate', value: 'work' },",
    )
    assertEquals("VALIDATION_FAILED", errorCode(run(duplicateOption, request("inspect"))))

    val invalidBounds = definition().replace("minSelections: 1,", "minSelections: 4,")
    assertEquals("VALIDATION_FAILED", errorCode(run(invalidBounds, request("inspect"))))

    val wrongBinding = definition().replace(
      "ui.multiSelect({ setting: 'tags', label: 'Tags' })",
      "ui.multiSelect({ setting: 'notes', label: 'Tags' })",
    )
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(wrongBinding, request("render").put("screen", "home").toString())),
    )
  }

  private fun definition(): String =
    """
      import { defineMiniApp, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: {
          id: 'multi-select-runtime-test',
          name: 'Multi-select Runtime Test',
          sdkVersion: '1.2',
        },
        settings: {
          tags: setting.multiSelect({
            label: 'Tags',
            options: [
              { label: 'Work', value: 'work' },
              { label: 'Personal', value: 'personal' },
              { label: 'Pinned', value: true },
              { label: 'Priority', value: 2 },
            ],
            default: [true, 'work'],
            minSelections: 1,
            maxSelections: 3,
          }),
          notes: setting.text({ label: 'Notes', default: '', }),
        },
        screens: {
          home(context) {
            const tags = context.settings.get('tags');
            if (!Array.isArray(tags) || tags[0] !== 'work') {
              throw new Error('multi-select screen snapshot was not decoded canonically');
            }
            return ui.page({
              title: 'Multi-select Runtime Test',
              children: [ui.multiSelect({ setting: 'tags', label: 'Tags' })],
            });
          },
        },
        actions: {
          setTags(context) {
            context.settings.set('tags', [2, 'work']);
            const tags = context.settings.get('tags');
            if (tags.length !== 2 || tags[0] !== 'work' || tags[1] !== 2) {
              throw new Error('same-action multi-select reads were not canonical');
            }
          },
          resetTags(context) {
            context.settings.set('tags', ['personal']);
            context.settings.reset('tags');
            const tags = context.settings.get('tags');
            if (tags.length !== 2 || tags[0] !== 'work' || tags[1] !== true) {
              throw new Error('multi-select reset did not restore the canonical default');
            }
          },
          duplicateTags(context) {
            context.settings.set('tags', ['work', 'work']);
          },
          unknownTag(context) {
            context.settings.set('tags', ['unknown']);
          },
          tooFewTags(context) {
            context.settings.set('tags', []);
          },
          tooManyTags(context) {
            context.settings.set('tags', ['work', 'personal', true, 2]);
          },
        },
      });
    """.trimIndent()

  private fun request(mode: String): JSONObject =
    JSONObject()
      .put("mode", mode)
      .put("now", "2026-08-04T18:15:00.000Z")
      .put("settings", JSONObject().put("tags", JSONArray().put("work").put(true)))
      .put("records", JSONObject())
      .put("timers", JSONObject())

  private fun run(source: String, request: JSONObject): String = run(source, request.toString())

  private fun run(source: String, requestJson: String): String =
    PocketQuickJsBridge.run(source, requestJson, SandboxLimits())

  private fun success(json: String): JSONObject {
    val response = JSONObject(json)
    assertTrue(json, response.getBoolean("ok"))
    return response
  }

  private fun errorCode(json: String): String =
    JSONObject(json).getJSONObject("error").getString("code")

  private fun assertJsonArrayEquals(expected: JSONArray, actual: JSONArray) {
    assertEquals(expected.toString(), actual.toString())
  }
}
