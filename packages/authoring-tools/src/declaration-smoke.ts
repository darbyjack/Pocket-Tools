import {
  collection,
  defineMiniApp,
  field,
  setting,
  ui,
  type SerializableValue,
} from "../../sdk-contract/dist/index.js";

export const declarationSmokeMiniApp = defineMiniApp({
  manifest: {
    id: "declaration-smoke",
    name: "Declaration Smoke",
    sdkVersion: "1.1",
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
      const entries = context.data.collection("entries").query();
      return ui.page({
        title: String(context.settings.get("label")),
        children: [
          ui.textInput({ setting: "label" }),
          ui.toggle({ setting: "enabled" }),
          ui.button({
            label: "Save",
            action: "save",
            input: { source: "smoke" },
            disabled: false,
          }),
          ui.list({
            items: entries.map((entry) =>
              ui.listItem({
                title: String(entry.label),
                actions: [
                  ui.action({
                    label: "Delete",
                    action: "remove",
                    input: entry.id,
                    intent: "destructive",
                    confirmation: { title: "Delete entry?" },
                  }),
                ],
              }),
            ),
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
        amount: isSerializableObject(input) && input.source === "smoke" ? 1 : null,
      });
    },
    remove(context, input) {
      if (typeof input !== "string") throw new Error("A record ID is required.");
      context.data.collection("entries").remove(input);
    },
  },
});

function isSerializableObject(
  value: SerializableValue | undefined,
): value is Readonly<Record<string, SerializableValue>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
