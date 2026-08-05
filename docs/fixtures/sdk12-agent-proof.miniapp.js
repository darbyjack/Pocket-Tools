// @ts-check

import { collection, defineMiniApp, field, setting, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "sdk12-acceptance",
    name: "SDK 1.2 Acceptance",
    description: "Exercise the public Pocket Tools SDK 1.2 surface through one ordinary tool.",
    sdkVersion: "1.2",
  },

  settings: {
    title: setting.text({
      label: "Task title",
      default: "First task",
      minLength: 1,
      maxLength: 120,
    }),
    notes: setting.text({
      label: "Notes",
      default: "Created through the public SDK 1.2 path.",
      maxLength: 500,
    }),
    amount: setting.money({
      label: "Amount",
      default: 12.5,
      min: 0,
      max: 1000000,
    }),
    dueDate: setting.date({
      label: "Due date",
      default: "2026-08-05",
      min: "2026-01-01",
      max: "2035-12-31",
    }),
    reminderAt: setting.datetime({
      label: "Reference date and time",
      default: "2026-08-05T14:00:00.000Z",
      min: "2026-01-01T00:00:00.000Z",
      max: "2035-12-31T23:59:59.999Z",
    }),
    tags: setting.multiSelect({
      label: "Tags",
      options: [
        { label: "Home", value: "home" },
        { label: "Work", value: "work" },
        { label: "Important", value: "important" },
      ],
      default: ["home"],
      minSelections: 1,
      maxSelections: 3,
    }),
  },

  collections: {
    tasks: collection({
      title: field.text({ minLength: 1, maxLength: 120 }),
      notes: field.text({ optional: true, maxLength: 500 }),
      amount: field.money({ min: 0, max: 1000000 }),
      dueDate: field.date({ min: "2026-01-01", max: "2035-12-31" }),
      reminderAt: field.datetime({
        min: "2026-01-01T00:00:00.000Z",
        max: "2035-12-31T23:59:59.999Z",
      }),
      complete: field.boolean(),
    }),
  },

  screens: {
    home(context) {
      const tasks = context.data.collection("tasks");
      const allTasks = tasks.query({
        orderBy: [{ field: "createdAt", direction: "desc" }],
        limit: 100,
      });
      const openTasks = tasks.query({
        where: [{ field: "complete", operator: "eq", value: false }],
        orderBy: [{ field: "dueDate", direction: "asc" }],
      });
      const titleMatches = tasks.count({
        where: [{ field: "title", operator: "contains", value: "task" }],
      });
      const completeCount = tasks.count({
        where: [{ field: "complete", operator: "eq", value: true }],
      });
      const amountTotal = tasks.sum("amount");
      const amountMinimum = tasks.min("amount");
      const amountMaximum = tasks.max("amount");
      const amountAverage = tasks.average("amount");
      const selectedTags = context.settings.get("tags");

      return ui.page({
        title: "SDK 1.2 Acceptance",
        children: [
          ui.section({
            title: "Create a task",
            children: [
              ui.textInput({ setting: "title", label: "Task title" }),
              ui.textInput({
                setting: "notes",
                label: "Notes",
                multiline: true,
                minLines: 4,
              }),
              ui.numberInput({
                setting: "amount",
                label: "Amount",
                step: 0.25,
                decimalPlaces: 2,
              }),
              ui.dateInput({ setting: "dueDate", label: "Due date" }),
              ui.datetimeInput({ setting: "reminderAt", label: "Reference date and time" }),
              ui.multiSelect({ setting: "tags", label: "Tags" }),
              ui.text({
                text: `Selected tags: ${Array.isArray(selectedTags) ? selectedTags.join(", ") : ""}`,
              }),
              ui.button({
                label: "Save task and schedule daily review",
                action: "saveTask",
                icon: "add",
              }),
            ],
          }),
          ui.section({
            title: "Status",
            children: [
              ui.badge({
                text: openTasks.length === 0 ? "All caught up" : `${openTasks.length} open`,
                tone: openTasks.length === 0 ? "success" : "info",
              }),
              ui.progress({
                label: "Completed tasks",
                value: completeCount,
                min: 0,
                max: Math.max(1, allTasks.length),
                format: "percent",
              }),
              ui.summary({
                title: "Task amounts",
                values: [
                  { label: "Total", value: amountTotal, format: "money" },
                  { label: "Minimum", value: amountMinimum ?? 0, format: "money" },
                  { label: "Maximum", value: amountMaximum ?? 0, format: "money" },
                  { label: "Average", value: amountAverage ?? 0, format: "money" },
                  { label: "Titles containing task", value: titleMatches, format: "number" },
                ],
              }),
              ui.row({
                children: [
                  ui.button({
                    label: "Share summary",
                    action: "shareSummary",
                    icon: "share",
                  }),
                  ui.button({
                    label: "Cancel daily review",
                    action: "cancelReminder",
                    icon: "warning",
                    confirmation: { title: "Cancel the daily review reminder?" },
                  }),
                ],
              }),
            ],
          }),
          ui.list({
            title: "Tasks",
            emptyState: {
              type: "empty-state",
              title: "No tasks yet",
              description: "Save one task to exercise records and actions.",
            },
            items: allTasks.map((task) =>
              ui.listItem({
                title: String(task.title),
                subtitle: `${String(task.dueDate)} · ${task.complete === true ? "Complete" : "Open"}`,
                trailing: `$${Number(task.amount).toFixed(2)}`,
                leadingIcon: task.complete === true ? "check" : "calendar",
                primaryAction: ui.action({
                  label: task.complete === true ? "Mark task open" : "Mark task complete",
                  action: "toggleTask",
                  input: task.id,
                  icon: "edit",
                }),
                actions: [
                  ui.action({
                    label: "Copy task title",
                    action: "copyTask",
                    input: task.id,
                    icon: "copy",
                  }),
                  ui.action({
                    label: "Delete task",
                    action: "deleteTask",
                    input: task.id,
                    icon: "delete",
                    intent: "destructive",
                    confirmation: {
                      title: "Delete this task?",
                      message: "This cannot be undone.",
                    },
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
    saveTask(context) {
      context.data.collection("tasks").insert({
        title: String(context.settings.get("title")),
        notes: String(context.settings.get("notes")),
        amount: Number(context.settings.get("amount")),
        dueDate: String(context.settings.get("dueDate")),
        reminderAt: String(context.settings.get("reminderAt")),
        complete: false,
      });
      context.settings.reset("title");
      context.settings.set("notes", "");
      context.notifications.schedule({
        id: "dailyReview",
        title: "Review your Pocket Tools tasks",
        body: "Open the SDK 1.2 acceptance tool to continue.",
        trigger: { type: "daily", hour: 9, minute: 0, delivery: "standard" },
        open: { screen: "home" },
      });
      context.output.copy("Task saved through SDK 1.2");
      context.feedback.show("Task saved");
    },

    toggleTask(context, input) {
      const taskId = requireRecordId(input);
      const tasks = context.data.collection("tasks");
      const task = tasks.get(taskId);
      if (task === null) throw new Error("Task not found.");
      tasks.update(taskId, { complete: task.complete !== true });
      context.feedback.show(task.complete === true ? "Task reopened" : "Task completed");
    },

    copyTask(context, input) {
      const task = context.data.collection("tasks").get(requireRecordId(input));
      if (task === null) throw new Error("Task not found.");
      context.output.copy(String(task.title));
      context.feedback.show("Task title copied");
    },

    deleteTask(context, input) {
      context.data.collection("tasks").remove(requireRecordId(input));
      context.feedback.show("Task deleted");
    },

    shareSummary(context) {
      const tasks = context.data.collection("tasks");
      const total = tasks.count();
      const complete = tasks.count({
        where: [{ field: "complete", operator: "eq", value: true }],
      });
      context.output.share({
        title: "SDK 1.2 task summary",
        text: `${complete} of ${total} tasks complete.`,
      });
    },

    cancelReminder(context) {
      context.notifications.cancel("dailyReview");
      context.feedback.show("Daily review canceled");
    },
  },
});

/**
 * @param {unknown} value
 * @returns {string}
 */
function requireRecordId(value) {
  if (typeof value !== "string") throw new Error("A record ID is required.");
  return value;
}
