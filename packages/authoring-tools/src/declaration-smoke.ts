import {
  collection,
  defineMiniApp,
  field,
  setting,
  ui,
} from "../../sdk-contract/dist/index.js";

export const declarationSmokeMiniApp = defineMiniApp({
  manifest: {
    id: "declaration-smoke",
    name: "Declaration Smoke",
    sdkVersion: 1,
  },
  settings: {
    label: setting.text({ label: "Label", default: "Example" }),
    enabled: setting.boolean({ label: "Enabled", default: true }),
  },
  collections: {
    entries: collection({
      label: field.text(),
      enabled: field.boolean(),
      amount: field.money({ optional: true }),
    }),
  },
  screens: {
    home(context) {
      return ui.page({
        title: String(context.settings.get("label")),
        children: [
          ui.textInput({ setting: "label" }),
          ui.toggle({ setting: "enabled" }),
          ui.button({
            label: "Save",
            action: "save",
            input: { source: "smoke" },
          }),
        ],
      });
    },
  },
  actions: {
    save(context, input) {
      context.data.collection("entries").insert({
        label: String(context.settings.get("label")),
        enabled: Boolean(context.settings.get("enabled")),
        amount:
          input !== null &&
          typeof input === "object" &&
          !Array.isArray(input) &&
          input.source === "smoke"
            ? 1
            : null,
      });
    },
  },
});
