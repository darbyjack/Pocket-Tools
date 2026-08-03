package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
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

  private fun request(mode: String): String =
    JSONObject()
      .put("mode", mode)
      .put("screen", "home")
      .put("now", "2026-08-03T12:00:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
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
