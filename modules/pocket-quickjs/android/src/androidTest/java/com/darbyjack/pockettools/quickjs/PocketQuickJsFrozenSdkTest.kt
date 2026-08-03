package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsFrozenSdkTest {
  @Test
  fun executesEqGteAndLteFiltersWithoutCoercion() {
    val response = success(
      run(
        definition(
          """
            const entries = context.data.collection('entries');
            const matches = entries.query({
              where: [
                { field: 'complete', operator: 'eq', value: false },
                { field: 'score', operator: 'gte', value: 2 },
                { field: 'score', operator: 'lte', value: 4 },
              ],
              orderBy: [{ field: 'score', direction: 'asc' }],
              offset: 1,
              limit: 1,
            });
            if (matches.length !== 1 || matches[0].score !== 4) {
              throw new Error('typed filters returned the wrong record');
            }
            entries.insert({ title: 'Verified', complete: false, score: matches[0].score });
          """.trimIndent(),
        ),
        actionRequest(),
      ),
    )

    val operations = response.getJSONObject("value").getJSONArray("operations")
    assertEquals(1, operations.length())
    assertEquals("insert", operations.getJSONObject(0).getString("type"))
    assertEquals(4, operations.getJSONObject(0).getJSONObject("record").getInt("score"))
  }

  @Test
  fun rejectsRangeFiltersForTextAndMismatchedNumericValues() {
    val textRange = run(
      definition(
        "context.data.collection('entries').query({ where: [{ field: 'title', operator: 'gte', value: 'A' }] });",
      ),
      actionRequest(),
    )
    assertEquals("VALIDATION_FAILED", errorCode(textRange))

    val numericString = run(
      definition(
        "context.data.collection('entries').query({ where: [{ field: 'score', operator: 'eq', value: '2' }] });",
      ),
      actionRequest(),
    )
    assertEquals("VALIDATION_FAILED", errorCode(numericString))
  }

  @Test
  fun permitsNullEqualityOnlyForOptionalFields() {
    val valid = success(
      run(
        optionalDefinition(
          """
            const entries = context.data.collection('entries');
            if (entries.count({ where: [{ field: 'note', operator: 'eq', value: null }] }) !== 1) {
              throw new Error('optional null equality failed');
            }
          """.trimIndent(),
        ),
        actionRequest(includeOptional = true),
      ),
    )
    assertTrue(valid.getJSONObject("value").getJSONArray("operations").length() == 0)

    val invalid = run(
      optionalDefinition(
        "context.data.collection('entries').query({ where: [{ field: 'title', operator: 'eq', value: null }] });",
      ),
      actionRequest(includeOptional = true),
    )
    assertEquals("VALIDATION_FAILED", errorCode(invalid))
  }

  private fun definition(actionBody: String): String =
    """
      import { collection, defineMiniApp, field, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'filter-test', name: 'Filter Test', sdkVersion: 1 },
        collections: {
          entries: collection({
            title: field.text(),
            complete: field.boolean(),
            score: field.number(),
          }),
        },
        screens: {
          home() { return ui.page({ title: 'Filter Test', children: [] }); },
        },
        actions: {
          verify(context) { $actionBody },
        },
      });
    """.trimIndent()

  private fun optionalDefinition(actionBody: String): String =
    """
      import { collection, defineMiniApp, field, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'optional-filter-test', name: 'Optional Filter Test', sdkVersion: 1 },
        collections: {
          entries: collection({
            title: field.text(),
            note: field.text({ optional: true }),
          }),
        },
        screens: {
          home() { return ui.page({ title: 'Optional Filter Test', children: [] }); },
        },
        actions: {
          verify(context) { $actionBody },
        },
      });
    """.trimIndent()

  private fun actionRequest(includeOptional: Boolean = false): String {
    val records = JSONArray()
    if (includeOptional) {
      records.put(
        JSONObject()
          .put("id", "11111111111111111111111111111111")
          .put("createdAt", "2026-08-03T10:00:00.000Z")
          .put("updatedAt", "2026-08-03T10:00:00.000Z")
          .put("title", "One")
          .put("note", JSONObject.NULL),
      )
    } else {
      records
        .put(record("11111111111111111111111111111111", "One", false, 1))
        .put(record("22222222222222222222222222222222", "Two", false, 3))
        .put(record("33333333333333333333333333333333", "Three", false, 4))
        .put(record("44444444444444444444444444444444", "Four", true, 4))
    }

    return JSONObject()
      .put("mode", "action")
      .put("action", "verify")
      .put("now", "2026-08-03T12:00:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject().put("entries", records))
      .put("timers", JSONObject())
      .toString()
  }

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
