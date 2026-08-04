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
    sdkVersion: "1.2",
  },
  settings: {
    label: setting.text({ label: "Label", default: "Example" }),
    dueDate: setting.date({ label: "Due date", default: "2026-08-04" }),
    startsAt: setting.datetime({
      label: "Starts at",
      default: "2026-08-04T12:00:00.000Z",
    }),
    tags: setting.multiSelect({
      label: "Tags",
      default: ["home"],
      options: [
        { label: "Home", value: "home" },
        { label: "Work", value: "work" },
      ],
      maxSelections: 2,
    }),
  },
  collections: {
    entries: collection({
      label: field.text(),
      dueDate: field.date(),
      startsAt: field.datetime(),
      amount: field.money({ optional: true }),
    }),
  },
  screens: {
    home(context) {
      const entries = context.data.collection("entries").query({
        where: [{ field: "label", operator: "contains", value: "e" }],
      });
      const total = context.data.collection("entries").sum("amount");
      return ui.page({
        title: String(context.settings.get("label")),
        children: [
          ui.textInput({ setting: "label", multiline: true, minLines: 3 }),
          ui.dateInput({ setting: "dueDate" }),
          ui.datetimeInput({ setting: "startsAt" }),
          ui.multiSelect({ setting: "tags" }),
          ui.badge({ text: "Ready", tone: "success" }),
          ui.progress({ label: "Entries", value: entries.length, max: 10 }),
          ui.button({ label: "Save", action: "save", icon: "check" }),
          ui.summary({ title: "Totals", values: [{ label: "Amount", value: total }] }),
          ui.list({
            items: entries.map((entry) =>
              ui.listItem({
                title: String(entry.label),
                leadingIcon: "calendar",
                primaryAction: ui.action({
                  label: "Open entry",
                  action: "open",
                  input: entry.id,
                  icon: "edit",
                }),
                actions: [
                  ui.action({
                    label: "Delete",
                    action: "remove",
                    input: entry.id,
                    icon: "delete",
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
    save(context) {
      context.data.collection("entries").insert({
        label: String(context.settings.get("label")),
        dueDate: String(context.settings.get("dueDate")),
        startsAt: String(context.settings.get("startsAt")),
        amount: null,
      });
      context.settings.reset("label");
      context.feedback.show("Saved");
      context.output.copy("Saved entry");
      context.notifications.schedule({
        id: "entry-reminder",
        title: "Review your entry",
        trigger: { type: "daily", hour: 9, minute: 0 },
        open: { screen: "home" },
      });
    },
    open(_context, input) {
      assertRecordId(input);
    },
    remove(context, input) {
      assertRecordId(input);
      context.data.collection("entries").remove(input);
      context.notifications.cancel("entry-reminder");
    },
  },
});

function assertRecordId(value: SerializableValue | undefined): asserts value is string {
  if (typeof value !== "string") throw new Error("A record ID is required.");
}
