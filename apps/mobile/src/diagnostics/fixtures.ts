export { DIAGNOSTIC_APP_ID_PREFIX } from "../storage/namespaces.ts";

export const NOTIFICATION_ACCEPTANCE_APP_ID = "notification-acceptance-fixture";
export const NOTIFICATION_ACCEPTANCE_APP_NAME = "Notification Acceptance";

export function createLifecycleDiagnosticSource(appId: string, appName: string): string {
  return `// @ts-check

import { collection, defineMiniApp, field, setting, ui } from "@pocket-tools/sdk";

const COLLECTION = "sharedRecords";
const TIMER = "sharedTimer";

/** @param {import("@pocket-tools/sdk").MiniAppContext} context */
function stateNodes(context) {
  const records = context.data.collection(COLLECTION).query();
  const timer = context.timers.get(TIMER);
  return [
    ui.text({ text: String(context.settings.get("sharedValue")) }),
    ui.metric({ label: "Records", value: records.length, format: "number" }),
    ui.text({ text: timer === null ? "Timer stopped" : "Timer active" }),
  ];
}

export default defineMiniApp({
  manifest: {
    id: ${JSON.stringify(appId)},
    name: ${JSON.stringify(appName)},
    description: "Internal lifecycle and isolation diagnostic fixture.",
    sdkVersion: "1.0",
  },
  settings: {
    sharedValue: setting.text({
      label: "Shared value",
      default: "unset",
      maxLength: 100,
    }),
  },
  collections: {
    sharedRecords: collection({
      value: field.text({ maxLength: 100 }),
    }),
  },
  screens: {
    home(context) {
      return ui.page({
        title: ${JSON.stringify(appName)},
        children: [
          ...stateNodes(context),
          ui.navigation({ label: "Details", screen: "details" }),
        ],
      });
    },
    details(context) {
      return ui.page({
        title: "Diagnostic details",
        children: [
          ...stateNodes(context),
          ui.navigation({ label: "Back", screen: "home" }),
        ],
      });
    },
  },
  actions: {
    seed(context) {
      const value = String(context.settings.get("sharedValue"));
      context.data.collection(COLLECTION).insert({ value });
      context.timers.start(TIMER);
    },
    addRecord(context) {
      context.data.collection(COLLECTION).insert({
        value: String(context.settings.get("sharedValue")),
      });
    },
    stopTimer(context) {
      context.timers.stop(TIMER);
    },
    fail() {
      throw new Error("Intentional lifecycle diagnostic failure");
    },
  },
});
`;
}

export function createNotificationAcceptanceSource(): string {
  return `// @ts-check

import { defineMiniApp, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: ${JSON.stringify(NOTIFICATION_ACCEPTANCE_APP_ID)},
    name: ${JSON.stringify(NOTIFICATION_ACCEPTANCE_APP_NAME)},
    description: "Temporary internal target for Android notification acceptance testing.",
    sdkVersion: "1.0",
  },
  screens: {
    home() {
      return ui.page({
        title: ${JSON.stringify(NOTIFICATION_ACCEPTANCE_APP_NAME)},
        children: [
          ui.text({
            text: "Use Settings → Diagnostics to create and cancel physical notification tests.",
          }),
          ui.navigation({ label: "Open tap target", screen: "details", input: { source: "manual" } }),
        ],
      });
    },
    details(_context, input) {
      return ui.page({
        title: "Notification tap target",
        children: [
          ui.text({
            text:
              input === undefined
                ? "No notification input was supplied."
                : "Opened with: " + JSON.stringify(input),
          }),
          ui.navigation({ label: "Back", screen: "home" }),
        ],
      });
    },
  },
});
`;
}
