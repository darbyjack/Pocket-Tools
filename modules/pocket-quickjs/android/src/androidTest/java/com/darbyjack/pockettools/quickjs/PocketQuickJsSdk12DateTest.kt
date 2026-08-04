package com.darbyjack.pockettools.quickjs

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketQuickJsSdk12DateTest {
  @Test
  fun inspectsAndRendersDateDefinitionsAndInputs() {
    val inspection = success(run(definition(), inspectRequest()))
      .getJSONObject("value")
      .getJSONObject("inspection")

    assertEquals("1.2", inspection.getJSONObject("manifest").getString("sdkVersion"))
    assertEquals("date", inspection.getJSONObject("settings").getJSONObject("dueDate").getString("type"))
    assertEquals(
      "datetime",
      inspection.getJSONObject("settings").getJSONObject("reminderAt").getString("type"),
    )

    val page = success(run(definition(), renderRequest()))
      .getJSONObject("value")
      .getJSONObject("page")
    val children = page.getJSONArray("children")
    assertEquals("date-input", children.getJSONObject(0).getString("type"))
    assertEquals("datetime-input", children.getJSONObject(1).getString("type"))
  }

  @Test
  fun rejectsTemporalDefinitionsBelowSdk12() {
    val source = definition().replace("sdkVersion: '1.2'", "sdkVersion: '1.1'")
    assertEquals("VALIDATION_FAILED", errorCode(run(source, inspectRequest())))
  }

  @Test
  fun validatesCanonicalActionWritesAndBounds() {
    val valid = success(run(definition(), actionRequest("saveValid")))
      .getJSONObject("value")
      .getJSONArray("operations")
    assertEquals(2, valid.length())
    assertEquals("2026-08-15", valid.getJSONObject(0).getString("value"))
    assertEquals("2026-08-15T14:30:00.000Z", valid.getJSONObject(1).getString("value"))

    assertEquals("VALIDATION_FAILED", errorCode(run(definition(), actionRequest("saveInvalidDate"))))
    assertEquals("VALIDATION_FAILED", errorCode(run(definition(), actionRequest("saveOffsetDateTime"))))
    assertEquals("VALIDATION_FAILED", errorCode(run(definition(), actionRequest("saveOutOfRange"))))
  }

  @Test
  fun queriesCanonicalDatesAndDateTimesChronologically() {
    val response = success(run(definition(), actionRequest("verifyQueries")))
    assertTrue(response.getJSONObject("value").getJSONArray("operations").length() == 0)
  }

  private fun definition(): String =
    """
      import { collection, defineMiniApp, field, setting, ui } from '@pocket-tools/sdk';
      export default defineMiniApp({
        manifest: { id: 'date-runtime-test', name: 'Date Runtime Test', sdkVersion: '1.2' },
        settings: {
          dueDate: setting.date({
            label: 'Due date',
            default: '2026-08-03',
            min: '2026-01-01',
            max: '2026-12-31',
          }),
          reminderAt: setting.datetime({
            label: 'Reminder',
            default: '2026-08-04T03:30:00.000Z',
            min: '2026-01-01T00:00:00.000Z',
            max: '2026-12-31T23:59:59.999Z',
          }),
        },
        collections: {
          entries: collection({
            dueDate: field.date(),
            recordedAt: field.datetime(),
          }),
        },
        screens: {
          home() {
            return ui.page({
              title: 'Date Runtime Test',
              children: [
                ui.dateInput({ setting: 'dueDate' }),
                ui.datetimeInput({ setting: 'reminderAt' }),
              ],
            });
          },
        },
        actions: {
          saveValid(context) {
            context.settings.set('dueDate', '2026-08-15');
            context.settings.set('reminderAt', '2026-08-15T14:30:00.000Z');
          },
          saveInvalidDate(context) {
            context.settings.set('dueDate', '2026-02-30');
          },
          saveOffsetDateTime(context) {
            context.settings.set('reminderAt', '2026-08-15T09:30:00.000-05:00');
          },
          saveOutOfRange(context) {
            context.settings.set('dueDate', '2027-01-01');
          },
          verifyQueries(context) {
            const entries = context.data.collection('entries');
            const laterDates = entries.query({
              where: [{ field: 'dueDate', operator: 'gt', value: '2026-08-03' }],
              orderBy: [{ field: 'dueDate', direction: 'asc' }],
            });
            if (laterDates.length !== 2 || laterDates[0].dueDate !== '2026-08-10') {
              throw new Error('date gt query did not preserve chronological order');
            }
            const earlierTimes = entries.query({
              where: [{
                field: 'recordedAt',
                operator: 'lt',
                value: '2026-08-12T00:00:00.000Z',
              }],
            });
            if (earlierTimes.length !== 2) throw new Error('datetime lt query returned the wrong count');
            if (entries.count({
              where: [{ field: 'dueDate', operator: 'neq', value: '2026-08-10' }],
            }) !== 2) throw new Error('date neq query returned the wrong count');
          },
        },
      });
    """.trimIndent()

  private fun inspectRequest(): String =
    JSONObject()
      .put("mode", "inspect")
      .put("now", "2026-08-04T03:30:00.000Z")
      .put("settings", JSONObject())
      .put("records", JSONObject())
      .put("timers", JSONObject())
      .toString()

  private fun renderRequest(): String =
    baseRequest("render")
      .put("screen", "home")
      .toString()

  private fun actionRequest(action: String): String =
    baseRequest("action")
      .put("action", action)
      .toString()

  private fun baseRequest(mode: String): JSONObject =
    JSONObject()
      .put("mode", mode)
      .put("now", "2026-08-04T03:30:00.000Z")
      .put(
        "settings",
        JSONObject()
          .put("dueDate", "2026-08-03")
          .put("reminderAt", "2026-08-04T03:30:00.000Z"),
      )
      .put(
        "records",
        JSONObject().put(
          "entries",
          JSONArray()
            .put(record("11111111111111111111111111111111", "2026-08-03", "2026-08-03T10:00:00.000Z"))
            .put(record("22222222222222222222222222222222", "2026-08-10", "2026-08-10T10:00:00.000Z"))
            .put(record("33333333333333333333333333333333", "2026-08-20", "2026-08-20T10:00:00.000Z")),
        ),
      )
      .put("timers", JSONObject())

  private fun record(
    id: String,
    dueDate: String,
    recordedAt: String,
  ): JSONObject =
    JSONObject()
      .put("id", id)
      .put("createdAt", recordedAt)
      .put("updatedAt", recordedAt)
      .put("dueDate", dueDate)
      .put("recordedAt", recordedAt)

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
