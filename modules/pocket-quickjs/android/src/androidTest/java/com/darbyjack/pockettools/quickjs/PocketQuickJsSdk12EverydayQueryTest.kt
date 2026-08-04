package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12EverydayQueryTest {
  @Test
  fun supportsFrozenOperatorMatrixAndAndCombinedFilters() {
    val response = success(run(definition(), actionRequest("verifyOperatorMatrix")))
    assertEquals(0, response.getJSONObject("value").getJSONArray("operations").length())
  }

  @Test
  fun computesNumericAggregatesAndEmptyResults() {
    val response = success(run(definition(), actionRequest("verifyAggregates")))
    assertEquals(0, response.getJSONObject("value").getJSONArray("operations").length())
  }

  @Test
  fun observesPriorMutationsInTheSameAction() {
    val operations = success(run(definition(), actionRequest("verifyMutations")))
      .getJSONObject("value")
      .getJSONArray("operations")
    assertEquals(3, operations.length())
    assertEquals("update", operations.getJSONObject(0).getString("type"))
    assertEquals("remove", operations.getJSONObject(1).getString("type"))
    assertEquals("insert", operations.getJSONObject(2).getString("type"))
  }

  @Test
  fun rejectsInvalidQueriesAndAggregateFields() {
    val actions = listOf(
      "invalidTextGt",
      "invalidBooleanContains",
      "invalidNumberContains",
      "invalidMalformedQuery",
      "invalidDateValue",
      "invalidUnknownField",
      "invalidNonFiniteFilter",
      "invalidAggregate",
      "invalidAggregateName",
    )
    for (action in actions) {
      assertEquals("VALIDATION_FAILED", errorCode(run(definition(), actionRequest(action))))
    }
  }

  @Test
  fun rejectsNonFiniteAggregateResults() {
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(definition(), overflowActionRequest())),
    )
  }

  @Test
  fun leavesSdk11QueryBehaviorUnchanged() {
    assertTrue(success(run(legacyDefinition(), legacyActionRequest("verifyEq"))).getBoolean("ok"))
    assertEquals(
      "VALIDATION_FAILED",
      errorCode(run(legacyDefinition(), legacyActionRequest("usesNeq"))),
    )
  }

  @Test
  fun preservesBaseDefinitionValidation() {
    assertEquals(
      "INVALID_SCRIPT",
      errorCode(run(malformedDefinition(), minimalActionRequest("broken"))),
    )
  }

  private fun definition(): String =
    """
      import { collection, defineMiniApp, field } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'everyday-query-test', name: 'Everyday Query Test', sdkVersion: '1.2' },
        collections: {
          entries: collection({
            name: field.text(),
            active: field.boolean(),
            amount: field.number({ optional: true }),
            cost: field.money({ optional: true }),
            dueDate: field.date(),
            recordedAt: field.datetime(),
          }),
        },
        screens: {
          home() {
            return { type: 'page', title: 'Queries', children: [] };
          },
        },
        actions: {
          verifyOperatorMatrix(context) {
            const entries = context.data.collection('entries');
            const requireCount = (query, expected, label) => {
              const actual = entries.count(query);
              if (actual !== expected) {
                throw new Error(label + ': expected ' + expected + ', received ' + actual);
              }
            };

            requireCount({ where: [{ field: 'name', operator: 'eq', value: 'Alpha' }] }, 1, 'text eq');
            requireCount({ where: [{ field: 'name', operator: 'neq', value: 'Alpha' }] }, 4, 'text neq');
            requireCount({ where: [{ field: 'name', operator: 'contains', value: 'café' }] }, 1, 'text contains');
            requireCount({ where: [{ field: 'name', operator: 'startsWith', value: 'ång' }] }, 1, 'text startsWith');
            requireCount({ where: [{ field: 'active', operator: 'neq', value: false }] }, 3, 'boolean neq');
            requireCount({
              where: [
                { field: 'amount', operator: 'gt', value: 10 },
                { field: 'amount', operator: 'lte', value: 30 },
              ],
            }, 2, 'numeric range');
            requireCount({ where: [{ field: 'dueDate', operator: 'gte', value: '2026-08-10' }] }, 4, 'date gte');
            requireCount({
              where: [{
                field: 'recordedAt',
                operator: 'lt',
                value: '2026-08-12T00:00:00.000Z',
              }],
            }, 2, 'datetime lt');
            requireCount({
              where: [
                { field: 'name', operator: 'contains', value: 'a' },
                { field: 'active', operator: 'eq', value: true },
                { field: 'amount', operator: 'gte', value: 10 },
              ],
            }, 2, 'AND filters');

            const paged = entries.query({
              orderBy: [{ field: 'dueDate', direction: 'asc' }],
              offset: 1,
              limit: 2,
            });
            if (paged.length !== 2 || paged[0].name !== 'CAFÉ Budget' || paged[1].name !== 'Ångström Notes') {
              throw new Error('ordering, offset, or limit changed');
            }
          },
          verifyAggregates(context) {
            const entries = context.data.collection('entries');
            if (entries.sum('amount') !== 60) throw new Error('sum did not skip optional values');
            if (entries.min('amount') !== 10) throw new Error('min is incorrect');
            if (entries.max('amount') !== 30) throw new Error('max is incorrect');
            if (entries.average('amount') !== 20) throw new Error('average is incorrect');
            if (entries.sum('cost') !== 20) throw new Error('money sum is incorrect');
            if (entries.average('cost') !== 5) throw new Error('money average is incorrect');

            const active = { where: [{ field: 'active', operator: 'eq', value: true }] };
            if (entries.sum('amount', active) !== 40) throw new Error('filtered sum is incorrect');
            if (entries.average('amount', active) !== 20) throw new Error('filtered average is incorrect');

            const empty = { where: [{ field: 'amount', operator: 'gt', value: 100 }] };
            if (entries.sum('amount', empty) !== 0) throw new Error('empty sum must be zero');
            if (entries.min('amount', empty) !== null) throw new Error('empty min must be null');
            if (entries.max('amount', empty) !== null) throw new Error('empty max must be null');
            if (entries.average('amount', empty) !== null) throw new Error('empty average must be null');
          },
          verifyMutations(context) {
            const entries = context.data.collection('entries');
            entries.update('11111111111111111111111111111111', { amount: 15 });
            entries.remove('22222222222222222222222222222222');
            entries.insert({
              name: 'Delta Added',
              active: true,
              amount: 40,
              cost: 5,
              dueDate: '2026-09-01',
              recordedAt: '2026-09-01T10:00:00.000Z',
            });

            if (entries.count({ where: [{ field: 'name', operator: 'startsWith', value: 'delta' }] }) !== 1) {
              throw new Error('insert was not visible to query');
            }
            if (entries.sum('amount') !== 85) throw new Error('mutations were not visible to sum');
            if (entries.min('amount') !== 15) throw new Error('mutations were not visible to min');
            if (entries.max('amount') !== 40) throw new Error('mutations were not visible to max');
            if (Math.abs(entries.average('amount') - (85 / 3)) > 1e-12) {
              throw new Error('mutations were not visible to average');
            }
          },
          invalidTextGt(context) {
            context.data.collection('entries').query({
              where: [{ field: 'name', operator: 'gt', value: 'Alpha' }],
            });
          },
          invalidBooleanContains(context) {
            context.data.collection('entries').query({
              where: [{ field: 'active', operator: 'contains', value: true }],
            });
          },
          invalidNumberContains(context) {
            context.data.collection('entries').query({
              where: [{ field: 'amount', operator: 'contains', value: 1 }],
            });
          },
          invalidMalformedQuery(context) {
            context.data.collection('entries').query({ where: 'not-an-array' });
          },
          invalidDateValue(context) {
            context.data.collection('entries').query({
              where: [{ field: 'dueDate', operator: 'eq', value: '2026-02-30' }],
            });
          },
          invalidUnknownField(context) {
            context.data.collection('entries').query({
              where: [{ field: 'missing', operator: 'eq', value: 'x' }],
            });
          },
          invalidNonFiniteFilter(context) {
            context.data.collection('entries').query({
              where: [{ field: 'amount', operator: 'eq', value: Infinity }],
            });
          },
          invalidAggregate(context) {
            context.data.collection('entries').average('name');
          },
          invalidAggregateName(context) {
            context.data.collection('entries').average(42);
          },
          verifyOverflow(context) {
            context.data.collection('entries').sum('amount');
          },
        },
      });
    """.trimIndent()

  private fun legacyDefinition(): String =
    """
      import { collection, defineMiniApp, field } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'legacy-query-test', name: 'Legacy Query Test', sdkVersion: '1.1' },
        collections: { entries: collection({ name: field.text() }) },
        screens: { home() { return { type: 'page', title: 'Legacy', children: [] }; } },
        actions: {
          verifyEq(context) {
            if (context.data.collection('entries').count({
              where: [{ field: 'name', operator: 'eq', value: 'Alpha' }],
            }) !== 1) throw new Error('legacy eq changed');
          },
          usesNeq(context) {
            context.data.collection('entries').query({
              where: [{ field: 'name', operator: 'neq', value: 'Alpha' }],
            });
          },
        },
      });
    """.trimIndent()

  private fun malformedDefinition(): String =
    """
      import { defineMiniApp } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'malformed-query-test', name: 'Malformed Query Test', sdkVersion: '1.2' },
        screens: { home() { return { type: 'page', title: 'Malformed', children: [] }; } },
        actions: { broken: 42 },
      });
    """.trimIndent()

  private fun actionRequest(action: String): String =
    baseRequest(action, records()).toString()

  private fun overflowActionRequest(): String =
    baseRequest(
      "verifyOverflow",
      JSONArray()
        .put(
          record(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "Huge A",
            true,
            Double.MAX_VALUE,
            1.0,
            "2026-08-01",
            "2026-08-01T10:00:00.000Z",
          ),
        )
        .put(
          record(
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "Huge B",
            true,
            Double.MAX_VALUE,
            1.0,
            "2026-08-02",
            "2026-08-02T10:00:00.000Z",
          ),
        ),
    ).toString()

  private fun legacyActionRequest(action: String): String =
    JSONObject()
      .put("mode", "action")
      .put("action", action)
      .put("now", "2026-08-04T04:30:00.000Z")
      .put("settings", JSONObject())
      .put(
        "records",
        JSONObject().put(
          "entries",
          JSONArray().put(
            JSONObject()
              .put("id", "11111111111111111111111111111111")
              .put("createdAt", "2026-08-01T10:00:00.000Z")
              .put("updatedAt", "2026-08-01T10:00:00.000Z")
              .put("name", "Alpha"),
          ),
        ),
      )
      .put("timers", JSONObject())
      .toString()

  private fun minimalActionRequest(action: String): String =
    JSONObject()
      .put("mode", "action")
      .put("action", action)
      .put("now", "2026-08-04T04:30:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

  private fun baseRequest(action: String, entries: JSONArray): JSONObject =
    JSONObject()
      .put("mode", "action")
      .put("action", action)
      .put("now", "2026-08-04T04:30:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject().put("entries", entries))
      .put("timers", JSONObject())

  private fun records(): JSONArray =
    JSONArray()
      .put(
        record(
          "11111111111111111111111111111111",
          "Alpha",
          true,
          10.0,
          2.0,
          "2026-08-01",
          "2026-08-01T10:00:00.000Z",
        ),
      )
      .put(
        record(
          "22222222222222222222222222222222",
          "CAFÉ Budget",
          false,
          20.0,
          4.0,
          "2026-08-10",
          "2026-08-10T10:00:00.000Z",
        ),
      )
      .put(
        record(
          "33333333333333333333333333333333",
          "Ångström Notes",
          true,
          JSONObject.NULL,
          JSONObject.NULL,
          "2026-08-12",
          "2026-08-12T10:00:00.000Z",
        ),
      )
      .put(
        record(
          "44444444444444444444444444444444",
          "Gamma",
          false,
          null,
          8.0,
          "2026-08-20",
          "2026-08-20T10:00:00.000Z",
        ),
      )
      .put(
        record(
          "55555555555555555555555555555555",
          "Omega",
          true,
          30.0,
          6.0,
          "2026-08-30",
          "2026-08-30T10:00:00.000Z",
        ),
      )

  private fun record(
    id: String,
    name: String,
    active: Boolean,
    amount: Any?,
    cost: Any?,
    dueDate: String,
    recordedAt: String,
  ): JSONObject {
    val value = JSONObject()
      .put("id", id)
      .put("createdAt", recordedAt)
      .put("updatedAt", recordedAt)
      .put("name", name)
      .put("active", active)
      .put("dueDate", dueDate)
      .put("recordedAt", recordedAt)
    if (amount != null) value.put("amount", amount)
    if (cost != null) value.put("cost", cost)
    return value
  }

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
