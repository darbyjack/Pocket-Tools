package com.darbyjack.pockettools.quickjs

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12ListRowTest {
  @Test
  fun rendersPrimaryAndVisibleActionsTogether() {
    val page = success(run(definition(validPrimaryAction()), renderRequest()))
      .getJSONObject("value")
      .getJSONObject("page")
    val item = page
      .getJSONArray("children")
      .getJSONObject(0)
      .getJSONArray("items")
      .getJSONObject(0)

    val primary = item.getJSONObject("primaryAction")
    assertEquals("Open Entry", primary.getString("label"))
    assertEquals("openEntry", primary.getString("action"))
    assertEquals("entry-1", primary.getJSONObject("input").getString("id"))
    assertFalse(primary.getBoolean("disabled"))
    assertEquals(1, item.getJSONArray("actions").length())
  }

  @Test
  fun rejectsPrimaryActionsBelowSdk12() {
    val source = definition(validPrimaryAction()).replace("sdkVersion: '1.2'", "sdkVersion: '1.1'")
    assertEquals("INVALID_UI_TREE", errorCode(run(source, renderRequest())))
  }

  @Test
  fun requiresConfirmationForDestructivePrimaryActions() {
    val destructive = """
      ui.action({
        label: 'Remove Entry',
        action: 'removeEntry',
        intent: 'destructive',
      })
    """.trimIndent()
    assertEquals("INVALID_UI_TREE", errorCode(run(definition(destructive), renderRequest())))

    val confirmed = """
      ui.action({
        label: 'Remove Entry',
        action: 'removeEntry',
        intent: 'destructive',
        confirmation: {
          title: 'Remove entry?',
          message: 'This cannot be undone.',
          confirmLabel: 'Remove',
          cancelLabel: 'Keep',
        },
      })
    """.trimIndent()
    assertTrue(success(run(definition(confirmed), renderRequest())).getBoolean("ok"))
  }

  @Test
  fun rejectsUnknownTargetsUnsafeInputsAndExtraProperties() {
    val unknownTarget = "ui.action({ label: 'Open', action: 'missingAction' })"
    assertEquals("INVALID_UI_TREE", errorCode(run(definition(unknownTarget), renderRequest())))

    val unsafeInput = "ui.action({ label: 'Open', action: 'openEntry', input: Infinity })"
    assertEquals("INVALID_BRIDGE_VALUE", errorCode(run(definition(unsafeInput), renderRequest())))

    val extraProperty = "ui.action({ label: 'Open', action: 'openEntry', style: 'unsafe' })"
    assertEquals("VALIDATION_FAILED", errorCode(run(definition(extraProperty), renderRequest())))
  }

  private fun validPrimaryAction(): String =
    """
      ui.action({
        label: 'Open Entry',
        action: 'openEntry',
        input: { id: 'entry-1' },
        disabled: false,
      })
    """.trimIndent()

  private fun definition(primaryAction: String): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'list-row-test', name: 'List Row Test', sdkVersion: '1.2' },
        screens: {
          home() {
            return ui.page({
              title: 'Rows',
              children: [
                ui.list({
                  items: [
                    ui.listItem({
                      title: 'Entry',
                      subtitle: 'Details',
                      trailing: 'Open',
                      primaryAction: $primaryAction,
                      actions: [
                        ui.action({ label: 'Archive', action: 'archiveEntry', input: 'entry-1' }),
                      ],
                    }),
                  ],
                }),
              ],
            });
          },
        },
        actions: {
          openEntry() {},
          archiveEntry() {},
          removeEntry() {},
        },
      });
    """.trimIndent()

  private fun renderRequest(): String =
    JSONObject()
      .put("mode", "render")
      .put("screen", "home")
      .put("now", "2026-08-04T04:00:00.000Z")
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
