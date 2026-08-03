// @ts-check

import { collection, defineMiniApp, field, setting, ui } from "@pocket-tools/sdk";

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

/** @param {Date} date */
function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
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

export default defineMiniApp({
  manifest: {
    id: "bathroom-pay",
    name: "Bathroom Pay",
    description: "Track bathroom-trip time and its gross pay equivalent.",
    icon: "timer",
    sdkVersion: 1,
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
    trips: collection({
      startedAt: field.datetime(),
      endedAt: field.datetime(),
      durationSeconds: field.number({ min: 0 }),
      grossEarnings: field.money({ min: 0 }),
      effectiveHourlyRate: field.money({ min: 0 }),
    }),
  },

  screens: {
    home(context) {
      const activeTrip = context.timers.get(TRIP_TIMER_ID);
      const today = totalsSince(context, startOfDay(new Date(context.now())));

      return ui.page({
        title: "Bathroom Pay",
        children: [
          ui.text({
            text: "Track a trip with a host-managed timer that remains correct after the app closes.",
          }),
          ui.section({
            title: "Current trip",
            children: [
              ui.timer({ timerId: TRIP_TIMER_ID, emptyValue: "00:00:00" }),
              ui.metric({
                label: "Gross earnings equivalent",
                value: 0,
                format: "money",
                ...(activeTrip === null
                  ? {}
                  : {
                      liveTimer: {
                        timerId: TRIP_TIMER_ID,
                        ratePerHour: effectiveHourlyRate(context),
                      },
                    }),
              }),
              ui.button({
                label: activeTrip === null ? "Start trip" : "End trip",
                action: activeTrip === null ? "startTrip" : "endTrip",
              }),
            ],
          }),
          ui.summary({
            title: "Today",
            values: [
              { label: "Trips", value: today.count, format: "number" },
              {
                label: "Time",
                value: today.durationSeconds,
                format: "duration",
              },
              {
                label: "Gross equivalent",
                value: today.grossEarnings,
                format: "money",
              },
            ],
          }),
          ui.row({
            children: [
              ui.navigation({ label: "History", screen: "history" }),
              ui.navigation({ label: "Pay settings", screen: "settings" }),
            ],
          }),
        ],
      });
    },

    history(context) {
      const trips = context.data.collection(TRIPS_COLLECTION).query({
        orderBy: [{ field: "startedAt", direction: "desc" }],
        limit: 50,
      });

      return ui.page({
        title: "Trip history",
        children: [
          ui.navigation({ label: "Back to timer", screen: "home" }),
          ui.list({
            title: "Recent trips",
            items: trips.map((trip) =>
              ui.listItem({
                title: String(trip.startedAt),
                subtitle: `${String(trip.durationSeconds)} seconds`,
                trailing: `$${Number(trip.grossEarnings).toFixed(2)}`,
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

    settings() {
      return ui.page({
        title: "Pay settings",
        children: [
          ui.navigation({ label: "Back to timer", screen: "home" }),
          ui.section({
            children: [
              ui.select({ setting: "payType" }),
              ui.numberInput({ setting: "hourlyRate" }),
              ui.numberInput({ setting: "annualSalary" }),
              ui.numberInput({ setting: "hoursPerWeek" }),
              ui.numberInput({ setting: "weeksPerYear" }),
            ],
          }),
        ],
      });
    },
  },

  actions: {
    startTrip(context) {
      context.timers.start(TRIP_TIMER_ID);
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
  },
});
