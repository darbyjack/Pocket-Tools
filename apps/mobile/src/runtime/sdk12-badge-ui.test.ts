import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import { BADGE_TONES, badgeAccessibilityLabel, badgeTone } from "./sdk12-badge.ts";
import { validatePageNodeWithDormantFormHints } from "./sdk12-multiline-ui.ts";

function inspection(sdkVersion: "1.0" | "1.1" | "1.2"): MiniAppInspection {
  return {
    manifest: { id: "badge-tool", name: "Badge Tool", sdkVersion },
    settings: {},
    collections: {},
    screens: ["home"],
    actions: [],
  };
}

function page(child: Record<string, unknown>) {
  return { type: "page", title: "Badges", children: [child] };
}

test("accepts every frozen badge tone only through dormant SDK 1.2 validation", () => {
  for (const tone of BADGE_TONES) {
    const value = page({ type: "badge", text: "Ready", tone });
    assert.throws(
      () => validatePageNodeWithDormantFormHints(value, inspection("1.2")),
      /Unsupported UI node type: badge/,
    );
    assert.doesNotThrow(() =>
      validatePageNodeWithDormantFormHints(value, inspection("1.2"), {
        allowDormantSdk12: true,
      }),
    );
  }
});

test("accepts an omitted tone and treats it as neutral for presentation", () => {
  const node = { type: "badge", text: "Pending" } as const;
  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(page(node), inspection("1.2"), {
      allowDormantSdk12: true,
    }),
  );
  assert.equal(badgeTone(node), "neutral");
  assert.equal(badgeAccessibilityLabel(node), "Pending");
  assert.equal(
    badgeAccessibilityLabel({ type: "badge", text: "Saved", tone: "success" }),
    "success status: Saved",
  );
});

test("rejects badge nodes below SDK 1.2", () => {
  for (const sdkVersion of ["1.0", "1.1"] as const) {
    assert.throws(
      () =>
        validatePageNodeWithDormantFormHints(
          page({ type: "badge", text: "Ready", tone: "success" }),
          inspection(sdkVersion),
          { allowDormantSdk12: true },
        ),
      /require SDK 1\.2/,
    );
  }
});

test("rejects invalid badge text, tones, and unknown properties", () => {
  const options = { allowDormantSdk12: true } as const;
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "badge", text: "" }),
        inspection("1.2"),
        options,
      ),
    /1 to 80 characters/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "badge", text: "x".repeat(81) }),
        inspection("1.2"),
        options,
      ),
    /1 to 80 characters/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "badge", text: "Ready", tone: "purple" }),
        inspection("1.2"),
        options,
      ),
    /Expected neutral, info, success, warning, or danger/,
  );
  assert.throws(
    () =>
      validatePageNodeWithDormantFormHints(
        page({ type: "badge", text: "Ready", color: "green" }),
        inspection("1.2"),
        options,
      ),
    /color: Unknown UI property/,
  );
});

test("accepts badge nodes nested in host-owned layout containers", () => {
  const value = {
    type: "page",
    title: "Badges",
    children: [
      {
        type: "section",
        title: "Status",
        children: [
          {
            type: "row",
            children: [{ type: "badge", text: "Complete", tone: "success" }],
          },
        ],
      },
    ],
  };

  assert.doesNotThrow(() =>
    validatePageNodeWithDormantFormHints(value, inspection("1.2"), {
      allowDormantSdk12: true,
    }),
  );
});
