import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import { UI_ICON_NAMES } from "./sdk12-icons.ts";
import { validatePageNodeWithDormantFormHints } from "./sdk12-multiline-ui.ts";

function inspection(sdkVersion: "1.0" | "1.1" | "1.2"): MiniAppInspection {
  return {
    manifest: { id: "icon-tool", name: "Icon Tool", sdkVersion },
    settings: {},
    collections: {},
    screens: ["home"],
    actions: ["openItem", "editItem", "deleteItem"],
  };
}

const dormant = { allowDormantSdk12: true } as const;

function page(children: readonly unknown[]) {
  return { type: "page", title: "Icons", children };
}

test("accepts every frozen icon name on SDK 1.2 action controls", () => {
  for (const icon of UI_ICON_NAMES) {
    assert.doesNotThrow(() =>
      validatePageNodeWithDormantFormHints(
        page([{ type: "button", label: `Use ${icon}`, action: "openItem", icon }]),
        inspection("1.2"),
        dormant,
      ),
    );
  }
});

test("accepts fixed icons on list items, row actions, and visible actions", () => {
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(
      page([
        {
          type: "list",
          items: [
            {
              type: "list-item",
              title: "Appointment",
              leadingIcon: "calendar",
              primaryAction: { label: "Open appointment", action: "openItem", icon: "edit" },
              actions: [
                { label: "Edit", action: "editItem", icon: "edit" },
                {
                  label: "Delete",
                  action: "deleteItem",
                  icon: "delete",
                  intent: "destructive",
                  confirmation: { title: "Delete appointment?" },
                },
              ],
            },
          ],
        },
      ]),
      inspection("1.2"),
      dormant,
    ),
  );
});

test("keeps normal parsing and lower SDK versions closed to icon fields", () => {
  const value = page([{ type: "button", label: "Add", action: "openItem", icon: "add" }]);
  assert.throws(
    () => validatePageNodeWithDormantFormHints(value, inspection("1.2")),
    /Fixed host icons require SDK 1\.2/,
  );
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.throws(
      () => validatePageNodeWithDormantFormHints(value, inspection(sdkVersion), dormant),
      /Fixed host icons require SDK 1\.2/,
    );
  }
});

test("rejects unknown or malformed icon names", () => {
  for (const icon of ["download", "custom.svg", "https://example.com/icon.svg", 7, null]) {
    assert.throws(
      () =>
        validatePageNodeWithDormantFormHints(
          page([{ type: "button", label: "Add", action: "openItem", icon }]),
          inspection("1.2"),
          dormant,
        ),
      /Expected add, edit, delete/,
    );
  }
});

test("rejects script styling and keeps labels mandatory", () => {
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page([
          {
            type: "button",
            label: "Add",
            action: "openItem",
            icon: "add",
            iconColor: "red",
          },
        ]),
        inspection("1.2"),
        dormant,
      ),
    /iconColor: Unknown UI property/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page([{ type: "button", action: "openItem", icon: "add" }]),
        inspection("1.2"),
        dormant,
      ),
    /label: Expected a string/,
  );
});
