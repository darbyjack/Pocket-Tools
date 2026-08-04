import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import { validatePageNode } from "./ui-validation.ts";

const sdk12Inspection: MiniAppInspection = {
  manifest: { id: "row-test", name: "Row Test", sdkVersion: "1.2" },
  settings: {},
  collections: {},
  screens: ["home"],
  actions: ["openEntry", "archiveEntry", "removeEntry"],
};

function page(primaryAction: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "page",
    title: "Rows",
    children: [
      {
        type: "list",
        items: [
          {
            type: "list-item",
            title: "Entry",
            subtitle: "Details",
            trailing: "Open",
            primaryAction,
            actions: [
              {
                label: "Archive",
                action: "archiveEntry",
                input: "0123456789abcdef0123456789abcdef",
              },
            ],
          },
        ],
      },
    ],
  };
}

test("accepts a dormant SDK 1.2 list-row primary action", () => {
  assert.doesNotThrow(() =>
    validatePageNode(
      page({
        label: "Open Entry",
        action: "openEntry",
        input: { id: "0123456789abcdef0123456789abcdef" },
      }),
      sdk12Inspection,
      { allowDormantSdk12: true },
    ),
  );
});

test("keeps list-row primary actions behind the dormant SDK 1.2 boundary", () => {
  const value = page({ label: "Open Entry", action: "openEntry" });
  assert.throws(
    () => validatePageNode(value, sdk12Inspection),
    /List-item primary actions require SDK 1\.2/,
  );

  const sdk11Inspection: MiniAppInspection = {
    ...sdk12Inspection,
    manifest: { ...sdk12Inspection.manifest, sdkVersion: "1.1" },
  };
  assert.throws(
    () => validatePageNode(value, sdk11Inspection, { allowDormantSdk12: true }),
    /List-item primary actions require SDK 1\.2/,
  );
});

test("requires confirmation for destructive row actions", () => {
  assert.throws(
    () =>
      validatePageNode(
        page({
          label: "Remove Entry",
          action: "removeEntry",
          intent: "destructive",
        }),
        sdk12Inspection,
        { allowDormantSdk12: true },
      ),
    /Destructive list-item primary actions require confirmation/,
  );

  assert.doesNotThrow(() =>
    validatePageNode(
      page({
        label: "Remove Entry",
        action: "removeEntry",
        intent: "destructive",
        confirmation: {
          title: "Remove entry?",
          message: "This cannot be undone.",
          confirmLabel: "Remove",
          cancelLabel: "Keep",
        },
      }),
      sdk12Inspection,
      { allowDormantSdk12: true },
    ),
  );
});

test("rejects unknown actions, invalid inputs, and extra properties", () => {
  assert.throws(
    () =>
      validatePageNode(
        page({ label: "Open Entry", action: "missingAction" }),
        sdk12Inspection,
        { allowDormantSdk12: true },
      ),
    /Unknown declared action/,
  );

  assert.throws(
    () =>
      validatePageNode(
        page({ label: "Open Entry", action: "openEntry", input: Number.POSITIVE_INFINITY }),
        sdk12Inspection,
        { allowDormantSdk12: true },
      ),
    /finite serializable value/,
  );

  assert.throws(
    () =>
      validatePageNode(
        page({ label: "Open Entry", action: "openEntry", style: "unsafe" }),
        sdk12Inspection,
        { allowDormantSdk12: true },
      ),
    /Unknown UI property/,
  );
});
