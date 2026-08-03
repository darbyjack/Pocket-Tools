package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsInteractionInputTest {
  @Test
  fun passesSerializableInputToScreensAndActions() {
    val rendered = success(
      run(
        request("render")
          .put("screen", "details")
          .put("screenInput", JSONObject().put("id", "entry-7")),
      ),
    )
    assertEquals(
      "Entry entry-7",
      rendered.getJSONObject("value").getJSONObject("page").getString("title"),
    )

    val action = success(
      run(
        request("action")
          .put("action", "removeEntry")
          .put(
            "actionInput",
            JSONObject().put("id", "11111111111111111111111111111111"),
          )
          .put(
            "records",
            JSONObject().put(
              "entries",
              org.json.JSONArray().put(
                JSONObject()
                  .put("id", "11111111111111111111111111111111")
                  .put("createdAt", "2026-08-03T10:00:00.000Z")
                  .put("updatedAt", "2026-08-03T10:00:00.000Z")
                  .put("title", "Delete me"),
              ),
            ),
          ),
      ),
    )
    val operation = action
      .getJSONObject("value")
      .getJSONArray("operations")
      .getJSONObject(0)
    assertEquals("remove", operation.getString("type"))
    assertEquals("11111111111111111111111111111111", operation.getString("id"))
  }

  private fun source(): String =
    """
      import { collection, defineMiniApp, field, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'interaction-input', name: 'Interaction Input', sdkVersion: 1 },
        collections: { entries: collection({ title: field.text() }) },
        screens: {
          home() {
            return ui.page({
              title: 'Home',
              children: [
                ui.navigation({ label: 'Open', screen: 'details', input: { id: 'entry-7' } }),
              ],
            });
          },
          details(context, input) {
            return ui.page({
              title: `Entry ${'$'}{input.id}`,
              children: [
                ui.button({
                  label: 'Remove',
                  action: 'removeEntry',
                  input: { id: '11111111111111111111111111111111' },
                }),
              ],
            });
          },
        },
        actions: {
          removeEntry(context, input) {
            context.data.collection('entries').remove(input.id);
          },
        },
      });
    """.trimIndent()

  private fun request(mode: String): JSONObject =
    JSONObject()
      .put("mode", mode)
      .put("now", "2026-08-03T12:00:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
      .put("timers", JSONObject())

  private fun run(request: JSONObject): String =
    PocketQuickJsBridge.run(source(), request.toString(), SandboxLimits())

  private fun success(json: String): JSONObject {
    val response = JSONObject(json)
    assertTrue(json, response.getBoolean("ok"))
    return response
  }
}
