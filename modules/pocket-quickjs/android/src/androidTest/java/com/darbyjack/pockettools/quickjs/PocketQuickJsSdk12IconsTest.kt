package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12IconsTest {
  @Test
  fun preservesEveryFrozenButtonIcon() {
    val icons = success(run(definition(), request("render").put("screen", "home")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")

    val expected = listOf(
      "add",
      "edit",
      "delete",
      "check",
      "calendar",
      "clock",
      "copy",
      "share",
      "search",
      "settings",
      "warning",
      "info",
      "money",
      "list",
      "refresh",
    )
    assertEquals(expected.size, icons.length())
    expected.forEachIndexed { index, icon ->
      val button = icons.getJSONObject(index)
      assertEquals("button", button.getString("type"))
      assertEquals(icon, button.getString("icon"))
      assertTrue(button.getString("label").isNotEmpty())
    }
  }

  @Test
  fun preservesListLeadingPrimaryAndVisibleActionIcons() {
    val item = success(run(definition(), request("render").put("screen", "list")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")
      .getJSONObject(0)
      .getJSONArray("items")
      .getJSONObject(0)

    assertEquals("calendar", item.getString("leadingIcon"))
    assertEquals("edit", item.getJSONObject("primaryAction").getString("icon"))
    assertEquals("refresh", item.getJSONArray("actions").getJSONObject(0).getString("icon"))
  }

  @Test
  fun rejectsIconsBelowSdk12AndMalformedIconFields() {
    val lowerVersion = singleIconDefinition("'add'", sdkVersion = "1.1")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(lowerVersion, request("render").put("screen", "home"))),
    )

    val unknown = singleIconDefinition("'download'")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(unknown, request("render").put("screen", "home"))),
    )

    val url = singleIconDefinition("'https://example.com/icon.svg'")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(url, request("render").put("screen", "home"))),
    )

    val customSize = singleIconDefinition("'add'", extraProperty = ", iconSize: 48")
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(customSize, request("render").put("screen", "home"))),
    )
  }

  @Test
  fun keepsSdk11ActionsAndListItemsUnchangedWithoutIcons() {
    val source =
      """
        import { defineMiniApp, ui } from '@pocket-tools/sdk';
        export default defineMiniApp({
          manifest: { id: 'legacy-icons-regression', name: 'Legacy', sdkVersion: '1.1' },
          screens: {
            home() {
              return ui.page({
                title: 'Legacy',
                children: [
                  ui.button({ label: 'Run', action: 'run' }),
                  ui.list({
                    items: [ui.listItem({
                      title: 'Item',
                      actions: [ui.action({ label: 'Run', action: 'run' })],
                    })],
                  }),
                ],
              });
            },
          },
          actions: { run() {} },
        });
      """.trimIndent()

    val children = success(run(source, request("render").put("screen", "home")))
      .getJSONObject("value")
      .getJSONObject("page")
      .getJSONArray("children")
    assertFalse(children.getJSONObject(0).has("icon"))
    val item = children.getJSONObject(1).getJSONArray("items").getJSONObject(0)
    assertFalse(item.has("leadingIcon"))
    assertFalse(item.getJSONArray("actions").getJSONObject(0).has("icon"))
  }

  private fun definition(): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      const iconNames = [
        'add', 'edit', 'delete', 'check', 'calendar', 'clock', 'copy', 'share',
        'search', 'settings', 'warning', 'info', 'money', 'list', 'refresh',
      ];
      export default defineMiniApp({
        manifest: {
          id: 'icons-runtime-test',
          name: 'Icons Runtime Test',
          sdkVersion: '1.2',
        },
        screens: {
          home() {
            return ui.page({
              title: 'Icons',
              children: iconNames.map((icon) =>
                ui.button({ label: `Use ${'$'}{icon}`, action: 'run', icon }),
              ),
            });
          },
          list() {
            return ui.page({
              title: 'List icons',
              children: [
                ui.list({
                  items: [
                    ui.listItem({
                      title: 'Appointment',
                      leadingIcon: 'calendar',
                      primaryAction: ui.action({
                        label: 'Open appointment',
                        action: 'run',
                        icon: 'edit',
                      }),
                      actions: [ui.action({ label: 'Refresh', action: 'run', icon: 'refresh' })],
                    }),
                  ],
                }),
              ],
            });
          },
        },
        actions: { run() {} },
      });
    """.trimIndent()

  private fun singleIconDefinition(
    iconExpression: String,
    sdkVersion: String = "1.2",
    extraProperty: String = "",
  ): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: {
          id: 'single-icon-runtime-test',
          name: 'Single Icon Runtime Test',
          sdkVersion: '$sdkVersion',
        },
        screens: {
          home() {
            return ui.page({
              title: 'Icon',
              children: [
                ui.button({ label: 'Run', action: 'run', icon: $iconExpression$extraProperty }),
              ],
            });
          },
        },
        actions: { run() {} },
      });
    """.trimIndent()

  private fun request(mode: String): JSONObject =
    JSONObject()
      .put("mode", mode)
      .put("now", "2026-08-04T21:15:00.000Z")
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
