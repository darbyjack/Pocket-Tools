package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSandboxTest {
  private val inspectRequest = request("inspect")
  private val renderRequest = request("render")

  @Test
  fun interruptsInfiniteLoops() {
    val response = run(
      """
        while (true) {}
        ${definition("ui.page({ title: 'unreachable', children: [] })")}
      """.trimIndent(),
      inspectRequest,
      SandboxLimits(executionTimeoutMilliseconds = 50),
    )

    assertEquals("RUNTIME_TIMEOUT", errorCode(response))
  }

  @Test
  fun containsAllocationPressure() {
    val response = run(
      """
        const values = [];
        while (true) values.push('x'.repeat(4096));
        ${definition("ui.page({ title: 'unreachable', children: [] })")}
      """.trimIndent(),
      inspectRequest,
      SandboxLimits(
        runtimeMemoryBytes = 4 * 1024 * 1024,
        executionTimeoutMilliseconds = 2_000,
      ),
    )

    assertEquals("RUNTIME_MEMORY_LIMIT", errorCode(response))
  }

  @Test
  fun rejectsNonSerializableBridgeValues() {
    val response = run(
      definition(
        "ui.page({ title: 'Invalid', children: [ui.metric({ label: 'Big', value: 1n })] })",
      ),
      renderRequest,
    )

    assertEquals("INVALID_BRIDGE_VALUE", errorCode(response))
  }

  @Test
  fun rejectsUnsupportedModulesAndExposesNoHostGlobals() {
    val unsupportedImport = run(
      """
        import filesystem from 'node:fs';
        ${definition("ui.page({ title: String(filesystem), children: [] })")}
      """.trimIndent(),
      inspectRequest,
    )
    assertEquals("UNSUPPORTED_MODULE", errorCode(unsupportedImport))

    val globals = success(
      run(
        """
          if (
            typeof process !== 'undefined' ||
            typeof require !== 'undefined' ||
            typeof ExpoModulesCore !== 'undefined' ||
            typeof __pocketRequest !== 'undefined' ||
            typeof __pocketDefinition !== 'undefined'
          ) throw new Error('host global leaked');
          ${definition("ui.page({ title: 'Isolated', children: [] })")}
        """.trimIndent(),
        renderRequest,
      ),
    )
    assertEquals("Isolated", globals.getJSONObject("value").getJSONObject("page").getString("title"))
  }

  @Test
  fun createsASeparateRuntimeForEveryInvocation() {
    success(
      run(
        """
          globalThis.__sandboxLeak = 'first';
          ${definition("ui.page({ title: 'First', children: [] })")}
        """.trimIndent(),
        renderRequest,
      ),
    )

    val second = success(
      run(
        """
          if (globalThis.__sandboxLeak !== undefined) throw new Error('runtime state leaked');
          ${definition("ui.page({ title: 'Second', children: [] })")}
        """.trimIndent(),
        renderRequest,
      ),
    )
    assertEquals("Second", second.getJSONObject("value").getJSONObject("page").getString("title"))
  }

  @Test
  fun drainsPromiseJobsAndReportsUnhandledRejections() {
    val settled = success(
      run(
        """
          let title = 'Before';
          Promise.resolve().then(() => { title = 'After'; });
          ${definition("ui.page({ title, children: [] })")}
        """.trimIndent(),
        renderRequest,
      ),
    )
    assertEquals("After", settled.getJSONObject("value").getJSONObject("page").getString("title"))

    val rejected = run(
      """
        Promise.reject(new Error('promise failed'));
        ${definition("ui.page({ title: 'Rejected', children: [] })")}
      """.trimIndent(),
      renderRequest,
    )
    assertEquals("UNHANDLED_PROMISE_REJECTION", errorCode(rejected))
  }

  @Test
  fun capsLogsAndResultBytes() {
    val logged = success(
      run(
        """
          console.log('one');
          console.warn('two');
          console.error('three');
          ${definition("ui.page({ title: 'Logs', children: [] })")}
        """.trimIndent(),
        renderRequest,
        SandboxLimits(maximumLogEntries = 2, maximumLogBytes = 64),
      ),
    )
    assertEquals(2, logged.getJSONArray("logs").length())
    assertTrue(logged.getBoolean("logsTruncated"))

    val oversized = run(
      definition("ui.page({ title: 'x'.repeat(4096), children: [] })"),
      renderRequest,
      SandboxLimits(maximumResultBytes = 512),
    )
    assertEquals("RESULT_LIMIT_EXCEEDED", errorCode(oversized))
  }

  @Test
  fun returnsStructuredFailuresWithoutCrashingTheNextRun() {
    val malformed = run("export default {", inspectRequest)
    assertFalse(JSONObject(malformed).getBoolean("ok"))
    assertTrue(JSONObject(malformed).getJSONObject("error").has("code"))

    val next = success(
      run(
        definition("ui.page({ title: 'Recovered', children: [] })"),
        renderRequest,
      ),
    )
    assertEquals("Recovered", next.getJSONObject("value").getJSONObject("page").getString("title"))
  }

  @Test
  fun exposesFrozenSdkBuildersScreensAndActions() {
    val inspected = success(run(frozenDefinition(), inspectRequest))
      .getJSONObject("value")
      .getJSONObject("inspection")

    assertEquals(JSONArray(listOf("home", "details")).toString(), inspected.getJSONArray("screens").toString())
    assertEquals(JSONArray(listOf("mutate")).toString(), inspected.getJSONArray("actions").toString())
    assertEquals("text", inspected.getJSONObject("settings").getJSONObject("title").getString("type"))
    assertEquals(
      "boolean",
      inspected
        .getJSONObject("collections")
        .getJSONObject("entries")
        .getJSONObject("fields")
        .getJSONObject("complete")
        .getString("type"),
    )

    val rendered = success(
      run(
        frozenDefinition(),
        request("render", screen = "details", settings = frozenSettings()),
      ),
    ).getJSONObject("value").getJSONObject("page")

    assertEquals("Details", rendered.getString("title"))
    val children = rendered.getJSONArray("children")
    assertEquals("heading", children.getJSONObject(0).getString("type"))
    assertEquals("text-input", children.getJSONObject(1).getString("type"))
    assertEquals("toggle", children.getJSONObject(2).getString("type"))
    assertEquals("select", children.getJSONObject(3).getString("type"))
    assertEquals("navigation", children.getJSONObject(4).getString("type"))
  }

  @Test
  fun executesFrozenCrudQueriesAndProducesExplicitOperations() {
    val records = JSONObject().put(
      "entries",
      JSONArray()
        .put(record("11111111111111111111111111111111", "One", false, 1))
        .put(record("22222222222222222222222222222222", "Two", false, 3))
        .put(record("33333333333333333333333333333333", "Three", false, 4))
        .put(record("44444444444444444444444444444444", "Four", false, 6)),
    )

    val response = success(
      run(
        frozenDefinition(),
        request(
          "action",
          action = "mutate",
          settings = frozenSettings(),
          records = records,
        ),
      ),
    )
    val operations = response.getJSONObject("value").getJSONArray("operations")

    assertEquals(3, operations.length())
    assertEquals("update", operations.getJSONObject(0).getString("type"))
    assertEquals(
      "33333333333333333333333333333333",
      operations.getJSONObject(0).getString("id"),
    )
    assertTrue(operations.getJSONObject(0).getJSONObject("changes").getBoolean("complete"))
    assertEquals("remove", operations.getJSONObject(1).getString("type"))
    assertEquals(
      "11111111111111111111111111111111",
      operations.getJSONObject(1).getString("id"),
    )
    assertEquals("insert", operations.getJSONObject(2).getString("type"))
    assertEquals("New", operations.getJSONObject(2).getJSONObject("record").getString("title"))
  }

  private fun frozenDefinition(): String =
    """
      import { collection, defineMiniApp, field, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'frozen-sdk-test', name: 'Frozen SDK Test', sdkVersion: 1 },
        settings: {
          title: setting.text({ label: 'Title', default: 'Example', maxLength: 80 }),
          enabled: setting.boolean({ label: 'Enabled', default: true }),
          amount: setting.money({ label: 'Amount', default: 10, min: 0 }),
          mode: setting.select({
            label: 'Mode',
            default: 'one',
            options: [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }],
          }),
        },
        collections: {
          entries: collection({
            title: field.text({ maxLength: 100 }),
            complete: field.boolean(),
            score: field.number({ min: 0 }),
            amount: field.money({ optional: true, min: 0 }),
            dueAt: field.datetime({ optional: true }),
          }),
        },
        screens: {
          home() {
            return ui.page({
              title: 'Home',
              children: [
                ui.row({ children: [ui.text({ text: 'Ready' })] }),
                ui.navigation({ label: 'Details', screen: 'details' }),
              ],
            });
          },
          details() {
            return ui.page({
              title: 'Details',
              children: [
                ui.heading({ text: 'Editor', level: 2 }),
                ui.textInput({ setting: 'title' }),
                ui.toggle({ setting: 'enabled' }),
                ui.select({ setting: 'mode' }),
                ui.navigation({ label: 'Home', screen: 'home' }),
              ],
            });
          },
        },
        actions: {
          mutate(context) {
            const entries = context.data.collection('entries');
            const selected = entries.query({
              where: [
                { field: 'score', operator: 'gte', value: 2 },
                { field: 'score', operator: 'lte', value: 5 },
              ],
              orderBy: [{ field: 'score', direction: 'asc' }],
              offset: 1,
              limit: 1,
            });
            entries.update(selected[0].id, { complete: true });
            const first = entries.get('11111111111111111111111111111111');
            if (first !== null) entries.remove(first.id);
            entries.insert({ title: 'New', complete: false, score: 5, amount: null, dueAt: null });
          },
        },
      });
    """.trimIndent()

  private fun frozenSettings(): JSONObject =
    JSONObject()
      .put("title", "Example")
      .put("enabled", true)
      .put("amount", 10)
      .put("mode", "one")

  private fun record(
    id: String,
    title: String,
    complete: Boolean,
    score: Int,
  ): JSONObject =
    JSONObject()
      .put("id", id)
      .put("createdAt", "2026-08-03T10:00:00.000Z")
      .put("updatedAt", "2026-08-03T10:00:00.000Z")
      .put("title", title)
      .put("complete", complete)
      .put("score", score)
      .put("amount", JSONObject.NULL)
      .put("dueAt", JSONObject.NULL)

  private fun run(
    source: String,
    requestJson: String,
    limits: SandboxLimits = SandboxLimits(),
  ): String = PocketQuickJsBridge.run(source, requestJson, limits)

  private fun success(json: String): JSONObject {
    val response = JSONObject(json)
    assertTrue(json, response.getBoolean("ok"))
    return response
  }

  private fun errorCode(json: String): String =
    JSONObject(json).getJSONObject("error").getString("code")

  private fun request(
    mode: String,
    screen: String = "home",
    action: String? = null,
    settings: JSONObject = JSONObject(),
    records: JSONObject = JSONObject(),
  ): String =
    JSONObject()
      .put("mode", mode)
      .put("screen", screen)
      .apply { if (action != null) put("action", action) }
      .put("now", "2026-08-03T12:00:00.000Z")
      .put("settings", settings)
      .put("records", records)
      .put("timers", JSONObject())
      .toString()

  private fun definition(pageExpression: String): String =
    """
      import { defineMiniApp, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'sandbox-test', name: 'Sandbox Test', sdkVersion: 1 },
        screens: { home() { return $pageExpression; } },
      });
    """.trimIndent()
}
