// @ts-check

import {
  collection,
  defineMiniApp,
  field,
  setting,
  ui,
} from "@pocket-tools/sdk";

const TRIP_TIMER_ID = "currentTrip";
const TRIPS_COLLECTION = "trips";

/** @param {import("@pocket-tools/sdk").MiniAppContext} context */
function effectiveHourlyRate(context) {
  const payType = String(context.settings.get("payType"));
  if (payType === "hourly") {
    return Number(context.settings.get("hourlyRate"));
  }

  const annualSalary = Number(context.settings.get("annualSalary"));
  const hoursPerWeek = Number(context.settings.get("hoursPerWeek"));
  const weeksPerYear = Number(context.settings.get("weeksPerYear"));
  const paidHours = hoursPerWeek * weeksPerYear;
  return paidHours > 0 ? annualSalary / paidHours : 0;
}

/** @param {import("@pocket-tools/sdk").MiniAppContext} context */
function currentTripEarnings(context) {
  const timer = context.timers.get(TRIP_TIMER_ID);
  return timer === null ? 0 : (timer.elapsedSeconds / 3_600) * effectiveHourlyRate(context);
}

/** @param {Date} date */
function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** @param {Date} date */
function startOfWeek(date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const offset = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - offset);
  return result;
}

/** @param {Date} date */
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** @param {Date} date */
function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

/**
 * @param {import("@pocket-tools/sdk").MiniAppContext} context
 * @param {Date} since
 */
function totalsSince(context, since) {
  const trips = context.data.collection(TRIPS_COLLECTION);
  /** @type {import("@pocket-tools/sdk").CollectionQuery} */
  const query = {
    where: [{ field: "startedAt", operator: "gte", value: since.toISOString() }],
  };

  return {
    count: trips.count(query),
    durationSeconds: trips.sum("durationSeconds", query),
    grossEarnings: trips.sum("grossEarnings", query),
  };
}

/** @param {unknown} payload */
function recordIdFromPayload(payload) {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "id" in payload &&
    typeof payload.id === "string"
  ) {
    return payload.id;
  }
  throw new Error("Expected a record payload containing a string id.");
}

