import assert from "node:assert/strict";
import test from "node:test";

import { SDK_VERSION, SUPPORTED_SDK_VERSIONS, defineMiniApp } from "./core.ts";
import { collection, field } from "./data.ts";
import { setting } from "./settings.ts";
import { ui } from "./ui.ts";
import { validateMiniAppDefinition } from "./validation.ts";

test("publishes the complete SDK 1.2 definition surface", () => {
  assert.equal(SDK_VERSION, "1.2");
  assert.deepEqual(SUPPORTED_SDK_VERSIONS, ["1.0", "1.1", "1.2"]);

  const definition = defineMiniApp({
    manifest: {
      id: "sdk-12-public",
      name: "SDK 1.2 Public",
      sdkVersion: "1.2",
    },
    settings: {
      title: setting.text({ label: "Title", default: "" }),
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
        title: field.text(),
        dueDate: field.date(),
        startsAt: field.datetime({ min: "2026-01-01T00:00:00.000Z" }),
      }),
    },
    screens: {
      home: () =>
        ui.page({
          title: "SDK 1.2 Public",
          children: [
            ui.dateInput({ setting: "dueDate" }),
            ui.datetimeInput({ setting: "startsAt" }),
            ui.multiSelect({ setting: "tags" }),
            ui.badge({ text: "Ready", tone: "success" }),
            ui.progress({ label: "Complete", value: 50, format: "percent" }),
            ui.button({ label: "Save", action: "save", icon: "check" }),
          ],
        }),
    },
    actions: {
      save(context) {
        context.settings.reset("title");
        context.feedback.show("Saved");
      },
    },
  });

  assert.deepEqual(validateMiniAppDefinition(definition), []);
});

test("keeps SDK 1.2 definition fields gated from SDK 1.0 and 1.1", () => {
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    const definition = defineMiniApp({
      manifest: { id: `legacy-${sdkVersion.replace(".", "-")}`, name: "Legacy", sdkVersion },
      settings: {
        dueDate: setting.date({ label: "Due date", default: "2026-08-04" }),
      },
      screens: {
        home: () => ui.page({ title: "Legacy", children: [] }),
      },
    });

    assert.ok(
      validateMiniAppDefinition(definition).some(
        (issue) => issue.path === "settings.dueDate.type" && issue.message === "Requires SDK 1.2.",
      ),
    );
  }
});
