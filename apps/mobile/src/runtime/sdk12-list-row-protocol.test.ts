import assert from "node:assert/strict";
import test from "node:test";

import {
  MiniAppRuntimeError,
  parseDormantSdk12RuntimeResponse,
  parseRuntimeResponse,
} from "./protocol.ts";

function response(primaryAction: Record<string, unknown>): string {
  return JSON.stringify({
    ok: true,
    value: {
      operations: [],
      page: {
        type: "page",
        title: "Rows",
        children: [
          {
            type: "list",
            items: [
              {
                type: "list-item",
                title: "Entry",
                primaryAction,
              },
            ],
          },
        ],
      },
    },
    logs: [],
    logsTruncated: false,
  });
}

test("parses a valid dormant SDK 1.2 list-row action", () => {
  const parsed = parseDormantSdk12RuntimeResponse(
    response({
      label: "Open Entry",
      action: "openEntry",
      input: { id: "0123456789abcdef0123456789abcdef" },
      disabled: false,
    }),
  );

  const page = parsed.value.page;
  assert.ok(page !== undefined);
  const list = page.children[0];
  assert.equal(list?.type, "list");
  if (list?.type !== "list") return;
  assert.equal(list.items[0]?.primaryAction?.label, "Open Entry");
});

test("normal response parsing rejects dormant list-row actions", () => {
  assert.throws(
    () => parseRuntimeResponse(response({ label: "Open Entry", action: "openEntry" })),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError &&
      error.code === "INVALID_UI_TREE" &&
      error.message.includes("require SDK 1.2"),
  );
});

test("dormant parsing rejects destructive rows without confirmation", () => {
  assert.throws(
    () =>
      parseDormantSdk12RuntimeResponse(
        response({
          label: "Remove Entry",
          action: "removeEntry",
          intent: "destructive",
        }),
      ),
    (error: unknown) =>
      error instanceof MiniAppRuntimeError &&
      error.code === "INVALID_UI_TREE" &&
      error.message.includes("require confirmation"),
  );
});