/** @param {readonly import("@pocket-tools/sdk").StoredRecord[]} records */
function toCsv(records) {
  const header = "startedAt,endedAt,durationSeconds,grossEarnings,notes";
  const rows = records.map((record) =>
    [
      record.startedAt,
      record.endedAt,
      record.durationSeconds,
      record.grossEarnings,
      record.notes ?? "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

export default defineMiniApp({
  manifest: {
    id: "bathroom-pay",
    name: "Bathroom Pay",
    description: "Track bathroom-trip time and its gross pay equivalent.",
    icon: "timer",
    sdkVersion: 1,
    version: 1,
    permissions: [
      {
        capability: "file-export",
        reason: "Export trip history as JSON or CSV files.",
      },
    ],
  },

  settings: {
    payType: setting.select({
      label: "Pay type",
      default: "hourly",
      options: [
        { label: "Hourly", value: "hourly" },
        { label: "Salary", value: "salary" },
      ],
    }),
    hourlyRate: setting.money({
      label: "Hourly rate",
      default: 25,
      min: 0,
      visibleWhen: { setting: "payType", equals: "hourly" },
    }),
    annualSalary: setting.money({
      label: "Annual gross salary",
      default: 75_000,
      min: 0,
      visibleWhen: { setting: "payType", equals: "salary" },
    }),
    hoursPerWeek: setting.number({
      label: "Paid hours per week",
      default: 40,
      min: 1,
      max: 168,
      visibleWhen: { setting: "payType", equals: "salary" },
    }),
    weeksPerYear: setting.number({
      label: "Paid weeks per year",
      default: 52,
      min: 1,
      max: 53,
      visibleWhen: { setting: "payType", equals: "salary" },
    }),
  },

  collections: {
    trips: collection(
      {
        startedAt: field.datetime(),
        endedAt: field.datetime(),
        durationSeconds: field.number({ min: 0 }),
        grossEarnings: field.money({ min: 0 }),
        effectiveHourlyRate: field.money({ min: 0 }),
        notes: field.text({ optional: true, maxLength: 500 }),
      },
      {
        indexes: [
          { fields: ["startedAt"] },
          { fields: ["endedAt"] },
        ],
      },
    ),
  },

  screens: {
    home(context) {
      const activeTrip = context.timers.get(TRIP_TIMER_ID);
      const now = new Date(context.now());
      const today = totalsSince(context, startOfDay(now));
      const week = totalsSince(context, startOfWeek(now));
      const month = totalsSince(context, startOfMonth(now));
      const year = totalsSince(context, startOfYear(now));
      const trips = context.data.collection(TRIPS_COLLECTION).query({
        orderBy: [{ field: "startedAt", direction: "desc" }],
        limit: 50,
      });

      return ui.page({
        title: "Bathroom Pay",
        children: [
          ui.section({
            title: "Current trip",
            children: [
              ui.timer({ timerId: TRIP_TIMER_ID, emptyValue: "00:00:00" }),
              ui.metric({
                label: "Gross earnings equivalent",
                value: currentTripEarnings(context),
                format: "money",
              }),
              ui.button({
                label: activeTrip === null ? "Start trip" : "End trip",
                action: activeTrip === null ? "startTrip" : "endTrip",
                variant: "primary",
              }),
            ],
          }),
          ui.summary({
            title: "Today",
            values: [
              { label: "Trips", value: today.count, format: "number" },
              { label: "Time", value: today.durationSeconds, format: "duration" },
              { label: "Gross equivalent", value: today.grossEarnings, format: "money" },
            ],
          }),
          ui.summary({
            title: "Longer periods",
            values: [
              { label: "This week", value: week.grossEarnings, format: "money" },
              { label: "This month", value: month.grossEarnings, format: "money" },
              { label: "This year", value: year.grossEarnings, format: "money" },
            ],
          }),
          ui.row({
            gap: "small",
            children: [
              ui.button({ label: "Export JSON", action: "exportJson", variant: "secondary" }),
              ui.button({ label: "Export CSV", action: "exportCsv", variant: "secondary" }),
              ui.link({ label: "Add manually", screen: "manualEntry" }),
            ],
          }),
          ui.list({
            title: "Recent trips",
            items: trips.map((trip) =>
              ui.listItem({
                title: String(trip.startedAt),
                subtitle: `${String(trip.durationSeconds)} seconds`,
                trailing: `$${Number(trip.grossEarnings).toFixed(2)}`,
                action: "deleteTrip",
                payload: { id: trip.id },
              }),
            ),
            emptyState: ui.emptyState({
              title: "No trips yet",
              description: "Start a trip to begin tracking.",
            }),
          }),
        ],
      });
    },

    manualEntry() {
      return ui.page({
        title: "Add trip",
        children: [
          ui.form({
            action: "addManualTrip",
            submitLabel: "Save trip",
            children: [
              ui.dateTimeInput({ name: "startedAt", label: "Started at", required: true }),
              ui.dateTimeInput({ name: "endedAt", label: "Ended at", required: true }),
              ui.textArea({ name: "notes", label: "Notes", required: false }),
            ],
          }),
        ],
      });
    },
  },

  actions: {
    startTrip(context) {
      context.timers.start(TRIP_TIMER_ID, { source: "live" });
    },

    endTrip(context) {
      const trip = context.timers.stop(TRIP_TIMER_ID);
      const rate = effectiveHourlyRate(context);
      context.data.collection(TRIPS_COLLECTION).insert({
        startedAt: trip.startedAt,
        endedAt: trip.endedAt,
        durationSeconds: trip.durationSeconds,
        effectiveHourlyRate: rate,
        grossEarnings: (trip.durationSeconds / 3_600) * rate,
      });
    },

    addManualTrip(context, payload) {
      if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Manual entry requires a form payload.");
      }

      const form = /** @type {Readonly<Record<string, import("@pocket-tools/sdk").SerializableValue>>} */ (payload);
      const startedAt = new Date(String(form.startedAt));
      const endedAt = new Date(String(form.endedAt));
      const durationSeconds = Math.max(0, (endedAt.getTime() - startedAt.getTime()) / 1_000);
      const rate = effectiveHourlyRate(context);

      context.data.collection(TRIPS_COLLECTION).insert({
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds,
        effectiveHourlyRate: rate,
        grossEarnings: (durationSeconds / 3_600) * rate,
        notes: String(form.notes ?? ""),
      });
    },

    deleteTrip(context, payload) {
      context.data.collection(TRIPS_COLLECTION).remove(recordIdFromPayload(payload));
    },

    async exportJson(context) {
      const records = context.data.collection(TRIPS_COLLECTION).query({
        orderBy: [{ field: "startedAt", direction: "asc" }],
      });
      await context.files.exportText({
        name: "bathroom-pay-trips.json",
        mimeType: "application/json",
        content: JSON.stringify(records, null, 2),
      });
    },

    async exportCsv(context) {
      const records = context.data.collection(TRIPS_COLLECTION).query({
        orderBy: [{ field: "startedAt", direction: "asc" }],
      });
      await context.files.exportText({
        name: "bathroom-pay-trips.csv",
        mimeType: "text/csv",
        content: toCsv(records),
      });
    },
  },

  tests: [
    {
      name: "hourly trip records elapsed earnings",
      async run(testContext) {
        testContext.setSetting("payType", "hourly");
        testContext.setSetting("hourlyRate", 60);
        await testContext.invoke("startTrip");
        testContext.advanceTime(600);
        await testContext.invoke("endTrip");
        testContext.render("home");
      },
    },
    {
      name: "salary mode renders",
      run(testContext) {
        testContext.setSetting("payType", "salary");
        testContext.setSetting("annualSalary", 104_000);
        testContext.setSetting("hoursPerWeek", 40);
        testContext.setSetting("weeksPerYear", 52);
        testContext.render("home");
      },
    },
    {
      name: "active trip survives a screen rerender",
      async run(testContext) {
        await testContext.invoke("startTrip");
        testContext.advanceTime(30);
        testContext.render("home");
      },
    },
    {
      name: "manual entry form renders",
      run(testContext) {
        testContext.render("manualEntry");
      },
    },
    {
      name: "empty history exports",
      async run(testContext) {
        await testContext.invoke("exportJson");
        await testContext.invoke("exportCsv");
      },
    },
  ],
});
