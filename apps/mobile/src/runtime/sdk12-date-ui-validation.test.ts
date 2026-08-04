import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import { validatePageNode } from "./ui-validation.ts";

const inspection: MiniAppInspection = {
  manifest: { id: "date-tool", name: "Date Tool", sdkVersion: "1.2" },
  settings: {
    dueDate: {
      type: "date",
      label: "Due date",
      default: "2026-08-03",
      hostSdkVersion: "1.2",
    },
    reminderAt: {
      type: "datetime",
      label: "Reminder",
      default: "2026-08-04T03:30:00.000Z",
      hostSdkVersion: "1.2",
    },
  },
  collections: {},
  screens: ["home"],
  actions: [],
};

function page(children: readonly Record<string, unknown>[]) {
  return { type: "page", title: "Date Tool", children };
}

test("accepts date and date-time inputs only through the dormant SDK 1.2 path", () => {
  const value = page([
    { type: "date-input", setting: "dueDate", label: "Choose due date" },
    { type: "datetime-input", setting: "reminderAt" },
  ]);

  assert.throws(() => validatePageNode(value, inspection), /require SDK 1\.2/);
  assert.doesNotThrow(() =>
    validatePageNode(value, inspection, { allowDormantSdk12: true }),
  );
});

test("rejects missing and incompatible temporal setting bindings", () => {
  assert.throws(
    () =>
      validatePageNode(page([{ type: "date-input", setting: "missing" }]), inspection, {
        allowDormantSdk12: true,
      }),
    /Unknown declared setting/,
  );

  assert.throws(
    () =>
      validatePageNode(page([{ type: "date-input", setting: "reminderAt" }]), inspection, {
        allowDormantSdk12: true,
      }),
    /incompatible type datetime/,
  );

  assert.throws(
    () =>
      validatePageNode(page([{ type: "datetime-input", setting: "dueDate" }]), inspection, {
        allowDormantSdk12: true,
      }),
    /incompatible type date/,
  );
});

test("rejects unknown temporal input properties", () => {
  assert.throws(
    () =>
      validatePageNode(
        page([{ type: "date-input", setting: "dueDate", timezone: "UTC" }]),
        inspection,
        { allowDormantSdk12: true },
      ),
    /timezone: Unknown UI property/,
  );
});
