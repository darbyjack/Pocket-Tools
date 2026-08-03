export { DIAGNOSTIC_APP_ID_PREFIX } from "../storage/namespaces";

export function createLifecycleDiagnosticSource(
  appId: string,
  appName: string,
): string {
  return `// @ts-check

import { collection, defineMiniApp, field, setting, ui } from "@pocket-tools/sdk";

const COLLECTION = "sharedRecords";
const TIMER = "sharedTimer";

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
    sdkVersion: 1,
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
