package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12EverydayQueryEdgeTest {
  @Test
  fun supportsQueriesAndAggregatesDuringScreenRendering() {
    val page = success(run(definition(), renderRequest(records())))
      .getJSONObject("value")
      .getJSONObject("page")
    assertEquals("matrix-ok", page.getJSONArray("children").getJSONObject(0).getString("text"))
  }

  @Test
  fun averagesLargeFiniteValuesWithoutOverflow() {
    val response = success(run(definition(), actionRequest("verifyLargeAverage", maximumRecords())))
    assertEquals(0, response.getJSONObject("value").getJSONArray("operations").length())
  }

  @Test
  fun rejectsInheritedFieldNames() {
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(definition(), actionRequest("invalidInheritedField", records()))),
    )
  }

  private fun definition(): String =
    """
      import { collection, defineMiniApp, field } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'query-edge-test', name: 'Query Edge Test', sdkVersion: '1.2' },
        collections: {
          values: collection({
            label: field.text(),
            active: field.boolean(),
            score: field.number(),
            price: field.money(),
            dueDate: field.date(),
            recordedAt: field.datetime(),
          }),
        },
        screens: {
          home(context) {
            const values = context.data.collection('values');
            const count = (fieldName, operator, value) => values.count({
              where: [{ field: fieldName, operator, value }],
            });
            const checks = [
              count('score', 'eq', 10) === 1,
              count('score', 'neq', 10) === 2,
              count('score', 'gte', 20) === 2,
              count('score', 'lt', 30) === 2,
              count('price', 'gt', 1) === 2,
              count('price', 'lte', 2) === 2,
              count('dueDate', 'eq', '2026-08-10') === 1,
              count('dueDate', 'neq', '2026-08-10') === 2,
              count('dueDate', 'lte', '2026-08-20') === 2,
              count('recordedAt', 'gt', '2026-08-10T00:00:00.000Z') === 2,
              count('recordedAt', 'gte', '2026-08-20T10:00:00.000Z') === 2,
              count('recordedAt', 'lte', '2026-08-20T10:00:00.000Z') === 2,
              values.min('score') === 10,
              values.max('score') === 30,
              values.average('score') === 20,
            ];
            if (!checks.every(Boolean)) throw new Error('query matrix check failed');
            return {
              type: 'page',
              title: 'Matrix',
              children: [{ type: 'text', text: 'matrix-ok' }],
            };
          },
        },
        actions: {
          verifyLargeAverage(context) {
            const average = context.data.collection('values').average('score');
            if (average !== Number.MAX_VALUE) throw new Error('large finite average overflowed');
          },
          invalidInheritedField(context) {
            context.data.collection('values').query({
              where: [{ field: 'constructor', operator: 'eq', value: 'x' }],
            });
          },
        },
      });
    """.trimIndent()

  private fun records(): JSONArray =
    JSONArray()
      .put(record("11111111111111111111111111111111", "A", true, 10.0, 1.0, "2026-08-10", "2026-08-10T10:00:00.000Z"))
      .put(record("22222222222222222222222222222222", "B", false, 20.0, 2.0, "2026-08-20", "2026-08-20T10:00:00.000Z"))
      .put(record("33333333333333333333333333333333", "C", true, 30.0, 3.0, "2026-08-30", "2026-08-30T10:00:00.000Z"))

  private fun maximumRecords(): JSONArray =
    JSONArray()
      .put(record("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "A", true, Double.MAX_VALUE, 1.0, "2026-08-10", "2026-08-10T10:00:00.000Z"))
      .put(record("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "B", true, Double.MAX_VALUE, 1.0, "2026-08-20", "2026-08-20T10:00:00.000Z"))

  private fun record(
    id: String,
    label: String,
    active: Boolean,
    score: Double,
    price: Double,
    dueDate: String,
    recordedAt: String,
  ): JSONObject =
    JSONObject()
      .put("id", id)
      .put("createdAt", recordedAt)
      .put("updatedAt", recordedAt)
      .put("label", label)
      .put("active", active)
      .put("score", score)
      .put("price", price)
      .put("dueDate", dueDate)
      .put("recordedAt", recordedAt)

  private fun renderRequest(values: JSONArray): String =
    baseRequest("render", values)
      .put("screen", "home")
      .toString()

  private fun actionRequest(action: String, values: JSONArray): String =
    baseRequest("action", values)
      .put("action", action)
      .toString()

  private fun baseRequest(mode: String, values: JSONArray): JSONObject =
    JSONObject()
      .put("mode", mode)
      .put("now", "2026-08-04T04:30:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject().put("values", values))
      .put("timers", JSONObject())

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
